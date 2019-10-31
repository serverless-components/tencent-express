[![Serverless Express Tencent Cloud](https://s3.amazonaws.com/assets.github.serverless/github_readme_serverless_express_tencent.png)](http://serverless.com)

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
    region: ap-shanghai # 
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

* 主要参数说明

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----:      |
| region       | 可选             |ap-guangzhou |  |
| functionName | 可选             |             | SCF函数名 |
| serviceName  | 可选             |             | API网关服务名 |
| serviceId    | 可选             |             | API网关ID名 |
| code         | 可选             |             | 代码目录 |
| functionConf | 可选             |             | 函数配置 |
| apigatewayConf| 可选            |             | API网关配置 |


* funtionConf 参数说明

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----:      |
| timeout      | 可选             | 3s          | 函数最长执行时间，单位为秒，可选值范围 1-300 秒，默认为 3 秒 |
| memorySize   | 可选             |128M         | 函数运行时内存大小，默认为 128M，可选范围 128MB-1536MB，并且以 128MB 为阶梯 |
| environment  | 可选             |             | 函数的环境变量 |
| -- variables |                      |             | 环境变量数组 |
| vpcConfig    | 可选             |             | 函数的私有网络配置 |
| -- subnetId  |                      |             | 私有网络 的 id |
| -- vpcId     |                      |             | 子网的 id |

* apigatewayConf 参数说明

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----:      |
| protocol      | 可选             |          | 服务的前端请求类型。如 HTTP、HTTPS、HTTP 和 HTTPS。 |
| environment   | 可选             |         | 待发布的环境名称，当前支持三个环境，测试：test，预发：prepub，线上：release |
| usagePlan  | 可选             |             |  |
| -- usagePlanId |                      |             | 用户自定义的使用计划ID |
| -- usagePlanName |                      |             | 用户自定义的使用计划名称 |
| -- usagePlanDesc |                      |             | 用户自定义的使用计划描述 |
| -- maxRequestNum |                      |             | 请求配额总数，不传为-1表示不开启 |
| auth    | 可选            |             |  |
| -- serviceTimeout  |                      |             |  |
| -- secretName     |                      |             |  |
| -- secretIds     |                      |             |  |

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
