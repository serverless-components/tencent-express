const os = require('os')
const ensureIterable = require('type/iterable/ensure')
const ensureString = require('type/string/ensure')
const path = require('path')
const fs = require('fs')
const { Component } = require('@serverless/core')
const { bundler } = require('@ygkit/bundler')
const pkg = require('../package.json')

const DEFAULTS = {
  runtime: 'Nodejs10.15',
  framework: 'express'
}

class TencentComponent extends Component {
  async default(inputs = {}) {
    inputs.include = ensureIterable(inputs.include, { default: [], ensureItem: ensureString })
    inputs.runtime = ensureString(inputs.runtime, { default: DEFAULTS.runtime })

    const cachePath = path.join(
      os.homedir(),
      `.serverless/cache/tencent-${DEFAULTS.framework}`,
      pkg.version,
      'serverless-handler.js'
    )

    if (!fs.existsSync(cachePath)) {
      this.context.debug('Generating serverless handler...')
      await bundler({
        input: path.join(__dirname, 'shims/handler.js'),
        output: cachePath
      })
      this.context.debug('Generated serverless handler successfully.')
    }

    inputs.handler = `${path.basename(cachePath, '.js')}.handler`
    inputs.include.push(cachePath)

    const Framework = await this.load('@serverless/tencent-framework')

    const framworkOutpus = await Framework({
      ...inputs,
      ...{
        framework: DEFAULTS.framework
      }
    })

    this.state = framworkOutpus
    await this.save()
    return framworkOutpus
  }

  async remove(inputs = {}) {
    const Framework = await this.load('@serverless/tencent-framework')
    await Framework.remove(inputs)
    this.state = {}
    await this.save()
    return {}
  }
}

module.exports = TencentComponent
