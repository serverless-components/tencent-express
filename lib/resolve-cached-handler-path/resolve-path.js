const os = require('os')
const path = require('path')
const { version } = require('../../package')

module.exports = ({ lambdaHandlerMode }) =>
  path.join(
    os.homedir(),
    '.serverless/cache/tencent-express',
    version,
    `serverless-handler${lambdaHandlerMode === 'dev' ? '-dev' : ''}.js`
  )
