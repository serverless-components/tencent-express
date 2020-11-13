const frameworks = {
  express: {
    injectSlsSdk: true,
    templateUrl:
      'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/express-demo.zip',
    runtime: 'Nodejs10.15',
    defaultEntryFile: 'sls.js',
    defaultStatics: [{ src: 'public', targetDir: '/' }]
  }
}

const CONFIGS = {
  // support metrics frameworks
  supportMetrics: ['express', 'next', 'nuxt'],
  region: 'ap-guangzhou',
  description: 'Created by Serverless Component',
  handler: 'sl_handler.handler',
  timeout: 10,
  memorySize: 128,
  namespace: 'default',
  cos: {
    lifecycle: [
      {
        status: 'Enabled',
        id: 'deleteObject',
        filter: '',
        expiration: { days: '10' },
        abortIncompleteMultipartUpload: { daysAfterInitiation: '10' }
      }
    ]
  },
  cdn: {
    autoRefresh: true,
    forceRedirect: {
      switch: 'on',
      redirectType: 'https',
      redirectStatusCode: 301
    },
    https: {
      switch: 'on',
      http2: 'on'
    }
  }
}

module.exports = () => {
  const frameworkConfigs = frameworks.express
  return {
    ...CONFIGS,
    ...frameworkConfigs
  }
}
