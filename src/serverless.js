const { Component } = require('@serverless/core')
const { MultiApigw, Scf, Apigw, Cos, Cns } = require('tencent-component-toolkit')
const { packageCode, getDefaultProtocol, deleteRecord, prepareInputs } = require('./utils')
const CONFIGS = require('./config')
const { slsMonitor } = require('tencent-cloud-sdk')
const moment = require('moment')
const url = require('url')

class Express extends Component {
  getCredentials() {
    const { tmpSecrets } = this.credentials.tencent

    if (!tmpSecrets || !tmpSecrets.TmpSecretId) {
      throw new Error(
        'Cannot get secretId/Key, your account could be sub-account or does not have access, please check if SLS_QcsRole role exists in your account, and visit https://console.cloud.tencent.com/cam to bind this role to your account.'
      )
    }

    return {
      SecretId: tmpSecrets.TmpSecretId,
      SecretKey: tmpSecrets.TmpSecretKey,
      Token: tmpSecrets.Token
    }
  }

  async uploadCodeToCos(credentials, inputs, region, filePath) {
    const { appId } = this.credentials.tencent.tmpSecrets
    // 创建cos对象
    const cos = new Cos(credentials, region)
    // 创建存储桶 + 设置生命周期
    if (!inputs.code.bucket) {
      inputs.code.bucket = `sls-cloudfunction-${region}-code`
      await cos.deploy({
        bucket: inputs.code.bucket + '-' + appId,
        force: true,
        lifecycle: [
          {
            status: 'Enabled',
            id: 'deleteObject',
            filter: '',
            expiration: { days: '10' },
            abortIncompleteMultipartUpload: { daysAfterInitiation: '10' }
          }
        ]
      })
    }

    // 上传代码
    if (!inputs.code.object) {
      const object = `${inputs.name}-${Math.floor(Date.now() / 1000)}.zip`
      inputs.code.object = object
      await cos.upload({
        bucket: inputs.code.bucket + '-' + appId,
        file: filePath,
        key: inputs.code.object
      })
    }
    this.state.bucket = inputs.code.bucket
    this.state.object = inputs.code.object

    return {
      bucket: inputs.code.bucket,
      object: inputs.code.object
    }
  }

  async deployFunction(credentials, inputs, regionList) {
    // if set bucket and object not pack code
    let packageDir
    if (!inputs.code.bucket || !inputs.code.object) {
      packageDir = await packageCode(this, inputs)
    }

    // 上传代码到COS
    const uploadCodeHandler = []
    const outputs = {}

    for (let eveRegionIndex = 0; eveRegionIndex < regionList.length; eveRegionIndex++) {
      const curRegion = regionList[eveRegionIndex]
      const funcDeployer = async () => {
        const code = await this.uploadCodeToCos(credentials, inputs, curRegion, packageDir)
        const scf = new Scf(credentials, curRegion)
        const tempInputs = {
          ...inputs,
          code
        }
        const scfOutput = await scf.deploy(tempInputs)
        outputs[curRegion] = {
          functionName: scfOutput.FunctionName,
          runtime: scfOutput.Runtime,
          namespace: scfOutput.Namespace
        }

        this.state[curRegion] = {
          ...(this.state[curRegion] ? this.state[curRegion] : {}),
          ...outputs[curRegion]
        }
      }
      uploadCodeHandler.push(funcDeployer())
    }
    await Promise.all(uploadCodeHandler)
    this.save()
    return outputs
  }

  async deployApigateway(credentials, inputs, regionList) {
    const apigw = new MultiApigw(credentials, regionList)
    inputs.oldState = {
      apiList: (this.state[regionList[0]] && this.state[regionList[0]].apiList) || []
    }
    const apigwOutputs = await apigw.deploy(inputs)
    const outputs = {}
    Object.keys(apigwOutputs).forEach((curRegion) => {
      const curOutput = apigwOutputs[curRegion]
      outputs[curRegion] = {
        serviceId: curOutput.serviceId,
        subDomain: curOutput.subDomain,
        environment: curOutput.environment,
        url: `${getDefaultProtocol(inputs.protocols)}://${curOutput.subDomain}/${
          curOutput.environment
        }/`
      }
      if (curOutput.customDomains) {
        outputs[curRegion].customDomains = curOutput.customDomains
      }
      this.state[curRegion] = {
        created: curOutput.created,
        ...(this.state[curRegion] ? this.state[curRegion] : {}),
        ...outputs[curRegion],
        apiList: curOutput.apiList
      }
    })
    this.save()
    return outputs
  }

  async deployCns(credentials, inputs, regionList, apigwOutputs) {
    const cns = new Cns(credentials)
    const cnsRegion = {}
    regionList.forEach((curRegion) => {
      const curApigwOutput = apigwOutputs[curRegion]
      cnsRegion[curRegion] = curApigwOutput.subDomain
    })

    const state = []
    const outputs = {}
    const tempJson = {}
    for (let i = 0; i < inputs.length; i++) {
      const curCns = inputs[i]
      for (let j = 0; j < curCns.records.length; j++) {
        curCns.records[j].value =
          cnsRegion[curCns.records[j].value.replace('temp_value_about_', '')]
      }
      const tencentCnsOutputs = await cns.deploy(curCns)
      outputs[curCns.domain] = tencentCnsOutputs.DNS
        ? tencentCnsOutputs.DNS
        : 'The domain name has already been added.'
      tencentCnsOutputs.domain = curCns.domain
      state.push(tencentCnsOutputs)
    }

    // 删除serverless创建的但是不在本次列表中
    try {
      for (let i = 0; i < state.length; i++) {
        tempJson[state[i].domain] = state[i].records
      }
      const recordHistory = this.state.cns || []
      for (let i = 0; i < recordHistory.length; i++) {
        const delList = deleteRecord(tempJson[recordHistory[i].domain], recordHistory[i].records)
        if (delList && delList.length > 0) {
          await cns.remove({ deleteList: delList })
        }
      }
    } catch (e) {}

    this.state['cns'] = state
    this.save()
    return outputs
  }

  async deploy(inputs) {
    console.log(`Deploying Express App...`)

    const credentials = this.getCredentials()

    // 对Inputs内容进行标准化
    const { regionList, functionConf, apigatewayConf, cnsConf } = await prepareInputs(
      this,
      credentials,
      inputs
    )
    if (!functionConf.role) 
      functionConf.role = 'QCS_SCFExcuteRole'

    // 部署函数 + API网关
    const outputs = {}
    if (!functionConf.code.src) {
      outputs.templateUrl = CONFIGS.templateUrl
    }
    const [apigwOutputs, functionOutputs] = await Promise.all([
      this.deployApigateway(credentials, apigatewayConf, regionList, outputs),
      this.deployFunction(credentials, functionConf, regionList, outputs)
    ])

    // optimize outputs for one region
    if (regionList.length === 1) {
      const [oneRegion] = regionList
      outputs.region = oneRegion
      outputs['apigw'] = apigwOutputs[oneRegion]
      outputs['scf'] = functionOutputs[oneRegion]
    } else {
      outputs['apigw'] = apigwOutputs
      outputs['scf'] = functionOutputs
    }

    // 云解析遇到等API网关部署完成才可以继续部署
    if (cnsConf.length > 0) {
      outputs['cns'] = await this.deployCns(credentials, cnsConf, regionList, apigwOutputs)
    }

    this.state.region = regionList[0]
    this.state.regionList = regionList
    this.state.lambdaArn = functionConf.name

    return outputs
  }

  async remove() {
    console.log(`Removing Express App...`)

    const { state } = this
    const { regionList = [] } = state

    const credentials = this.getCredentials()

    const removeHandlers = []
    for (let i = 0; i < regionList.length; i++) {
      const curRegion = regionList[i]
      const curState = state[curRegion]
      const scf = new Scf(credentials, curRegion)
      const apigw = new Apigw(credentials, curRegion)
      const handler = async () => {
        await scf.remove({
          functionName: curState.functionName,
          namespace: curState.namespace
        })
        await apigw.remove({
          created: curState.created,
          environment: curState.environment,
          serviceId: curState.serviceId,
          apiList: curState.apiList,
          customDomains: curState.customDomains
        })
      }
      removeHandlers.push(handler())
    }

    await Promise.all(removeHandlers)

    if (this.state.cns) {
      const cns = new Cns(credentials)
      for (let i = 0; i < this.state.cns.length; i++) {
        await cns.remove({ deleteList: this.state.cns[i].records })
      }
    }

    this.state = {}
  }

  buildMetrics(datas) {
    const filterMetricByName = function(metricName, metrics) {
      const len = metrics.length

      for (var i = 0; i < len; i++) {
        if (metrics[i].Response.MetricName == metricName) {
          return metrics[i].Response
        }
      }
      return null
    }

    const response = {
      rangeStart: '',
      rangeEnd: '',
      metrics: []
    }

    const funcInvAndErr = {
      type: 'stacked-bar',
      title: 'function invocations & errors'
    }

    // build Invocation & error
    const invocations = filterMetricByName('Invocation', datas)
    if (invocations && invocations.DataPoints[0].Timestamps.length > 0) {
      funcInvAndErr.x = { type: 'timestamp' }
      if (!funcInvAndErr.y) {
        funcInvAndErr.y = []
      }

      response.rangeStart = invocations.StartTime
      response.rangeEnd = invocations.EndTime

      funcInvAndErr.x.values = invocations.DataPoints[0].Timestamps.map((ts) => ts * 1000)
      const funcInvItem = {
        name: invocations.MetricName.toLocaleLowerCase(),
        type: 'count',
        total: invocations.DataPoints[0].Values.reduce(function(a, b) {
          return a + b
        }, 0),
        values: invocations.DataPoints[0].Values
      }
      funcInvAndErr.y.push(funcInvItem)
    }
    const errors = filterMetricByName('Error', datas)
    if (errors && errors.DataPoints[0].Timestamps.length > 0) {
      funcInvAndErr.x = { type: 'timestamp' }
      if (!funcInvAndErr.y) {
        funcInvAndErr.y = []
      }
      response.rangeStart = errors.StartTime
      response.rangeEnd = errors.EndTime

      funcInvAndErr.x.values = errors.DataPoints[0].Timestamps.map((ts) => ts * 1000)
      const funcErrItem = {
        name: errors.MetricName.toLocaleLowerCase(),
        type: 'count',
        color: 'error',
        total: errors.DataPoints[0].Values.reduce(function(a, b) {
          return a + b
        }, 0),
        values: errors.DataPoints[0].Values
      }
      funcInvAndErr.y.push(funcErrItem)
    }
    if (
      (!invocations || invocations.DataPoints[0].Timestamps.length == 0) &&
      (!errors || errors.DataPoints[0].Timestamps.length == 0)
    ) {
      funcInvAndErr.type = 'empty'
    }
    response.metrics.push(funcInvAndErr)

    const latency = {
      type: 'multiline', // constant
      title: 'function latency' // constant
    }
    const latencyP50 = filterMetricByName('Duration-P50', datas)
    const latencyP95 = filterMetricByName('Duration-P95', datas)
    if (latencyP50 && latencyP50.DataPoints[0].Timestamps.length > 0) {
      latency.x = {
        type: 'timestamp'
      }
      if (!latency.y) {
        latency.y = []
      }
      response.rangeStart = latencyP50.StartTime
      response.rangeEnd = latencyP50.EndTime
      latency.x.values = latencyP50.DataPoints[0].Timestamps.map((ts) => ts * 1000)

      const p50 = {
        name: 'p50 latency', // constant
        type: 'duration', // constant
        total: latencyP50.DataPoints[0].Values.reduce(function(a, b) {
          return a + b
        }, 0),
        values: latencyP50.DataPoints[0].Values
      }
      if (!(~~p50.total == p50.total)) {
        p50.total = parseFloat(p50.total.toFixed(2), 10)
      }
      latency.y.push(p50)
    }

    if (latencyP95 && latencyP95.DataPoints[0].Timestamps.length > 0) {
      latency.x = {
        type: 'timestamp'
      }
      if (!latency.y) {
        latency.y = []
      }
      response.rangeStart = latencyP95.StartTime
      response.rangeEnd = latencyP95.EndTime
      latency.x.values = latencyP95.DataPoints[0].Timestamps.map((ts) => ts * 1000)

      const p95 = {
        name: 'p95 latency', // constant
        type: 'duration', // constant
        total: latencyP95.DataPoints[0].Values.reduce(function(a, b) {
          return a + b
        }, 0),
        values: latencyP95.DataPoints[0].Values
      }

      if (!(~~p95.total == p95.total)) {
        p95.total = parseFloat(p95.total.toFixed(2), 10)
      }
      latency.y.push(p95)
    }
    if (
      (!latencyP50 || latencyP50.DataPoints[0].Timestamps.length == 0) &&
      (!latencyP95 || latencyP95.DataPoints[0].Timestamps.length == 0)
    ) {
      latency.type = 'empty'
    }

    response.metrics.push(latency)

    return response
  }

  buildCustomMetrics(responses) {
    const filterMetricByName = function(metricName, metrics, all) {
      const len = metrics.length
      const results = []
      for (var i = 0; i < len; i++) {
        if (metrics[i].Response.Error)
          continue
        if (metrics[i].Response.Data.length > 0 && 
          metrics[i].Response.Data[0].AttributeName.match(metricName)) {
          if (all)
            results.push(metrics[i].Response.Data[0])
          else 
            return metrics[i].Response.Data[0]
        }
      }
      return all ? results : null
    }

    const hex2path = function(hexPath) {
      const len = hexPath.length
      let path = ''
      for (let i = 0; i < len; ) {
        const char = hexPath.slice(i, i + 2)
        if (isNaN(parseInt(char, 16))) {
          return null
        }
        path += String.fromCharCode(parseInt(char, 16))
        i += 2
      }
      return path.toLocaleLowerCase()
    }

    const parseErrorPath = function(m, path) {
      const ret = path.match(m)
      if (!ret) {
        return null
      }

      const method = ret[1]
      const hexPath = ret[2]
      const code = parseInt(ret[3], 10)

      const pathObj = url.parse(hex2path(hexPath))

      return {
        method: method.toLocaleUpperCase(),
        path: pathObj ? pathObj.pathname : hex2path(hexPath),
        code: code
      }
    }

    const parsePath = function(m, path) {
      const ret = path.match(m)
      if (!ret) {
        return null
      }

      const method = ret[1]
      const hexPath = ret[2]

      const pathObj = url.parse(hex2path(hexPath))

      return {
        method: method.toLocaleUpperCase(),
        path: pathObj ? pathObj.pathname : hex2path(hexPath)
      }
    }

    const makeMetric = function(name, metricData) {
      const data = {
        name: name,
        type: 'duration',
        values: metricData.Values.map((item) => {
          return item.Value
        })
      }

      data.total = data.values.reduce(function(a, b) {
        return a + b
      }, 0)

      if (!(~~data.total == data.total)) {
        data.total = parseFloat(data.total.toFixed(2), 10)
      }
      return data
    }
    const results = []
    const requestDatas = filterMetricByName('request', responses)
    const errorDatas = filterMetricByName('error', responses)
    const apiReqAndErr = {
      type: 'stacked-bar',
      title: 'api requests & errors'
    }
    if (requestDatas) {
      apiReqAndErr.x = {
        type: 'timestamp'
      }
      if (!apiReqAndErr.y) {
        apiReqAndErr.y = []
      }

      apiReqAndErr.x.values = requestDatas.Values.map((item) => {
        return item.Timestamp * 1000
      })
      const ret = makeMetric('requests', requestDatas)
      ret.type = 'duration'
      apiReqAndErr.y.push(ret)
    } 

    if (errorDatas) {
      apiReqAndErr.x = {
        type: 'timestamp'
      }
      if (!apiReqAndErr.y) {
        apiReqAndErr.y = []
      }

      apiReqAndErr.x.values = errorDatas.Values.map((item) => {
        return item.Timestamp * 1000
      })
      const errObj = makeMetric('errors', errorDatas)
      errObj.color = 'error'
      errObj.type = 'duration'
      apiReqAndErr.y.push(errObj)
    }

    if (!requestDatas && !errorDatas) {
      apiReqAndErr.type = 'empty'
    }

    results.push(apiReqAndErr)

    // request latency
    let latencyP95Datas, latencyP50Datas
    const latency = {
      title: 'api latency',
      type: 'multiline'
    }
    if (requestDatas) {
      latencyP95Datas = filterMetricByName('latency-P95', responses)
      latencyP50Datas = filterMetricByName('latency-P50', responses)
      if (latencyP95Datas) {
        if (!latency.y) {
          latency.y = []
        }
        latency.x = {
          type: 'timestamp'
        }
        latency.x.values = requestDatas.Values.map((item) => {
          return item.Timestamp * 1000
        })
        latency.y.push(makeMetric('p95 latency', latencyP95Datas))
      }

      if (latencyP50Datas) {
        if (!latency.y) {
          latency.y = []
        }
        latency.x = {
          type: 'timestamp'
        }
        latency.x.values = requestDatas.Values.map((item) => {
          return item.Timestamp * 1000
        })
        latency.y.push(makeMetric('p50 latency', latencyP50Datas))
      }
    }

    if (!latencyP50Datas && !latencyP95Datas) {
      latency.type = 'empty'
    }
    results.push(latency)

    // request 5xx error
    const err5xx = {
      type: 'stacked-bar', // the chart widget type will use this
      title: 'api 5xx errors'
    }
    const err5xxDatas = filterMetricByName('5xx', responses)
    if (err5xxDatas) {
      err5xx.y = []
      err5xx.x = {
        type: 'timestamp'
      }
      err5xx.x.values = err5xxDatas.Values.map((item) => {
        return item.Timestamp * 1000
      })
      const errRet = makeMetric('5xx', err5xxDatas)
      errRet.color = 'error'
      errRet.type = 'count'
      err5xx.y.push(errRet)
    } else {
      err5xx.type = 'empty'
    }

    results.push(err5xx)

    // request 4xx error
    const err4xxDatas = filterMetricByName('4xx', responses)
    const err4xx = {
      type: 'stacked-bar', // the chart widget type will use this
      title: 'api 4xx errors'
    }
    if (err4xxDatas) {
      err4xx.y = []
      err4xx.x = {
        type: 'timestamp'
      }
      err4xx.x.values = err4xxDatas.Values.map((item) => {
        return item.Timestamp * 1000
      })
      const errRet = makeMetric('4xx', err4xxDatas)
      errRet.color = 'error'
      errRet.type = 'count'
      err4xx.y.push(errRet)
    } else {
      err4xx.type = 'empty'
    }
    results.push(err4xx)

    // api request error
    const apiPathRequest = {
      type: 'list-flat-bar', // constant
      title: 'api errors' // constant
    }
    const pathStatusDatas = filterMetricByName(
      /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_(.*)_(\d+)$/i,
      responses,
      true
    )
    const pathLen = pathStatusDatas.length
    if (pathLen > 0) {
      apiPathRequest.x = {
        type: 'string'
      }
      apiPathRequest.y = []
      apiPathRequest.color = 'error'

      const pathHash = {}
      const recordHash = {}
      for (let i = 0; i < pathLen; i++) {
        const pathData = pathStatusDatas[i]
        const path = parseErrorPath(/^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)_(\d+)$/i, pathData.AttributeName)
        if (path.code < 400)
          continue
        const val = `${path.method} - ${path.path}`

        let total = 0
        pathData.Values.map((item) => {
          total += item.Value
        })
        if (!(~~total == total)) {
          total = parseFloat(total.toFixed(2), 10)
        }

        if (!pathHash[val]) {
          pathHash[val] = 1
        } else {
          pathHash[val]++
        }

        if (!recordHash[path.code]) {
          recordHash[path.code] = {}
        }
        recordHash[path.code][val] = total
      }
      apiPathRequest.x.values = Object.keys(pathHash)

      for (const key in recordHash) {
        const item = recordHash[key]
        const errItem = {
          name: key, // the http error code
          type: 'count', // constant
          total: 0,
          values: null
        }
        const codeVals = []
        let total = 0
        for (var i = 0; i < apiPathRequest.x.values.length; i++) {
          const path = apiPathRequest.x.values[i]

          codeVals.push(item[path] || 0)
          total += item[path] || 0
        }
        errItem.values = codeVals
        errItem.total = total
        apiPathRequest.y.push(errItem)
      }
    } else {
      apiPathRequest.type = 'empty'
    }
    results.push(apiPathRequest)

    // total request
    const requestTotal = {
      type: 'list-details-bar', // constant
      title: 'api path requests' // constant
    }

    const pathRequestRegExp = /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)$/i
    const pathLatencyRegExp = /^(GET|POST|DEL|DELETE|PUT|OPTIONS|HEAD)_([a-zA-Z0-9]+)_latency$/i
    const pathRequestDatas = filterMetricByName(pathRequestRegExp, responses, true)
    const pathLatencyDatas = filterMetricByName(pathLatencyRegExp, responses, true)

    const pathRequestHash = {}
    // let requestTotalNum = 0
    const pathRequestDatasLen = pathRequestDatas.length
    for (i = 0; i < pathRequestDatasLen; i++) {
      const pathRequestItem = pathRequestDatas[i]
      const path = parsePath(pathRequestRegExp, pathRequestItem.AttributeName)
      const val = `${path.method} - ${path.path}`

      let total = 0
      pathRequestItem.Values.map((item) => {
        total += item.Value
      })
      if (!(~~total == total)) {
        total = parseFloat(total.toFixed(2), 10)
      }

      // requestTotalNum += total
      if (!pathRequestHash[val]) {
        pathRequestHash[val] = total
      } else {
        pathRequestHash[val] += total
      }
    }

    const pathLatencyHash = {}
    // let requestLatencyNum = 0
    const pathLatencyLen = pathLatencyDatas.length
    for (i = 0; i < pathLatencyLen; i++) {
      const pathLatencyItem = pathLatencyDatas[i]
      const path = parsePath(pathLatencyRegExp, pathLatencyItem.AttributeName)
      const val = `${path.method} - ${path.path}`

      let total = 0
      pathLatencyItem.Values.map((item) => {
        total += item.Value
      })

      total = total / pathLatencyItem.Values.length
      if (!(~~total == total)) {
        total = parseFloat(total.toFixed(2), 10)
      }

      // requestLatencyNum += total
      if (!pathLatencyHash[val]) {
        pathLatencyHash[val] = total
      } else {
        pathLatencyHash[val] += total
      }
    }
    const pathRequestValues = {
      name: 'requests', // constant
      type: 'count', // constant
      total: 0,
      values: []
    }
    const pathLatencyValues = {
      name: 'avg latency', // constant
      type: 'duration', // constant
      total: 0,
      values: []
    }
    for (const key in pathRequestHash) {
      const reqNum = pathRequestHash[key]
      pathRequestValues.values.push(reqNum || 0)
      pathRequestValues.total += reqNum || 0
      if (!(~~pathRequestValues.total == pathRequestValues.total)) {
        pathRequestValues.total = parseFloat(pathRequestValues.total.toFixed(2), 10)
      }

      const latencyNum = pathLatencyHash[key]
      pathLatencyValues.values.push(latencyNum || 0)
      pathLatencyValues.total += latencyNum || 0

      if (!(~~pathLatencyValues.total == pathLatencyValues.total)) {
        pathLatencyValues.total = parseFloat(pathLatencyValues.total.toFixed(2), 10)
      }
    }

    const apiPaths = Object.keys(pathRequestHash)
    if (apiPaths.length > 0) {
      requestTotal.x = {
        type: 'string'
      }
      requestTotal.y = []
      requestTotal.x.values = apiPaths
      requestTotal.y.push(pathRequestValues)
      requestTotal.y.push(pathLatencyValues)
    } else {
      requestTotal.type = 'empty'
    }

    results.push(requestTotal)

    return results
  }

  async metrics(inputs = {}) {
    console.log(`Get Express Metrics Datas...`)
    if (!inputs.rangeStart || !inputs.rangeEnd) {
      throw new Error('rangeStart and rangeEnd are require inputs')
    }
    inputs.rangeStart = moment(inputs.rangeStart)
    inputs.rangeEnd = moment(inputs.rangeEnd)

    if (inputs.rangeStart.isAfter(inputs.rangeEnd)) {
      throw new Error(`The rangeStart provided is after the rangeEnd`)
    }

    // Validate: End is not longer than 30 days
    if (inputs.rangeStart.diff(inputs.rangeEnd, 'days') >= 31) {
      throw new Error(
        `The range cannot be longer than 30 days.  The supplied range is: ${inputs.rangeStart.diff(
          inputs.rangeEnd,
          'days'
        )}`
      )
    }

    const diffMinutes = (inputs.rangeEnd - inputs.rangeStart) / 1000 / 60
    let period
    if (diffMinutes <= 16) {
      // 16 mins
      period = 60 // 1 min
    } else if (diffMinutes <= 61) {
      // 1 hour
      period = 300 // 5 mins
    } else if (diffMinutes <= 1500) {
      // 24 hours
      period = 3600 // hour
    } else {
      period = 86400 // day
    }

    const credentials = this.getCredentials()
    const slsClient = new slsMonitor(credentials)

    let timeFormat = 'YYYY-MM-DDTHH:mm:ssZ'
    if (inputs.tz) {
      timeFormat = 'YYYY-MM-DDTHH:mm:ss' + inputs.tz
    }

    const rangeTime = {
      rangeStart: inputs.rangeStart.format(timeFormat),
      rangeEnd: inputs.rangeEnd.format(timeFormat)
    }

    let functionName
    if (this.state[this.state.region] && this.state[this.state.region].functionName) {
      ;({ functionName } = this.state[this.state.region])
    } else {
      throw new Error('function name not define')
    }

    console.log(
      'getScfMetrics params>>',
      inputs.region,
      rangeTime,
      period,
      functionName,
      inputs.namespace
    )
    const responses = await slsClient.getScfMetrics(
      inputs.region,
      rangeTime,
      period,
      functionName,
      inputs.namespace || 'default'
    )
    console.log('getScf>>>', responses)
    const metricResults = this.buildMetrics(responses)

    const reqCustomTime = {
      rangeStart: inputs.rangeStart.format('YYYY-MM-DD HH:mm:ss'),
      rangeEnd: inputs.rangeEnd.format('YYYY-MM-DD HH:mm:ss')
    }

    const instances = [inputs.instance || 'default']
    console.log('customMetrics params>>', inputs.region, instances, reqCustomTime, period)
    const customMetrics = await slsClient.getCustomMetrics(
      inputs.region,
      instances,
      reqCustomTime,
      period
    )
    console.log('customMetrics>>>', customMetrics)

    const customResults = this.buildCustomMetrics(customMetrics)
    metricResults.metrics = metricResults.metrics.concat(customResults)

    if (!metricResults.rangeStart) {
      metricResults.rangeStart = reqCustomTime.rangeStart
    }
    if (!metricResults.rangeEnd) {
      metricResults.rangeEnd = reqCustomTime.rangeEnd
    }
    return metricResults
  }
}

module.exports = Express
