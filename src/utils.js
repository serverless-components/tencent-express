const path = require('path')
const { Cos } = require('tencent-component-toolkit')
const ensureObject = require('type/object/ensure')
const ensureIterable = require('type/iterable/ensure')
const ensureString = require('type/string/ensure')
const download = require('download')
const { TypeError } = require('tencent-component-toolkit/src/utils/error')
const CONFIGS = require('./config')

/*
 * Generates a random id
 */
const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)

const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

const getType = (obj) => {
  return Object.prototype.toString.call(obj).slice(8, -1)
}

const mergeJson = (sourceJson, targetJson) => {
  Object.entries(sourceJson).forEach(([key, val]) => {
    targetJson[key] = deepClone(val)
  })
  return targetJson
}

const capitalString = (str) => {
  if (str.length < 2) {
    return str.toUpperCase()
  }

  return `${str[0].toUpperCase()}${str.slice(1)}`
}

const getDefaultProtocol = (protocols) => {
  return String(protocols).includes('https') ? 'https' : 'http'
}

const getDefaultFunctionName = () => {
  return `${CONFIGS.compName}_component_${generateId()}`
}

const getDefaultServiceName = () => {
  return 'serverless'
}

const getDefaultServiceDescription = () => {
  return 'Created by Serverless Component'
}

const validateTraffic = (num) => {
  if (getType(num) !== 'Number') {
    throw new TypeError(
      `PARAMETER_${CONFIGS.compName.toUpperCase()}_TRAFFIC`,
      'traffic must be a number'
    )
  }
  if (num < 0 || num > 1) {
    throw new TypeError(
      `PARAMETER_${CONFIGS.compName.toUpperCase()}_TRAFFIC`,
      'traffic must be a number between 0 and 1'
    )
  }
  return true
}

const getCodeZipPath = async (instance, inputs) => {
  console.log(`Packaging ${CONFIGS.compFullname} application...`)

  // unzip source zip file
  let zipPath
  if (!inputs.code.src) {
    // add default template
    const downloadPath = `/tmp/${generateId()}`
    const filename = 'template'

    console.log(`Installing Default ${CONFIGS.compFullname} App...`)
    try {
      await download(CONFIGS.templateUrl, downloadPath, {
        filename: `${filename}.zip`
      })
    } catch (e) {
      throw new TypeError(`DOWNLOAD_TEMPLATE`, 'Download default template failed.')
    }
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

      // if shims and sls sdk entries had been injected to zipPath, no need to injected again
      console.log(`Uploading code to bucket ${bucketName}`)
      if (instance.codeInjected === true) {
        await instance.uploadSourceZipToCOS(zipPath, uploadUrl, {}, {})
      } else {
        const slsSDKEntries = instance.getSDKEntries('_shims/handler.handler')
        await instance.uploadSourceZipToCOS(zipPath, uploadUrl, slsSDKEntries, {
          _shims: path.join(__dirname, '_shims')
        })
        instance.codeInjected = true
      }
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

const prepareInputs = async (instance, credentials, inputs = {}) => {
  // 对function inputs进行标准化
  const tempFunctionConf = inputs.functionConf ? inputs.functionConf : {}
  const fromClientRemark = `tencent-${CONFIGS.compName}`
  const regionList = inputs.region
    ? typeof inputs.region == 'string'
      ? [inputs.region]
      : inputs.region
    : ['ap-guangzhou']

  // chenck state function name
  const stateFunctionName =
    instance.state[regionList[0]] && instance.state[regionList[0]].functionName
  const functionConf = {
    code: {
      src: inputs.src,
      bucket: inputs.srcOriginal && inputs.srcOriginal.bucket,
      object: inputs.srcOriginal && inputs.srcOriginal.object
    },
    name:
      ensureString(inputs.functionName, { isOptional: true }) ||
      stateFunctionName ||
      getDefaultFunctionName(),
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
    }),
    cfs: ensureIterable(tempFunctionConf.cfs ? tempFunctionConf.cfs : inputs.cfs, {
      default: []
    }),
    publish: inputs.publish,
    traffic: inputs.traffic,
    lastVersion: instance.state.lastVersion,
    eip: tempFunctionConf.eip === true,
    l5Enable: tempFunctionConf.l5Enable === true,
    timeout: tempFunctionConf.timeout ? tempFunctionConf.timeout : CONFIGS.timeout,
    memorySize: tempFunctionConf.memorySize ? tempFunctionConf.memorySize : CONFIGS.memorySize,
    tags: ensureObject(tempFunctionConf.tags ? tempFunctionConf.tags : inputs.tag, {
      default: null
    })
  }

  // validate traffic
  if (inputs.traffic !== undefined) {
    validateTraffic(inputs.traffic)
  }
  functionConf.needSetTraffic = inputs.traffic !== undefined && functionConf.lastVersion

  if (tempFunctionConf.environment) {
    functionConf.environment = inputs.functionConf.environment
  }
  if (tempFunctionConf.vpcConfig) {
    functionConf.vpcConfig = inputs.functionConf.vpcConfig
  }

  // 对apigw inputs进行标准化
  const tempApigwConf = inputs.apigatewayConf ? inputs.apigatewayConf : {}
  const apigatewayConf = {
    serviceId: inputs.serviceId,
    region: regionList,
    isDisabled: tempApigwConf.isDisabled === true,
    fromClientRemark: fromClientRemark,
    serviceName: inputs.serviceName || getDefaultServiceName(instance),
    description: getDefaultServiceDescription(instance),
    protocols: tempApigwConf.protocols || ['http'],
    environment: tempApigwConf.environment ? tempApigwConf.environment : 'release',
    endpoints: [
      {
        path: '/',
        enableCORS: tempApigwConf.enableCORS,
        serviceTimeout: tempApigwConf.serviceTimeout,
        method: 'ANY',
        function: {
          isIntegratedResponse: true,
          functionName: functionConf.name,
          functionNamespace: functionConf.namespace
        }
      }
    ],
    customDomains: tempApigwConf.customDomains || []
  }
  if (tempApigwConf.usagePlan) {
    apigatewayConf.endpoints[0].usagePlan = {
      usagePlanId: tempApigwConf.usagePlan.usagePlanId,
      usagePlanName: tempApigwConf.usagePlan.usagePlanName,
      usagePlanDesc: tempApigwConf.usagePlan.usagePlanDesc,
      maxRequestNum: tempApigwConf.usagePlan.maxRequestNum
    }
  }
  if (tempApigwConf.auth) {
    apigatewayConf.endpoints[0].auth = {
      secretName: tempApigwConf.auth.secretName,
      secretIds: tempApigwConf.auth.secretIds
    }
  }

  regionList.forEach((curRegion) => {
    const curRegionConf = inputs[curRegion]
    if (curRegionConf && curRegionConf.functionConf) {
      functionConf[curRegion] = curRegionConf.functionConf
    }
    if (curRegionConf && curRegionConf.apigatewayConf) {
      apigatewayConf[curRegion] = curRegionConf.apigatewayConf
    }
  })

  return {
    regionList,
    functionConf,
    apigatewayConf
  }
}

module.exports = {
  deepClone,
  generateId,
  uploadCodeToCos,
  mergeJson,
  capitalString,
  getDefaultProtocol,
  prepareInputs
}
