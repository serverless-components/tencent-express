require('tencent-component-monitor')
const fs = require('fs')
const path = require('path')
const { createServer, proxy } = require('tencent-serverless-http')

let server

exports.handler = async (event, context) => {
  const userSls = path.join(__dirname, '..', 'sls.js')
  let app
  if (fs.existsSync(userSls)) {
    // load the user provided app
    app = require(userSls)
  } else {
    // load the built-in default app
    app = require('./sls.js')
  }

  // attach event and context to request
  app.request.__SLS_EVENT__ = event
  app.request.__SLS_CONTEXT__ = context

  // cache server, not create repeatly
  if (!server) {
    server = createServer(app, null, app.binaryTypes || [])
  }

  context.callbackWaitsForEmptyEventLoop =
    app.callbackWaitsForEmptyEventLoop === true ? true : false

  const result = await proxy(server, event, context, 'PROMISE')
  return result.promise
}
