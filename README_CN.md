[![Serverless Express Tencent Cloud](https://s3.amazonaws.com/assets.github.serverless/github_readme_serverless_express_tencent.png)](http://serverless.com)

Deploy Express applications to Tencent Cloud using Serverless Components

&nbsp;

# 腾讯云Express组件

## 简介

Express 组件通过使用 serverless-tencent 的基础组件如API网关组件，SCF组件等，快速，方便的在腾讯云创建，配置和管理一个Express框架。

## 快速开始

通过 Express 组件，对一个 Express应用进行完整的创建，配置，部署和删除等操作。支持命令如下：

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

本地创建 `serverless.yml` 和 `.env` 两个文件

```console
$ touch serverless.yml
$ touch .env # 腾讯云的配置信息
```

在 `.env` 文件中配置腾讯云的 APPID，SecretId 和 SecretKey 信息并保存

如果没有腾讯云账号，可以在此[注册新账号](https://cloud.tencent.com/register)。

如果已有腾讯云账号，可以在[API密钥管理
](https://console.cloud.tencent.com/cam/capi)中获取`APPID`, `SecretId` 和`SecretKey`.

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
TENCENT_APP_ID=123
```

初始化一个新的NPM包，并且安装express:
```
npm init              # 创建后持续回车
npm i --save express  # 安装express
```

创建一个 `app.js`文件，并在其中创建你的express app:
```js
const express = require('express')
const app = express()

app.get('/', function(req, res) {
  res.send('Hello Express')
})

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
    functionName: eslam-function # SCF函数名
    # serviceName: mytest   可选，API网关的服务名，默认会创建一个新的服务
    # serviceId: service-np1uloxw   可选，API网关的服务Id，默认会创建一个新的服务
    # code: ./code   可选，默认是当前的工作目录
```

### 4. 部署

通过如下命令进行部署，并查看部署过程中的信息

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
部署完毕后，可以在浏览器中访问返回的链接，看到对应的express返回值。

### 5. 移除

通过以下命令移除部署的存储桶

```
myApp (master)$ serverless remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removed function eslam-function successful

  17s › express › done

myApp (master)$
```

### 还支持哪些组件？

可以在 [Serverless Components](https://github.com/serverless/components) repo 中查询更多组件的信息。
