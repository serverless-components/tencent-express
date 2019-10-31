[![Serverless Express Tencent Cloud](https://serverless-framework-1256773370.cos-website.ap-chengdu.myqcloud.com/component_pic/express.png)](http://serverless.com)

Deploy Express applications to Tencent Cloud using Serverless Components

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)
5. [Remove](#5-remove)

&nbsp;

### 1. Install

```console
$ npm install -g serverless
```

### 2. Create

Just create `serverless.yml` and `.env` files

```console
$ touch .env # your Tencent API Keys
$ touch app.js
$ touch serverless.yml
```

Add the access keys of a [Tencent CAM Role](https://console.cloud.tencent.com/cam/capi) with `AdministratorAccess` in the `.env` file, using this format: 

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
TENCENT_APP_ID=123
```

* If you don't have a Tencent Cloud account, you could [sign up](https://intl.cloud.tencent.com/register) first. 

Initialize a new NPM package and install express:

```
npm init              # then keep hitting enter
npm i --save express  # install express
```

create your express app in `app.js`:

```js
const express = require('express')
const app = express()

app.get('/', function(req, res) {
  res.send('Hello Express')
})

// don't forget to export!
module.exports = app
```

### 3. Configure

```yml
# serverless.yml

express:
  region: ap-shanghai
  component: '@serverless/tencent-express'
  inputs:
    region: ap-shanghai
#    functionName: eslam-function # SCF name
#    serviceName: mytest   Optional - APIGW service name, default to create a new serivce
#    serviceId: service-np1uloxw  Optional - APIGW service id, default to create a new serivce
#    code: ./code   Optional - default is current working directory
#    functionConf:
#      timeout: 10
#      memorySize: 128
#      environment:
#        variables:
#          TEST: vale
#      vpcConfig:
#        subnetId: ''
#        vpcId: ''
#    apigatewayConf:
#      protocol: https
#      environment: test
#      usagePlan:
#        # if dont't exists create a new 
#        usagePlanId: 1111
#        usagePlanName: slscmp # required
#        usagePlanDesc: sls create
#        maxRequestNum: 1000
#      auth:
#        serviceTimeout: 15
#        secretName: secret  # required
#        secretIds:
#          - AKIDNSdvdFcJ8GJ9th6qeZH0ll8r7dE6HHaSuchJ
```

* Main param description

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----      |
| region       | Optional             |ap-guangzhou |  |
| functionName | Optional             |             | ServerlessCloudFunction Name |
| serviceName  | Optional             |             | API-Gateway service name, default to create a new serivce |
| serviceId    | Optional             |             | API-Gateway service id, if it has will use this APII-Gateway service |
| code         | Optional             |             | Default is current working directory |
| functionConf | Optional             |             | Function configure |
| apigatewayConf| Optional            |             | API-Gateway configure |


* funtionConf param description

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----      |
| timeout      | Optional             | 3s          | The duration a function allowed to execute. Choose a value between 1 and 300 seconds; The default is 3 seconds. |
| memorySize   | Optional             |128M         | The size of memory size available to the function during execution. Specify a value between 128 MB (default) and 1,536 MB in 128 MB increments. |
| environment  | Optional             |             | Environment variable of the function |
| vpcConfig    | Optional             |             | VPC configuration of the function |


environment param description

| Param        |   Description |
| --------     |   :----      |
| variables    |   Environment variable array |


vpcConfig param description

| Param        |  Description |
| --------     |   :----      |
| subnetId     |  ID of the VPC |
| vpcId        | ID of the subnet |

* apigatewayConf param description

| Param        | Required/Optional    |  Description |
| --------     | :-----:              |   :----      |
| protocol      | Optional             | Frontend request type of the service, such as HTTP, HTTPS, HTTP and HTTPS. |
| environment   | Optional             |  The name of the environment to be published. Three environments are supported: test, prepub and release. |
| usagePlan  | Optional             |             |
| auth    | Optional            |           |

usagePlan param description

| Param        |  Description |
| --------     |   :----      |
| usagePlanId | User-defined usage plan id |
| usagePlanName | User-defined usage plan name |
| usagePlanDesc | User-defined usage plan description |
| maxRequestNum | Total number of requests allowed. If this is left empty, -1 will be used by default, indicating it’s disabled |


auth param description

| Param        |  Description |
| --------     |   :----      |
| serviceTimeout  |   Service timeout    |
| secretName     |    Secret name    |
| secretIds     |    Secret Id (Array)     |

### 4. Deploy

```
myApp (master)$ serverless --debug

  DEBUG ─ Endpoint ANY / already exists with id api-3n1p7a86.
  DEBUG ─ Updating api with api id api-3n1p7a86.
  DEBUG ─ Service with id api-3n1p7a86 updated.
  DEBUG ─ Deploying service with id service-np1uloxw.
  DEBUG ─ Deployment successful for the api named express.TencentApiGateway in the ap-guangzhou region.

  express:
    url: http://service-np1uloxw-1300415943.gz.apigw.tencentcs.com/release

  84s › express › done

myApp (master)$
```

You can now visit the output URL in the browser, and you should see the express response.

### 5. Remove

```
myApp (master)$ serverless remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removed function eslam-function successful

  17s › express › done

myApp (master)$
```

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
