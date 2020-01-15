const { createServer, proxy } = require('tencent-serverless-http')

module.exports.handler = (event, context) => {
  const app = require.fromParentEnvironment('./app')
  const server = createServer(app)
  return proxy(server, event, context, 'PROMISE').promise
}
