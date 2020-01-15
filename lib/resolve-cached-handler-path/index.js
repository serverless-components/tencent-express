const fse = require('fs-extra')
const generateHandler = require('./generate')
const resolvePath = require('./resolve-path')

module.exports = async (inputs) => {
  const cachedHandlerPath = resolvePath(inputs)
  if (!(await fse.pathExists(cachedHandlerPath))) {
    await generateHandler(inputs)
  }
  return cachedHandlerPath
}
