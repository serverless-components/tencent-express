[![Serverless Express Tencent Cloud](https://s3.amazonaws.com/assets.general.serverless.com/component_express_tencent/readme-express-tencent-serverless.png)](http://serverless.com)

Easily deploy Express.js applications to Tencent Cloud's serverless infrastructure using this Serverless Framework Component.  Your application will auto-scale, never charge you for idle time, and require little-to-zero administration.

&nbsp;
<img align="right" width="400" src="https://scf-dev-tools-1253665819.cos.ap-guangzhou.myqcloud.com/express_demo_light_sm_resize.gif" />

* [请点击这里查看中文版部署文档](./README_CN.md)

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
  component: '@serverless/tencent-express'
  inputs:
    region: ap-shanghai
```

* [Click here to view the configuration document](https://github.com/serverless-tencent/tencent-express/blob/master/docs/configure.md)

### 4. Deploy

```
$ sls --debug

  DEBUG ─ Resolving the template's static variables.
  DEBUG ─ Collecting components from the template.
  DEBUG ─ Downloading any NPM components found in the template.
  DEBUG ─ Analyzing the template's components dependencies.
  DEBUG ─ Creating the template's components graph.
  DEBUG ─ Syncing template state.
  DEBUG ─ Executing the template's components graph.
  DEBUG ─ Compressing function ExpressComponent_7xRrrd file to /Users/dfounderliu/Desktop/temp/code/.serverless/ExpressComponent_7xRrrd.zip.
  DEBUG ─ Compressed function ExpressComponent_7xRrrd file successful
  DEBUG ─ Uploading service package to cos[sls-cloudfunction-ap-shanghai-code]. sls-cloudfunction-default-ExpressComponent_7xRrrd-1572512568.zip
  DEBUG ─ Uploaded package successful /Users/dfounderliu/Desktop/temp/code/.serverless/ExpressComponent_7xRrrd.zip
  DEBUG ─ Creating function ExpressComponent_7xRrrd
  DEBUG ─ Created function ExpressComponent_7xRrrd successful
  DEBUG ─ Starting API-Gateway deployment with name express.TencentApiGateway in the ap-shanghai region
  DEBUG ─ Using last time deploy service id service-n0vs2ohb
  DEBUG ─ Updating service with serviceId service-n0vs2ohb.
  DEBUG ─ Endpoint ANY / already exists with id api-9z60urs4.
  DEBUG ─ Updating api with api id api-9z60urs4.
  DEBUG ─ Service with id api-9z60urs4 updated.
  DEBUG ─ Deploying service with id service-n0vs2ohb.
  DEBUG ─ Deployment successful for the api named express.TencentApiGateway in the ap-shanghai region.

  express: 
    region:              ap-shanghai
    functionName:        ExpressComponent_7xRrrd
    apiGatewayServiceId: service-n0vs2ohb
    url:                 http://service-n0vs2ohb-1300415943.ap-shanghai.apigateway.myqcloud.com/release/

  36s › express › done
```

You can now visit the output URL in the browser, and you should see the express response.

### 5. Remove

```
$ sls remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removed function ExpressComponent_MHrAzr successful
  DEBUG ─ Removing any previously deployed API. api-kf2hxrhc
  DEBUG ─ Removing any previously deployed service. service-4ndfl6pz

  13s › express › done
```

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
