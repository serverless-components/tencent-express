const path = require('path')
const { Component, utils } = require('@serverless/core')

class TencentExpress extends Component {
  async default(inputs = {}) {
    inputs.include = [path.join(__dirname, 'shim', 'dist')]
    inputs.handler = 'index.handler'
    inputs.runtime = 'Nodejs8.9'
    inputs.name = inputs.functionName
    inputs.codeUri = inputs.code || process.cwd()

    const appFile = path.join(path.resolve(inputs.codeUri), 'app.js')

    if (!(await utils.fileExists(appFile))) {
      throw new Error(`app.js not found in ${inputs.codeUri}`)
    }

    const tencentCloudFunction = await this.load('@serverless/tencent-cloudfunction')
    const tencentApiGateway = await this.load('@serverless/tencent-apigateway')

    const tencentCloudFunctionOutputs = await tencentCloudFunction(inputs)
    const tencentApiGatewayOutputs = await tencentApiGateway({
      serviceName: inputs.serviceName,
      serviceId: inputs.serviceId,
      region: inputs.region,
      protocol: inputs.protocol,
      environment: inputs.apiEnvironment,
      endpoints: [
        {
          path: '/',
          method: 'ANY',
          function: {
            functionName: tencentCloudFunctionOutputs.Name
          }
        }
      ]
    })

    const outputs = {
      url: `${tencentApiGatewayOutputs.protocol}://${tencentApiGatewayOutputs.subDomain}/${tencentApiGatewayOutputs.environment}/`
    }

    return outputs
  }

  async remove() {
    const tencentCloudFunction = await this.load('@serverless/tencent-cloudfunction')
    const tencentApiGateway = await this.load('@serverless/tencent-apigateway')

    await tencentCloudFunction.remove()
    await tencentApiGateway.remove()

    return {}
  }
}

module.exports = TencentExpress
