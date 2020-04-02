const path = require('path')
const { copySync } = require('fs-extra')

/*
 * Pauses execution for the provided miliseconds
 *
 * @param ${number} wait - number of miliseconds to wait
 */
const sleep = async (wait) => new Promise((resolve) => setTimeout(() => resolve(), wait))

/*
 * Generates a random id
 */
const generateId = () =>
  Math.random()
    .toString(36)
    .substring(6)
/*
 * Packages express app and injects shims and sdk
 *
 * @param ${instance} instance - the component instance
 * @param ${object} config - the component config
 */
const packageExpress = async (instance, inputs) => {
  console.log(`Packaging Express.js application...`)

  // unzip source zip file
  console.log(`Unzipping ${inputs.code.src || 'files'}...`)
  const sourceDirectory = await instance.unzip(inputs.code.src)
  console.log(`Files unzipped into ${sourceDirectory}...`)

  // add shim to the source directory
  console.log(`Installing Express + SCF handler...`)
  copySync(path.join(__dirname, '_express'), path.join(sourceDirectory, '_express'))

  // add sdk to the source directory, add original handler
  console.log(`Installing Serverless Framework SDK...`)
  instance.state.handler = await instance.addSDK(sourceDirectory, '_express/handler.handler')

  if (!inputs.code.src) {
    // add default express app
    console.log(`Installing Default Express App...`)
    copySync(path.join(__dirname, '_src'), path.join(sourceDirectory, '_src'))
  }
  // zip the source directory with the shim and the sdk

  console.log(`Zipping files...`)
  const zipPath = await instance.zip(sourceDirectory)
  console.log(`Files zipped into ${zipPath}...`)

  // save the zip path to state for lambda to use it
  instance.state.zipPath = zipPath

  return zipPath
}

module.exports = {
  generateId,
  sleep,
  packageExpress
}
