const path = require('path')
const { copySync } = require('fs-extra')
const { Domain } = require('tencent-component-toolkit')
const ensureObject = require('type/object/ensure')
const ensureIterable = require('type/iterable/ensure')
const ensureString = require('type/string/ensure')
const download = require('download')
const CONFIGS = require('./config')
const url = require('url')

/*
 * Pauses execution for the provided miliseconds
 *
 * @param ${number} wait - number of miliseconds to wait
 */
const sleep = async (wait) => new Promise((resolve) => setTimeout(() => resolve(), wait))

/*
 * Generates a random id
 */
const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)
/*
 * Packages framework app and injects shims and sdk
 *
 * @param ${instance} instance - the component instance
 * @param ${object} config - the component config
 */
const packageCode = async (instance, inputs) => {
  console.log(`Packaging ${CONFIGS.frameworkFullname} application...`)

  // unzip source zip file
  console.log(`Unzipping ${inputs.code.src || 'files'}...`)
  let sourceDirectory
  if (!inputs.code.src) {
    // add default nextjs template
    const downloadPath = `/tmp/${generateId()}`
    const filename = 'template'

    console.log(`Installing Default ${CONFIGS.frameworkFullname} App...`)
    await download(CONFIGS.templateUrl, downloadPath, {
      filename: `${filename}.zip`
    })
    const tempPath = await instance.unzip(`${downloadPath}/${filename}.zip`)
    sourceDirectory = `${tempPath}/src`
  } else {
    sourceDirectory = await instance.unzip(inputs.code.src)
  }
  console.log(`Files unzipped into ${sourceDirectory}...`)

  // add shim to the source directory
  console.log(`Installing ${CONFIGS.frameworkFullname} + SCF handler...`)
  copySync(path.join(__dirname, '_shims'), path.join(sourceDirectory, '_shims'))

  // add sdk to the source directory, add original handler
  console.log(`Installing Serverless Framework SDK...`)
  instance.state.handler = await instance.addSDK(sourceDirectory, '_shims/handler.handler')

  // zip the source directory with the shim and the sdk

  console.log(`Zipping files...`)
  const zipPath = await instance.zip(sourceDirectory)
  console.log(`Files zipped into ${zipPath}...`)

  // save the zip path to state for lambda to use it
  instance.state.zipPath = zipPath

  return zipPath
}

const mergeJson = (sourceJson, targetJson) => {
  for (const eveKey in sourceJson) {
    if (targetJson.hasOwnProperty(eveKey)) {
      if (['protocols', 'endpoints', 'customDomain'].indexOf(eveKey) != -1) {
        for (let i = 0; i < sourceJson[eveKey].length; i++) {
          const sourceEvents = JSON.stringify(sourceJson[eveKey][i])
          const targetEvents = JSON.stringify(targetJson[eveKey])
          if (targetEvents.indexOf(sourceEvents) == -1) {
            targetJson[eveKey].push(sourceJson[eveKey][i])
          }
        }
      } else {
        if (typeof sourceJson[eveKey] != 'string') {
          mergeJson(sourceJson[eveKey], targetJson[eveKey])
        } else {
          targetJson[eveKey] = sourceJson[eveKey]
        }
      }
    } else {
      targetJson[eveKey] = sourceJson[eveKey]
    }
  }
  return targetJson
}

const capitalString = (str) => {
  if (str.length < 2) {
    return str.toUpperCase()
  }

  return `${str[0].toUpperCase()}${str.slice(1)}`
}

const getDefaultProtocol = (protocols) => {
  if (protocols.map((i) => i.toLowerCase()).includes('https')) {
    return 'https'
  }
  return 'http'
}

const deleteRecord = (newRecords, historyRcords) => {
  const deleteList = []
  for (let i = 0; i < historyRcords.length; i++) {
    let temp = false
    for (let j = 0; j < newRecords.length; j++) {
      if (
        newRecords[j].domain == historyRcords[i].domain &&
        newRecords[j].subDomain == historyRcords[i].subDomain &&
        newRecords[j].recordType == historyRcords[i].recordType &&
        newRecords[j].value == historyRcords[i].value &&
        newRecords[j].recordLine == historyRcords[i].recordLine
      ) {
        temp = true
        break
      }
    }
    if (!temp) {
      deleteList.push(historyRcords[i])
    }
  }
  return deleteList
}

const prepareInputs = async (instance, credentials, inputs = {}) => {
  // 对function inputs进行标准化
  const tempFunctionConf = inputs.functionConf ? inputs.functionConf : {}
  const fromClientRemark = `tencent-${CONFIGS.framework}`
  const regionList = inputs.region
    ? typeof inputs.region == 'string'
      ? [inputs.region]
      : inputs.region
    : ['ap-guangzhou']

  // chenck state function name
  const stateFunctionName =
    instance.state[regionList[0]] && instance.state[regionList[0]].functionName
  // check state service id
  const stateServiceId = instance.state[regionList[0]] && instance.state[regionList[0]].serviceId

  const functionConf = {
    code:
      typeof inputs.src === 'object'
        ? inputs.src
        : {
            src: inputs.src
          },
    name:
      ensureString(inputs.functionName, { isOptional: true }) ||
      stateFunctionName ||
      `${CONFIGS.framework}_component_${generateId()}`,
    region: regionList,
    handler: ensureString(tempFunctionConf.handler ? tempFunctionConf.handler : inputs.handler, {
      default: CONFIGS.handler
    }),
    runtime: ensureString(tempFunctionConf.runtime ? tempFunctionConf.runtime : inputs.runtime, {
      default: CONFIGS.runtime
    }),
    namespace: ensureString(
      tempFunctionConf.namespace ? tempFunctionConf.namespace : inputs.namespace,
      { default: CONFIGS.namespace }
    ),
    description: ensureString(
      tempFunctionConf.description ? tempFunctionConf.description : inputs.description,
      {
        default: CONFIGS.description
      }
    ),
    fromClientRemark
  }
  functionConf.tags = ensureObject(tempFunctionConf.tags ? tempFunctionConf.tags : inputs.tag, {
    default: null
  })

  functionConf.include = ensureIterable(
    tempFunctionConf.include ? tempFunctionConf.include : inputs.include,
    { default: [], ensureItem: ensureString }
  )
  functionConf.exclude = ensureIterable(
    tempFunctionConf.exclude ? tempFunctionConf.exclude : inputs.exclude,
    { default: [], ensureItem: ensureString }
  )
  functionConf.exclude.push('.git/**', '.gitignore', '.serverless', '.DS_Store')
  if (inputs.functionConf) {
    functionConf.timeout = inputs.functionConf.timeout
      ? inputs.functionConf.timeout
      : CONFIGS.timeout
    functionConf.memorySize = inputs.functionConf.memorySize
      ? inputs.functionConf.memorySize
      : CONFIGS.memorySize
    if (inputs.functionConf.environment) {
      functionConf.environment = inputs.functionConf.environment
    }
    if (inputs.functionConf.vpcConfig) {
      functionConf.vpcConfig = inputs.functionConf.vpcConfig
    }
  }

  // 对apigw inputs进行标准化
  const apigatewayConf = inputs.apigatewayConf ? inputs.apigatewayConf : {}
  apigatewayConf.fromClientRemark = fromClientRemark
  apigatewayConf.serviceName = inputs.serviceName
  apigatewayConf.description = `Serverless Framework Tencent-${capitalString(
    CONFIGS.framework
  )} Component`
  apigatewayConf.serviceId = inputs.serviceId || stateServiceId
  apigatewayConf.region = functionConf.region
  apigatewayConf.protocols = apigatewayConf.protocols || ['http']
  apigatewayConf.environment = apigatewayConf.environment ? apigatewayConf.environment : 'release'
  apigatewayConf.endpoints = [
    {
      path: '/',
      enableCORS: apigatewayConf.enableCORS,
      method: 'ANY',
      function: {
        isIntegratedResponse: true,
        functionName: functionConf.name,
        functionNamespace: functionConf.namespace
      }
    }
  ]

  // 对cns inputs进行标准化
  const tempCnsConf = {}
  const tempCnsBaseConf = inputs.cloudDNSConf ? inputs.cloudDNSConf : {}

  // 分地域处理functionConf/apigatewayConf/cnsConf
  for (let i = 0; i < functionConf.region.length; i++) {
    const curRegion = functionConf.region[i]
    const curRegionConf = inputs[curRegion]
    if (curRegionConf && curRegionConf.functionConf) {
      functionConf[curRegion] = curRegionConf.functionConf
    }
    if (curRegionConf && curRegionConf.apigatewayConf) {
      apigatewayConf[curRegion] = curRegionConf.apigatewayConf
    }

    const tempRegionCnsConf = mergeJson(
      tempCnsBaseConf,
      curRegionConf && curRegionConf.cloudDNSConf ? curRegionConf.cloudDNSConf : {}
    )

    tempCnsConf[functionConf.region[i]] = {
      recordType: 'CNAME',
      recordLine: tempRegionCnsConf.recordLine ? tempRegionCnsConf.recordLine : undefined,
      ttl: tempRegionCnsConf.ttl,
      mx: tempRegionCnsConf.mx,
      status: tempRegionCnsConf.status ? tempRegionCnsConf.status : 'enable'
    }
  }

  const cnsConf = []
  // 对cns inputs进行检查和赋值
  if (apigatewayConf.customDomain && apigatewayConf.customDomain.length > 0) {
    const domain = new Domain(credentials)
    for (let domianNum = 0; domianNum < apigatewayConf.customDomain.length; domianNum++) {
      const domainData = await domain.check(apigatewayConf.customDomain[domianNum].domain)
      const tempInputs = {
        domain: domainData.domain,
        records: []
      }
      for (let eveRecordNum = 0; eveRecordNum < functionConf.region.length; eveRecordNum++) {
        if (tempCnsConf[functionConf.region[eveRecordNum]].recordLine) {
          tempInputs.records.push({
            subDomain: domainData.subDomain || '@',
            recordType: 'CNAME',
            recordLine: tempCnsConf[functionConf.region[eveRecordNum]].recordLine,
            value: `temp_value_about_${functionConf.region[eveRecordNum]}`,
            ttl: tempCnsConf[functionConf.region[eveRecordNum]].ttl,
            mx: tempCnsConf[functionConf.region[eveRecordNum]].mx,
            status: tempCnsConf[functionConf.region[eveRecordNum]].status || 'enable'
          })
        }
      }
      cnsConf.push(tempInputs)
    }
  }

  return {
    regionList,
    functionConf,
    apigatewayConf,
    cnsConf
  }
}

const buildMetrics = (datas, period) => {
  const padBody = (startTime, endTime, period) => {
    let padTimes = []
    let padValues = []

    while (startTime < endTime) {
      padTimes.push(startTime)
      padValues.push(0)
      startTime += (period * 1000)
    }
    return {timestamp: padTimes, values: padValues}
  }

  const filterMetricByName = function(metricName, metrics) {
    const len = metrics.length

    for (var i = 0; i < len; i++) {
      if (metrics[i].Response.MetricName == metricName) 
        return metrics[i].Response
    }
    return null
  }

  const response = {
    rangeStart: datas[0].Response.StartTime,
    rangeEnd: datas[0].Response.EndTime,
    metrics: []
  }

  const endTimeObj = new Date(datas[0].Response.EndTime)
  const startTimeObj = new Date(datas[0].Response.StartTime)

  // response timestamp is tz +08:00
  let startTimestamp, endTimestamp
  let offsetMs = 0
  if (startTimeObj.getTimezoneOffset() == 0)
    offsetMs = 480 * 60 * 1000
  
  startTimestamp = startTimeObj.getTime() - offsetMs
  endTimestamp = endTimeObj.getTime() - offsetMs

  const funcInvAndErr = {
    type: 'stacked-bar',
    title: 'function invocations & errors'
  }

  // build Invocation & error
  const invocations = filterMetricByName('Invocation', datas)
  if (invocations && invocations.DataPoints[0].Timestamps.length > 0) {
    funcInvAndErr.x = { type: 'timestamp' }
    if (!funcInvAndErr.y) 
      funcInvAndErr.y = []

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

    const padStart = padBody(startTimestamp, funcInvAndErr.x.values[0], period)
    if (padStart.timestamp.length > 0) 
      funcInvAndErr.x.values = padStart.timestamp.concat(funcInvAndErr.x.values)
    if (padStart.values.length > 0)
      funcInvItem.values = padStart.values.concat(funcInvItem.values)

    const padEnd = padBody(funcInvAndErr.x.values[funcInvAndErr.x.values.length - 1], 
      endTimestamp, period)
    if (padEnd.timestamp.length > 0) {
      padEnd.timestamp.shift()

      funcInvAndErr.x.values = funcInvAndErr.x.values.concat(padEnd.timestamp)
    }
    if (padEnd.values.length > 0) {
      padEnd.values.shift()
      funcInvItem.values = funcInvItem.values.concat(padEnd.values)
    }
    funcInvAndErr.y.push(funcInvItem)
  }
  const errors = filterMetricByName('Error', datas)
  if (errors && errors.DataPoints[0].Timestamps.length > 0) {
    funcInvAndErr.x = { type: 'timestamp' }
    if (!funcInvAndErr.y) 
      funcInvAndErr.y = []

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

    const padStart = padBody(startTimestamp, funcInvAndErr.x.values[0], period)
    if (padStart.timestamp.length > 0) 
      funcInvAndErr.x.values = padStart.timestamp.concat(funcInvAndErr.x.values)
    if (padStart.values.length > 0)
      funcErrItem.values = padStart.values.concat(funcErrItem.values)

    const padEnd = padBody(funcInvAndErr.x.values[funcInvAndErr.x.values.length - 1], 
      endTimestamp, period)
    if (padEnd.timestamp.length > 0) {
      padEnd.timestamp.shift()
      funcInvAndErr.x.values = funcInvAndErr.x.values.concat(padEnd.timestamp)
    }
    if (padEnd.values.length > 0) {
      padEnd.values.shift()
      funcErrItem.values = funcErrItem.values.concat(padEnd.values)
    }
    funcInvAndErr.y.push(funcErrItem)
  }
  if ((!invocations || invocations.DataPoints[0].Timestamps.length == 0) &&
    (!errors || errors.DataPoints[0].Timestamps.length == 0)) 
    funcInvAndErr.type = 'empty'

  response.metrics.push(funcInvAndErr)

  const latency = {
    type: 'multiline', // constant
    title: 'function latency' // constant
  }
  let latencyP50 = filterMetricByName('Duration-P50', datas)
  let latencyP95 = filterMetricByName('Duration-P95', datas)
  if (latencyP50 == null)
    latencyP50 = filterMetricByName('Duration', datas)
  if (latencyP95 == null)
    latencyP95 = filterMetricByName('Duration', datas)

  if (latencyP50 && latencyP50.DataPoints[0].Timestamps.length > 0) {
    latency.x = { type: 'timestamp' }
    if (!latency.y) 
      latency.y = []
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

    const padStart = padBody(startTimestamp, latency.x.values[0], period)
    if (padStart.timestamp.length > 0) 
      latency.x.values = padStart.timestamp.concat(latency.x.values)
    if (padStart.values.length > 0)
      p50.values = padStart.values.concat(p50.values)

    const padEnd = padBody(latency.x.values[latency.x.values.length - 1], 
      endTimestamp, period)
    if (padEnd.timestamp.length > 0) {
      padEnd.timestamp.shift()
      latency.x.values = latency.x.values.concat(padEnd.timestamp)
    }
    if (padEnd.values.length > 0) {
      padEnd.values.shift()
      p50.values = p50.values.concat(padEnd.values)
    }

    if (!(~~p50.total == p50.total)) 
      p50.total = parseFloat(p50.total.toFixed(2), 10)
    
    latency.y.push(p50)
  }

  if (latencyP95 && latencyP95.DataPoints[0].Timestamps.length > 0) {
    latency.x = { type: 'timestamp' }
    if (!latency.y) 
      latency.y = []

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

    const padStart = padBody(startTimestamp, latency.x.values[0], period)
    if (padStart.timestamp.length > 0) 
      latency.x.values = padStart.timestamp.concat(latency.x.values)
    if (padStart.values.length > 0)
      p95.values = padStart.values.concat(p95.values)

    const padEnd = padBody(latency.x.values[latency.x.values.length - 1], 
      endTimestamp, period)
    if (padEnd.timestamp.length > 0) {
      padEnd.timestamp.shift()
      latency.x.values = latency.x.values.concat(padEnd.timestamp)
    }
    if (padEnd.values.length > 0) {
      padEnd.values.shift()
      p95.values = p95.values.concat(padEnd.values)
    }

    if (!(~~p95.total == p95.total)) 
      p95.total = parseFloat(p95.total.toFixed(2), 10)
    latency.y.push(p95)
  }
  if ((!latencyP50 || latencyP50.DataPoints[0].Timestamps.length == 0) &&
    (!latencyP95 || latencyP95.DataPoints[0].Timestamps.length == 0)) 
    latency.type = 'empty'

  response.metrics.push(latency)

  return response
}

const buildCustomMetrics = (responses) => {
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
      if (isNaN(parseInt(char, 16))) 
        return null
      path += String.fromCharCode(parseInt(char, 16))
      i += 2
    }
    return path.toLocaleLowerCase()
  }

  const parseErrorPath = function(m, path) {
    const ret = path.match(m)
    if (!ret) 
      return null

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
    if (!ret) 
      return null

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

    if (!(~~data.total == data.total)) 
      data.total = parseFloat(data.total.toFixed(2), 10)
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
    apiReqAndErr.x = { type: 'timestamp' }
    if (!apiReqAndErr.y) 
      apiReqAndErr.y = []

    apiReqAndErr.x.values = requestDatas.Values.map((item) => {
      return item.Timestamp * 1000
    })
    const ret = makeMetric('requests', requestDatas)
    ret.type = 'count'
    apiReqAndErr.y.push(ret)
  } 

  if (errorDatas) {
    apiReqAndErr.x = { type: 'timestamp' }
    if (!apiReqAndErr.y) 
      apiReqAndErr.y = []

    apiReqAndErr.x.values = errorDatas.Values.map((item) => {
      return item.Timestamp * 1000
    })
    const errObj = makeMetric('errors', errorDatas)
    errObj.color = 'error'
    errObj.type = 'count'
    apiReqAndErr.y.push(errObj)
  }

  if (!requestDatas && !errorDatas) 
    apiReqAndErr.type = 'empty'

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
      if (!latency.y) 
        latency.y = []

      latency.x = { type: 'timestamp' }
      latency.x.values = requestDatas.Values.map((item) => {
        return item.Timestamp * 1000
      })
      latency.y.push(makeMetric('p95 latency', latencyP95Datas))
    }

    if (latencyP50Datas) {
      if (!latency.y) 
        latency.y = []

      latency.x = { type: 'timestamp' }
      latency.x.values = requestDatas.Values.map((item) => {
        return item.Timestamp * 1000
      })
      latency.y.push(makeMetric('p50 latency', latencyP50Datas))
    }
  }

  if (!latencyP50Datas && !latencyP95Datas) 
    latency.type = 'empty'

  results.push(latency)

  // request 5xx error
  const err5xx = {
    type: 'stacked-bar', // the chart widget type will use this
    title: 'api 5xx errors'
  }
  const err5xxDatas = filterMetricByName('5xx', responses)
  if (err5xxDatas) {
    err5xx.y = []
    err5xx.x = { type: 'timestamp' }
    err5xx.x.values = err5xxDatas.Values.map((item) => {
      return item.Timestamp * 1000
    })
    const errRet = makeMetric('5xx', err5xxDatas)
    errRet.color = 'error'
    errRet.type = 'count'
    err5xx.y.push(errRet)
  } else 
    err5xx.type = 'empty'

  results.push(err5xx)

  // request 4xx error
  const err4xxDatas = filterMetricByName('4xx', responses)
  const err4xx = {
    type: 'stacked-bar', // the chart widget type will use this
    title: 'api 4xx errors'
  }
  if (err4xxDatas) {
    err4xx.y = []
    err4xx.x = { type: 'timestamp' }
    err4xx.x.values = err4xxDatas.Values.map((item) => {
      return item.Timestamp * 1000
    })
    const errRet = makeMetric('4xx', err4xxDatas)
    errRet.color = 'error'
    errRet.type = 'count'
    err4xx.y.push(errRet)
  } else 
    err4xx.type = 'empty'

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
    apiPathRequest.x = { type: 'string' }
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
      if (!(~~total == total)) 
        total = parseFloat(total.toFixed(2), 10)

      if (!pathHash[val]) 
        pathHash[val] = 1
      else 
        pathHash[val]++

      if (!recordHash[path.code]) 
        recordHash[path.code] = {}
      
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
  } else 
    apiPathRequest.type = 'empty'
  
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
    if (!(~~total == total)) 
      total = parseFloat(total.toFixed(2), 10)

    if (!pathRequestHash[val]) 
      pathRequestHash[val] = total
    else 
      pathRequestHash[val] += total
  }

  const pathLatencyHash = {}
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
    if (!(~~total == total)) 
      total = parseFloat(total.toFixed(2), 10)

    if (!pathLatencyHash[val]) 
      pathLatencyHash[val] = total
    else 
      pathLatencyHash[val] += total
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
    if (!(~~pathRequestValues.total == pathRequestValues.total)) 
      pathRequestValues.total = parseFloat(pathRequestValues.total.toFixed(2), 10)

    const latencyNum = pathLatencyHash[key]
    pathLatencyValues.values.push(latencyNum || 0)
    pathLatencyValues.total += latencyNum || 0

    if (!(~~pathLatencyValues.total == pathLatencyValues.total)) 
      pathLatencyValues.total = parseFloat(pathLatencyValues.total.toFixed(2), 10)
  }

  const apiPaths = Object.keys(pathRequestHash)
  if (apiPaths.length > 0) {
    requestTotal.x = { type: 'string' }
    requestTotal.y = []
    requestTotal.x.values = apiPaths
    requestTotal.y.push(pathRequestValues)
    requestTotal.y.push(pathLatencyValues)
  } else 
    requestTotal.type = 'empty'

  results.push(requestTotal)

  return results
}

module.exports = {
  generateId,
  sleep,
  packageCode,
  mergeJson,
  capitalString,
  getDefaultProtocol,
  deleteRecord,
  prepareInputs,
  buildMetrics,
  buildCustomMetrics
}
