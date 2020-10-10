const CONFIGS = {
  templateUrl:
    'https://serverless-templates-1300862921.cos.ap-beijing.myqcloud.com/express-demo.zip',
  compName: 'express',
  compFullname: 'Express.js',
  defaultEntryFile: 'sls.js',
  handler: 'sl_handler.handler',
  runtime: 'Nodejs10.15',
  timeout: 3,
  memorySize: 128,
  namespace: 'default',
  description: 'Created by Serverless Component'
}

module.exports = CONFIGS
