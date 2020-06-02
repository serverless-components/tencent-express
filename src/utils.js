const path = require('path')
const { Domain, Cos } = require('tencent-component-toolkit')
const ensureObject = require('type/object/ensure')
const ensureIterable = require('type/iterable/ensure')
const ensureString = require('type/string/ensure')
const download = require('download')
const CONFIGS = require('./config')

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

const getCodeZipPath = async (instance, inputs) => {
  console.log(`Packaging ${CONFIGS.frameworkFullname} application...`)

  // unzip source zip file
  let zipPath
  if (!inputs.code.src) {
    // add default template
    const downloadPath = `/tmp/${generateId()}`
    const filename = 'template'

    console.log(`Installing Default ${CONFIGS.frameworkFullname} App...`)
    await download(CONFIGS.templateUrl, downloadPath, {
      filename: `${filename}.zip`
    })
    zipPath = `${downloadPath}/${filename}.zip`
  } else {
    zipPath = inputs.code.src
  }

  return zipPath
}

/**
 * Upload code to COS
 * @param {Component} instance serverless component instance
 * @param {string} appId app id
 * @param {object} credentials credentials
 * @param {object} inputs component inputs parameters
 * @param {string} region region
 */
const uploadCodeToCos = async (instance, appId, credentials, inputs, region) => {
  const bucketName = inputs.code.bucket || `sls-cloudfunction-${region}-code`
  const objectName = inputs.code.object || `${inputs.name}-${Math.floor(Date.now() / 1000)}.zip`
  // if set bucket and object not pack code
  if (!inputs.code.bucket || !inputs.code.object) {
    const zipPath = await getCodeZipPath(instance, inputs)
    console.log(`Code zip path ${zipPath}`)

    // save the zip path to state for lambda to use it
    instance.state.zipPath = zipPath

    const cos = new Cos(credentials, region)

    if (!inputs.code.bucket) {
      // create default bucket
      await cos.deploy({
        bucket: bucketName + '-' + appId,
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

    // upload code to cos
    if (!inputs.code.object) {
      console.log(`Getting cos upload url for bucket ${bucketName}`)
      const uploadUrl = await cos.getObjectUrl({
        bucket: bucketName + '-' + appId,
        object: objectName,
        method: 'PUT'
      })
      const slsSDKEntries = instance.getSDKEntries('_shims/handler.handler')

      console.log(`Uploading code to bucket ${bucketName}`)
      await instance.uploadSourceZipToCOS(zipPath, uploadUrl, slsSDKEntries, {
        _shims: path.join(__dirname, '_shims')
      })
      console.log(`Upload ${objectName} to bucket ${bucketName} success`)
    }
  }

  // save bucket state
  instance.state.bucket = bucketName
  instance.state.object = objectName

  return {
    bucket: bucketName,
    object: objectName
  }
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
    code: {
      src: inputs.src,
      bucket: inputs.srcOriginal && inputs.srcOriginal.bucket,
      object: inputs.srcOriginal && inputs.srcOriginal.object
    },
    name:
      ensureString(inputs.functionName, { isOptional: true }) ||
      stateFunctionName ||
      `${CONFIGS.framework}_component_${generateId()}`,
    region: regionList,
    role: ensureString(tempFunctionConf.role ? tempFunctionConf.role : inputs.role, {
      default: ''
    }),
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
    fromClientRemark,
    layers: ensureIterable(tempFunctionConf.layers ? tempFunctionConf.layers : inputs.layers, {
      default: []
    })
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

module.exports = {
  generateId,
  sleep,
  uploadCodeToCos,
  mergeJson,
  capitalString,
  getDefaultProtocol,
  deleteRecord,
  prepareInputs
}
