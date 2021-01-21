[![Serverless Components](https://img.serverlesscloud.cn/2020210/1581352135771-express.png)](http://serverless.com)

<br/>

**腾讯云 Express 组件** ⎯⎯⎯ 通过使用 [Tencent Serverless Framework](https://github.com/serverless/components/tree/cloud)，基于云上 Serverless 服务（如网关、云函数等），实现“0”配置，便捷开发，极速部署你的 Express 应用，Express 组件支持丰富的配置扩展，提供了目前最易用、低成本并且弹性伸缩的 Express 项目开发/托管能力。
<br/>

特性介绍：

- [x] **按需付费** - 按照请求的使用量进行收费，没有请求时无需付费
- [x] **"0"配置** - 只需要关心项目代码，之后部署即可，Serverless Framework 会搞定所有配置。
- [x] **极速部署** - 仅需几秒，部署你的整个 Express 应用。
- [x] **实时日志** - 通过实时日志的输出查看业务状态，便于直接在云端开发应用。
- [x] **云端调试** - 针对 Node.js 框架支持一键云端调试能力，屏蔽本地环境的差异。
- [x] **便捷协作** - 通过云端的状态信息和部署日志，方便的进行多人协作开发。
- [x] **自定义域名** - 支持配置自定义域名及 HTTPS 访问

<br/>

快速开始：

1. [**安装**](#1-安装)
2. [**创建**](#2-创建)
3. [**部署**](#3-部署)
4. [**配置**](#4-配置)
5. [**开发调试**](#5-开发调试)
6. [**查看状态**](#6-查看状态)
7. [**移除**](#7-移除)

更多资源：

- [**架构说明**](#架构说明)
- [**账号配置**](#账号配置)

&nbsp;

### 1. 安装

通过 npm 安装最新版本的 Serverless Framework

```bash
$ npm install -g serverless
```

### 2. 创建

通过如下命令和模板链接，快速创建一个 Express 应用：

```bash
$ serverless init express-starter --name example
$ cd example
```

### 3. 部署

在 `serverless.yml` 文件所在的项目根目录，运行以下指令进行部署：

```bash
$ serverless deploy
```

部署时需要进行身份验证，如您的账号未 [登陆](https://cloud.tencent.com/login) 或 [注册](https://cloud.tencent.com/register) 腾讯云，您可以直接通过 `微信` 扫描命令行中的二维码进行授权登陆和注册。

> 注意: 如果希望查看更多部署过程的信息，可以通过`serverless deploy --debug` 命令查看部署过程中的实时日志信息。

部署完成后，控制台会打印相关的输出信息，您可以通过 `${output:${stage}:${app}:apigw.url}` 的形式在其他 `serverless` 组件中引用该组件的 API 网关访问链接（或通过类似的形式引用该组建其他输出结果），具体的，可以查看完成的输出文档：

- [点击此处查看输出文档](https://github.com/serverless-components/tencent-express/tree/master/docs/output.md)

### 4. 配置

Express 组件支持 0 配置部署，也就是可以直接通过配置文件中的默认值进行部署。但你依然可以修改更多可选配置来进一步开发该 Express 项目。

以下是 Express 组件的 `serverless.yml`配置示例：

```yml
# serverless.yml

component: express # (required) name of the component. In that case, it's express.
name: expressDemo # (required) name of your express component instance.
org: orgDemo # (optional) serverless dashboard org. default is the first org you created during signup.
app: appDemo # (optional) serverless dashboard app. default is the same as the name property.
stage: dev # (optional) serverless dashboard stage. default is dev.

inputs:
  src:
    src: ./ # (optional) path to the source folder. default is a hello world app.
    exclude:
      - .env
  functionName: expressDemo
  region: ap-guangzhou
  runtime: Nodejs10.15
  apigatewayConf:
    protocols:
      - http
      - https
    environment: release
```

点此查看[全量配置及配置说明](https://github.com/serverless-components/tencent-express/tree/master/docs/configure.md)

当你根据该配置文件更新配置字段后，再次运行 `serverless deploy` 或者 `serverless` 就可以更新配置到云端。

### 5. 开发调试

部署了 Express.js 应用后，可以通过开发调试能力对该项目进行二次开发，从而开发一个生产应用。在本地修改和更新代码后，不需要每次都运行 `serverless deploy` 命令来反复部署。你可以直接通过 `serverless dev` 命令对本地代码的改动进行检测和自动上传。

可以通过在 `serverless.yml`文件所在的目录下运行 `serverless dev` 命令开启开发调试能力。

`serverless dev` 同时支持实时输出云端日志，每次部署完毕后，对项目进行访问，即可在命令行中实时输出调用日志，便于查看业务情况和排障。

除了实时日志输出之外，针对 Node.js 应用，当前也支持云端调试能力。在开启 `serverless dev` 命令之后，将会自动监听远端端口，并将函数的超时时间临时配置为 900s。此时你可以通过访问 chrome://inspect/#devices 查找远端的调试路径，并直接对云端代码进行断点等调试。在调试模式结束后，需要再次部署从而将代码更新并将超时时间设置为原来的值。详情参考[开发模式和云端调试](https://cloud.tencent.com/document/product/1154/43220)。

### 6. 查看状态

在`serverless.yml`文件所在的目录下，通过如下命令查看部署状态：

```
$ serverless info
```

### 7. 移除

在`serverless.yml`文件所在的目录下，通过以下命令移除部署的 Express 服务。移除后该组件会对应删除云上部署时所创建的所有相关资源。

```
$ serverless remove
```

和部署类似，支持通过 `serverless remove --debug` 命令查看移除过程中的实时日志信息。

## 架构说明

Express 组件将在腾讯云账户中使用到如下 Serverless 服务：

- [x] **API 网关** - API 网关将会接收外部请求并且转发到 SCF 云函数中。
- [x] **SCF 云函数** - 云函数将承载 Express.js 应用。
- [x] **CAM 访问控制** - 该组件会创建默认 CAM 角色用于授权访问关联资源。
- [x] **COS 对象存储** - 为确保上传速度和质量，云函数压缩并上传代码时，会默认将代码包存储在特定命名的 COS 桶中。
- [x] **SSL 证书服务** - 如果你在 yaml 文件中配置了 `apigatewayConf.customDomains` 字段，需要做自定义域名绑定并开启 HTTPS 时，也会用到证书管理服务和域名服务。Serverless Framework 会根据已经备案的域名自动申请并配置 SSL 证书。

## 账号配置

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

## 静态资源服务

如果想要支持返回静态资源，比如图片之类的，需要在入口文件 `sls.js` 中指定相关 `MIME` 类型的文件为二进制，这样云函数在返回请求结果给 API 网关是，会对指定类型进行 `Base64` 编码，最终返回给客户端才能正常显示。如下：

```js
const express = require('express')
const app = express()

// Routes
// ...

app.binaryTypes = ['*/*']

module.exports = app
```

`['*/*']` 代表所有文件类型将进行 `Base64` 编码，如果需要定制化，可以配置为 `['image/png']`，意思是指定 `png` 格式的图片类型。

更多文件类型的 `MIME` 类型，可参考 [mime-db](https://github.com/jshttp/mime-db/blob/master/db.json)。

### slsInitialize 应用初始化

有些时候，Express 服务在启动前，需要进行一个初始化操作，比如数据库建连，就可以通过在 Express 实例对象上添加 `slsInitialize` 函数来实现，如下：

```js
const express = require('express')
const mysql = require('mysql2/promise')

const app = new express()

// ...

app.slsInitialize = async () => {
  app.db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'test'
  })
}

// don't forget to export!
module.exports = app
```

这样应用部署到云函数后，在函数服务逻辑执行前，会先执行 `slsInitialize()` 函数，来初始化数据库连接。

## License

MIT License

Copyright (c) 2020 Tencent Cloud, Inc.
