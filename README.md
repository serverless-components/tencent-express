[![Serverless Express Tencent Cloud](https://s3.amazonaws.com/assets.github.serverless/github_readme_serverless_express_tencent.png)](http://serverless.com)

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
  component: '/Users/dfounderliu/Desktop/temp/tencent-express'
  inputs:
    region: ap-shanghai
#   functionName: eslam-function # SCF name
#   serviceName: mytest   Optional - APIGW service name, default to create a new serivce
#   serviceId: service-np1uloxw  Optional - APIGW service id, default to create a new serivce
#   code: ./code   Optional - default is current working directory
    functionConf:
      timeout: 10
      memorySize: 128
    apigatewayConf:
      protocol: https
      environment: test

```

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
