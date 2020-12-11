const { Component } = require('@serverless/core')
const { Scf, Apigw, Cns, Cam, Metrics } = require('tencent-component-toolkit')
const { TypeError } = require('tencent-component-toolkit/src/utils/error')
const { uploadCodeToCos, getDefaultProtocol, prepareInputs, deepClone } = require('./utils')
const CONFIGS = require('./config')

class ServerlessComponent extends Component {
  getCredentials() {
    const { tmpSecrets } = this.credentials.tencent

    if (!tmpSecrets || !tmpSecrets.TmpSecretId) {
      throw new TypeError(
        'CREDENTIAL',
        'Cannot get secretId/Key, your account could be sub-account and does not have the access to use SLS_QcsRole, please make sure the role exists first, then visit https://cloud.tencent.com/document/product/1154/43006, follow the instructions to bind the role to your account.'
      )
    }

    return {
      SecretId: tmpSecrets.TmpSecretId,
      SecretKey: tmpSecrets.TmpSecretKey,
      Token: tmpSecrets.Token
    }
  }

  getAppId() {
    return this.credentials.tencent.tmpSecrets.appId
  }

  async deployFunction(credentials, inputs, regionList) {
    if (!inputs.role) {
      try {
        const camClient = new Cam(credentials)
        const roleExist = await camClient.CheckSCFExcuteRole()
        if (roleExist) {
          inputs.role = 'QCS_SCFExcuteRole'
        }
      } catch (e) {
        // no op
      }
    }

    const outputs = {}
    const appId = this.getAppId()

    const funcDeployer = async (curRegion) => {
      const code = await uploadCodeToCos(this, appId, credentials, inputs, curRegion)
      const scf = new Scf(credentials, curRegion)
      const tempInputs = {
        ...inputs,
        code
      }
      const scfOutput = await scf.deploy(deepClone(tempInputs))
      outputs[curRegion] = {
        functionName: scfOutput.FunctionName,
        runtime: scfOutput.Runtime,
        namespace: scfOutput.Namespace
      }

      this.state[curRegion] = {
        ...(this.state[curRegion] ? this.state[curRegion] : {}),
        ...outputs[curRegion]
      }

      // default version is $LATEST
      outputs[curRegion].lastVersion = scfOutput.LastVersion
        ? scfOutput.LastVersion
        : this.state.lastVersion || '$LATEST'

      // default traffic is 1.0, it can also be 0, so we should compare to undefined
      outputs[curRegion].traffic =
        scfOutput.Traffic !== undefined
          ? scfOutput.Traffic
          : this.state.traffic !== undefined
          ? this.state.traffic
          : 1

      if (outputs[curRegion].traffic !== 1 && scfOutput.ConfigTrafficVersion) {
        outputs[curRegion].configTrafficVersion = scfOutput.ConfigTrafficVersion
        this.state.configTrafficVersion = scfOutput.ConfigTrafficVersion
      }

      this.state.lastVersion = outputs[curRegion].lastVersion
      this.state.traffic = outputs[curRegion].traffic
    }

    for (let i = 0; i < regionList.length; i++) {
      const curRegion = regionList[i]
      await funcDeployer(curRegion)
    }
    this.save()
    return outputs
  }

  // try to add dns record
  async tryToAddDnsRecord(credentials, customDomains) {
    try {
      const cns = new Cns(credentials)
      for (let i = 0; i < customDomains.length; i++) {
        const item = customDomains[i]
        if (item.domainPrefix) {
          await cns.deploy({
            domain: item.subDomain.replace(`${item.domainPrefix}.`, ''),
            records: [
              {
                subDomain: item.domainPrefix,
                recordType: 'CNAME',
                recordLine: '默认',
                value: item.cname,
                ttl: 600,
                mx: 10,
                status: 'enable'
              }
            ]
          })
        }
      }
    } catch (e) {
      console.log('METHOD_tryToAddDnsRecord', e.message)
    }
  }

  async deployApigateway(credentials, inputs, regionList) {
    if (inputs.isDisabled) {
      return {}
    }

    const getServiceId = (instance, region) => {
      const regionState = instance.state[region]
      return inputs.serviceId || (regionState && regionState.serviceId)
    }

    const deployTasks = []
    const outputs = {}
    regionList.forEach((curRegion) => {
      const apigwDeployer = async () => {
        const apigw = new Apigw(credentials, curRegion)

        const oldState = this.state[curRegion] || {}
        const apigwInputs = {
          ...inputs,
          oldState: {
            apiList: oldState.apiList || [],
            customDomains: oldState.customDomains || []
          }
        }
        // different region deployment has different service id
        apigwInputs.serviceId = getServiceId(this, curRegion)
        const apigwOutput = await apigw.deploy(deepClone(apigwInputs))
        outputs[curRegion] = {
          serviceId: apigwOutput.serviceId,
          subDomain: apigwOutput.subDomain,
          environment: apigwOutput.environment,
          url: `${getDefaultProtocol(inputs.protocols)}://${apigwOutput.subDomain}/${
            apigwOutput.environment
          }${apigwInputs.endpoints[0].path}`
        }

        if (apigwOutput.customDomains) {
          // TODO: need confirm add cns authentication
          if (inputs.autoAddDnsRecord === true) {
            // await this.tryToAddDnsRecord(credentials, apigwOutput.customDomains)
          }
          outputs[curRegion].customDomains = apigwOutput.customDomains
        }
        this.state[curRegion] = {
          created: true,
          ...(this.state[curRegion] ? this.state[curRegion] : {}),
          ...outputs[curRegion],
          apiList: apigwOutput.apiList
        }
      }
      deployTasks.push(apigwDeployer())
    })

    await Promise.all(deployTasks)

    this.save()
    return outputs
  }

  async deploy(inputs) {
    console.log(`Deploying ${CONFIGS.compFullname} App...`)

    const credentials = this.getCredentials()

    // 对Inputs内容进行标准化
    const { regionList, functionConf, apigatewayConf } = await prepareInputs(
      this,
      credentials,
      inputs
    )

    // 部署函数 + API网关
    const outputs = {}
    if (!functionConf.code.src) {
      outputs.templateUrl = CONFIGS.templateUrl
    }

    let apigwOutputs
    const functionOutputs = await this.deployFunction(
      credentials,
      functionConf,
      regionList,
      outputs
    )
    // support apigatewayConf.isDisabled
    if (apigatewayConf.isDisabled !== true) {
      apigwOutputs = await this.deployApigateway(credentials, apigatewayConf, regionList, outputs)
    } else {
      this.state.apigwDisabled = true
    }

    // optimize outputs for one region
    if (regionList.length === 1) {
      const [oneRegion] = regionList
      outputs.region = oneRegion
      outputs['scf'] = functionOutputs[oneRegion]
      if (apigwOutputs) {
        outputs['apigw'] = apigwOutputs[oneRegion]
      }
    } else {
      outputs['scf'] = functionOutputs
      if (apigwOutputs) {
        outputs['apigw'] = apigwOutputs
      }
    }

    this.state.region = regionList[0]
    this.state.regionList = regionList
    this.state.lambdaArn = functionConf.name

    return outputs
  }

  async remove() {
    console.log(`Removing ${CONFIGS.compFullname} App...`)

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
        // if disable apigw, no need to remove
        if (state.apigwDisabled !== true) {
          await apigw.remove({
            created: curState.created,
            environment: curState.environment,
            serviceId: curState.serviceId,
            apiList: curState.apiList,
            customDomains: curState.customDomains
          })
        }
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
    console.log(`Get ${CONFIGS.compFullname} Metrics Datas...`)
    if (!inputs.rangeStart || !inputs.rangeEnd) {
      throw new TypeError(
        `PARAMETER_${CONFIGS.compName.toUpperCase()}_METRICS`,
        'rangeStart and rangeEnd are require inputs'
      )
    }
    const { region } = this.state
    if (!region) {
      throw new TypeError(
        `PARAMETER_${CONFIGS.compName.toUpperCase()}_METRICS`,
        'No region property in state'
      )
    }
    const { functionName, namespace, functionVersion } = this.state[region] || {}
    if (functionName) {
      const options = {
        funcName: functionName,
        namespace: namespace,
        version: functionVersion,
        region,
        timezone: inputs.tz
      }

      const curState = this.state[region]
      if (curState.serviceId) {
        options.apigwServiceId = curState.serviceId
        options.apigwEnvironment = curState.environment || 'release'
      }
      const credentials = this.getCredentials()
      const mertics = new Metrics(credentials, options)
      const metricResults = await mertics.getDatas(
        inputs.rangeStart,
        inputs.rangeEnd,
        Metrics.Type.All
      )
      return metricResults
    }
    throw new TypeError(
      `PARAMETER_${CONFIGS.compName.toUpperCase()}_METRICS`,
      'Function name not define'
    )
  }
}

module.exports = ServerlessComponent
