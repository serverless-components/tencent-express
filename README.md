[![Serverless Express Tencent Cloud](https://img.serverlesscloud.cn/2020210/1581352135771-express.png)](http://serverless.com)

- [请点击这里查看英文版部署文档](./README.en.md)

&nbsp;

# 腾讯云 Express 组件

## 简介

Express 组件通过使用 serverless-tencent 的基础组件如 API 网关组件，SCF 组件等，快速，方便的在腾讯云创建，配置和管理一个 Express 框架。
<img align="right" width="400" src="https://scf-dev-tools-1253665819.cos.ap-guangzhou.myqcloud.com/express_demo_light_sm_resize.gif" />

## 快速开始

通过 Express 组件，对一个 Express 应用进行完整的创建，配置，部署和删除等操作。支持命令如下：

1. [安装](#1-安装)
2. [创建](#2-创建)
3. [配置](#3-配置)
4. [部署](#4-部署)
5. [移除](#5-移除)

### 1. 安装

通过 npm 安装 serverless

```console
$ npm install -g serverless
```

### 2. 创建

本地创建 `serverless.yml` 文件：

```console
$ touch serverless.yml
```

初始化一个新的 npm 包，并安装 Express：

```
npm init              # 创建后持续回车
npm i --save express  # 安装express
```

创建一个 `app.js`文件，并在其中创建您的 Express App：

```js
const express = require('express')
const app = express()

app.get('/', function(req, res) {
  res.send('Hello Express')
})

// set binary types
// app.binaryTypes = [*/*];

// don't forget to export!
module.exports = app
```

### 3. 配置

在 serverless.yml 中进行如下配置

```yml
# serverless.yml

express:
  component: '@serverless/tencent-express'
  inputs:
    region: ap-guangzhou
    runtime: Nodejs8.9
```

- [点击此处查看配置文档](https://github.com/serverless-tencent/tencent-express/blob/master/docs/configure.md)

### 4. 部署

如您的账号未[登陆](https://cloud.tencent.com/login)或[注册](https://cloud.tencent.com/register)腾讯云，您可以直接通过`微信`扫描命令行中的二维码进行授权登陆和注册。

通过`sls`命令进行部署，并可以添加`--debug`参数查看部署过程中的信息

```
$ sls --debug

  DEBUG ─ Resolving the template's static variables.
  DEBUG ─ Collecting components from the template.
  DEBUG ─ Downloading any NPM components found in the template.
  DEBUG ─ Analyzing the template's components dependencies.
  DEBUG ─ Creating the template's components graph.
  DEBUG ─ Syncing template state.
  DEBUG ─ Executing the template's components graph.
  DEBUG ─ Generating serverless handler...
  DEBUG ─ Generated serverless handler successfully.
  DEBUG ─ Compressing function express-test file to /Users/yugasun/Desktop/Develop/serverless/tencent-express/example/.serverless/express-test.zip.
  DEBUG ─ Compressed function express-test file successful
  DEBUG ─ Uploading service package to cos[sls-cloudfunction-ap-guangzhou-code]. sls-cloudfunction-default-express-test-1584355868.zip
  DEBUG ─ Uploaded package successful /Users/yugasun/Desktop/Develop/serverless/tencent-express/example/.serverless/express-test.zip
  DEBUG ─ Creating function express-test
  DEBUG ─ Created function express-test successful
  DEBUG ─ Setting tags for function express-test
  DEBUG ─ Creating trigger for function express-test
  DEBUG ─ Deployed function express-test successful
  DEBUG ─ Starting API-Gateway deployment with name ap-guangzhou-apigateway in the ap-guangzhou region
  DEBUG ─ Service with ID service-97m9tn6o created.
  DEBUG ─ API with id api-pvsf67t8 created.
  DEBUG ─ Deploying service with id service-97m9tn6o.
  DEBUG ─ Deployment successful for the api named ap-guangzhou-apigateway in the ap-guangzhou region.

  ExpressFunc:
    functionName:        express-test
    functionOutputs:
      ap-guangzhou:
        Name:        express-test
        Runtime:     Nodejs8.9
        Handler:     serverless-handler.handler
        MemorySize:  128
        Timeout:     3
        Region:      ap-guangzhou
        Namespace:   default
        Description: This is a template function
    region:              ap-guangzhou
    apiGatewayServiceId: service-97m9tn6o
    url:                 https://service-97m9tn6o-1251556596.gz.apigw.tencentcs.com/test/
    cns:                 (empty array)

  14s › ExpressFunc › done
```

部署完毕后，可以在浏览器中访问返回的链接，看到对应的 express 返回值。

### 5. 移除

通过以下命令移除部署的 Express 服务：

```
$ sls remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removed function express-test successful
  DEBUG ─ Removing any previously deployed API. api-pvsf67t8
  DEBUG ─ Removing any previously deployed service. service-97m9tn6o

  6s › ExpressFunc › done
```

### 账号配置（可选）

当前默认支持 CLI 扫描二维码登录，如您希望配置持久的环境变量/秘钥信息，也可以本地创建 `.env` 文件

```console
$ touch .env # 腾讯云的配置信息
```

在 `.env` 文件中配置腾讯云的 SecretId 和 SecretKey 信息并保存

如果没有腾讯云账号，可以在此[注册新账号](https://cloud.tencent.com/register)。

如果已有腾讯云账号，可以在[API 密钥管理](https://console.cloud.tencent.com/cam/capi)中获取 `SecretId` 和`SecretKey`.

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
```

### 还支持哪些组件？

可以在 [Serverless Components](https://github.com/serverless/components) repo 中查询更多组件的信息。
