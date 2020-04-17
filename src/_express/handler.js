const fs = require('fs')
const path = require('path')
const { createServer, proxy } = require('tencent-serverless-http')

exports.handler = async (event, context) => {
  const userSls = path.join(__dirname, '..', 'sls.js')
  let app
  if (fs.existsSync(userSls)) {
    // load the user provided app
    app = await require(userSls)
  } else {
    // load the built-in default app
    app = require('./sls.js')
  }

  const server = createServer(app)
  return proxy(server, event, context, 'PROMISE').promise
}
