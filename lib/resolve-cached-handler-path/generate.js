const path = require('path')
const fse = require('fs-extra')
const webmake = require('webmake')
const Terser = require('terser')
const resolvePath = require('./resolve-path')

const handlerModulePath = path.join(__dirname, '../../lambda-handler.js')

module.exports = async ({ lambdaHandlerMode }) => {
  const cachedHandlerPath = resolvePath({ lambdaHandlerMode })
  let bundleCode = await new Promise((resolve, reject) =>
    webmake(handlerModulePath, { ignoreErrors: true, cjs: true }, (error, code) => {
      error ? reject(error) : resolve(code)
    })
  )
  if (lambdaHandlerMode !== 'dev') {
    const minifyResult = Terser.minify(bundleCode)
    if (minifyResult.error) {
      throw minifyResult.error
    }
    bundleCode = minifyResult.code
  }
  await fse.ensureDir(path.dirname(cachedHandlerPath))
  return fse.writeFile(cachedHandlerPath, bundleCode)
}
