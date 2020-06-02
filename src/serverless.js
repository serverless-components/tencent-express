const { Component } = require('@serverless/core')
const { MultiApigw, Scf, Apigw, Cns, Cam, Metrics } = require('tencent-component-toolkit')
const { uploadCodeToCos, getDefaultProtocol, deleteRecord, prepareInputs } = require('./utils')
const CONFIGS = require('./config')

class ServerlessComponent extends Component {
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

    const uploadCodeHandler = []
    const outputs = {}
    const appId = this.getAppId()

    for (let eveRegionIndex = 0; eveRegionIndex < regionList.length; eveRegionIndex++) {
      const curRegion = regionList[eveRegionIndex]
      const funcDeployer = async () => {
        const code = await uploadCodeToCos(this, appId, credentials, inputs, curRegion)
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
    if (inputs.isDisabled) {
      return {}
    }
    const apigw = new MultiApigw(credentials, regionList)
    const oldState = this.state[regionList[0]] || {}
    inputs.oldState = {
      apiList: oldState.apiList || [],
      customDomains: oldState.customDomains || []
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
    console.log(`Deploying ${CONFIGS.frameworkFullname} App...`)

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

    const deployTasks = [this.deployFunction(credentials, functionConf, regionList, outputs)]
    // support apigatewayConf.isDisabled
    if (apigatewayConf.isDisabled !== true) {
      deployTasks.push(this.deployApigateway(credentials, apigatewayConf, regionList, outputs))
    } else {
      this.state.apigwDisabled = true
    }
    const [functionOutputs, apigwOutputs = {}] = await Promise.all(deployTasks)

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

    // cns depends on apigw, so if disabled apigw, just ignore it.
    if (cnsConf.length > 0 && apigatewayConf.isDisabled !== true) {
      outputs['cns'] = await this.deployCns(credentials, cnsConf, regionList, apigwOutputs)
    }

    this.state.region = regionList[0]
    this.state.regionList = regionList
    this.state.lambdaArn = functionConf.name

    return outputs
  }

  async remove() {
    console.log(`Removing ${CONFIGS.frameworkFullname} App...`)

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
    console.log(`Get ${CONFIGS.frameworkFullname} Metrics Datas...`)
    if (!inputs.rangeStart || !inputs.rangeEnd) {
      throw new Error('rangeStart and rangeEnd are require inputs')
    }
    const { region } = this.state
    if (!region) {
      throw new Error('No region property in state')
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
      const credentials = this.getCredentials()
      const mertics = new Metrics(credentials, options)
      const metricResults = await mertics.getDatas(
        inputs.rangeStart,
        inputs.rangeEnd,
        Metrics.Type.All
      )
      return metricResults
    }
    throw new Error('function name not define')
  }
}

module.exports = ServerlessComponent
