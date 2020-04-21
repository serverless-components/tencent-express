const { createServer, proxy } = require('tencent-serverless-http')

module.exports.handler = (event, context) => {
  const app = require.fromParentEnvironment('./app')
  // compatibility for node10
  context.callbackWaitsForEmptyEventLoop =
    app.callbackWaitsForEmptyEventLoop === false ? false : true
  const server = createServer(app, null, app.binaryTypes || [])
  return proxy(server, event, context, 'PROMISE').promise
}
