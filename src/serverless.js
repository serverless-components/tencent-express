const { Component } = require('@serverless/core')
const { MultiApigw, Scf, Apigw, Cos, Cns, Cam } = require('tencent-component-toolkit')
const { packageCode, getDefaultProtocol, deleteRecord, prepareInputs, buildMetrics, buildCustomMetrics } = require('./utils')
const CONFIGS = require('./config')
const { slsMonitor } = require('tencent-cloud-sdk')
const moment = require('moment')
const util = require('util')

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

    const camClient = new Cam(credentials)
    if (!inputs.role) {
      if (camClient.CheckSCFExcuteRole())
        inputs.role = 'QCS_SCFExcuteRole'
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

  async metrics(inputs = {}) {
    console.log(`Get Express Metrics Datas...`)

    console.log(JSON.stringify(this.state), '<<<<this.state')
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

    let functionName, namespace, functionVersion
    if (this.state[this.state.region] && this.state[this.state.region].functionName) {
      ;({ functionName, namespace, functionVersion } = this.state[this.state.region])
    } else {
      throw new Error('function name not define')
    }

    console.log(
      'getScfMetrics params>>',
      inputs.region,
      rangeTime,
      period,
      functionName,
      namespace
    )
    const responses = await slsClient.getScfMetrics(
      inputs.region,
      rangeTime,
      period,
      functionName,
      namespace || 'default'
    )
    console.log('getScf>>>', JSON.stringify(responses))
    const metricResults = buildMetrics(responses, period)

    const reqCustomTime = {
      rangeStart: inputs.rangeStart.format('YYYY-MM-DD HH:mm:ss'),
      rangeEnd: inputs.rangeEnd.format('YYYY-MM-DD HH:mm:ss')
    }

    const instances = [util.format('%s|%s|%s', namespace || 'default', functionName, functionVersion || '$LATEST')]
    console.log('customMetrics params>>', inputs.region, instances, reqCustomTime, period)
    const customMetrics = await slsClient.getCustomMetrics(
      inputs.region,
      instances,
      reqCustomTime,
      period
    )
    console.log('customMetrics>>>', JSON.stringify(customMetrics))

    const customResults = buildCustomMetrics(customMetrics)
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
