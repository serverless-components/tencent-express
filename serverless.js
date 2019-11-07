const path = require('path')
const { Component, utils } = require('@serverless/core')

class TencentExpress extends Component {
  async default(inputs = {}) {
    // there are some dependencies that require the express him to work
    // I've included them all here. A better approach would be to use
    // browserify to build all of these files into one.
    // but browserify throws an error because the required app.js is not found
    // which the user will be adding later on after the build

    const len = 6
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'
    const maxPos = chars.length
    let result = ''
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * maxPos))
    }

    const shimsDir = path.join(__dirname, 'shims')
    inputs.include = [
      path.join(shimsDir, 'binary-case.js'),
      path.join(shimsDir, 'index.js'),
      path.join(shimsDir, 'media-typer.js'),
      path.join(shimsDir, 'middleware.js'),
      path.join(shimsDir, 'mime-db.json'),
      path.join(shimsDir, 'mime-types.js'),
      path.join(shimsDir, 'type-is.js')
    ]
    inputs.exclude = ['.git/**', '.gitignore', '.serverless', '.DS_Store']
    inputs.handler = 'index.handler'
    inputs.runtime = 'Nodejs8.9'
    inputs.name = inputs.functionName || 'ExpressComponent_' + result
    inputs.codeUri = inputs.code || process.cwd()

    const appFile = path.join(path.resolve(inputs.codeUri), 'app.js')

    if (!(await utils.fileExists(appFile))) {
      throw new Error(`app.js not found in ${inputs.codeUri}`)
    }

    const tencentCloudFunction = await this.load('@serverless/tencent-scf')
    const tencentApiGateway = await this.load('@serverless/tencent-apigateway')

    if (inputs.functionConf) {
      inputs.timeout = inputs.functionConf.timeout ? inputs.functionConf.timeout : 3
      inputs.memorySize = inputs.functionConf.memorySize ? inputs.functionConf.memorySize : 128
      if (inputs.functionConf.environment) {
        inputs.environment = inputs.functionConf.environment
      }
      if (inputs.functionConf.vpcConfig) {
        inputs.vpcConfig = inputs.functionConf.vpcConfig
      }
    }

    const tencentCloudFunctionOutputs = await tencentCloudFunction(inputs)
    const apigwParam = {
      serviceName: inputs.serviceName,
      description: 'Serverless Framework tencent-express Component',
      serviceId: inputs.serviceId,
      region: inputs.region,
      protocol:
        inputs.apigatewayConf && inputs.apigatewayConf.protocol
          ? inputs.apigatewayConf.protocol
          : 'http',
      environment:
        inputs.apigatewayConf && inputs.apigatewayConf.environment
          ? inputs.apigatewayConf.environment
          : 'release',
      endpoints: [
        {
          path: '/',
          method: 'ANY',
          function: {
            isIntegratedResponse: true,
            functionName: tencentCloudFunctionOutputs.Name
          }
        }
      ]
    }
    if (inputs.apigatewayConf && inputs.apigatewayConf.usagePlan) {
      apigwParam.endpoints[0].usagePlan = inputs.apigatewayConf.usagePlan
    }
    if (inputs.apigatewayConf && inputs.apigatewayConf.auth) {
      apigwParam.endpoints[0].auth = inputs.apigatewayConf.auth
    }

    const tencentApiGatewayOutputs = await tencentApiGateway(apigwParam)
    const outputs = {
      region: inputs.region,
      functionName: inputs.name,
      apiGatewayServiceId: tencentApiGatewayOutputs.serviceId,
      url: `${tencentApiGatewayOutputs.protocol}://${tencentApiGatewayOutputs.subDomain}/${tencentApiGatewayOutputs.environment}/`
    }

    return outputs
  }

  async remove() {
    const tencentCloudFunction = await this.load('@serverless/tencent-scf')
    const tencentApiGateway = await this.load('@serverless/tencent-apigateway')

    await tencentCloudFunction.remove()
    await tencentApiGateway.remove()

    return {}
  }
}

module.exports = TencentExpress
