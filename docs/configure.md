# 配置文档

## 全部配置

```yml
# serverless.yml

org: orgDemo # (可选) 用于记录组织信息，默认值为您的腾讯云账户 appid，必须为字符串
app: appDemo # (可选) 用于记录组织信息. 默认与name相同，必须为字符串
stage: dev # (可选) 用于区分环境信息，默认值是 dev

component: framework # (必选) 组件名称，在该实例中为express
name: frameworkDemo # 必选) 组件实例名称.

inputs:
  framework: express
  region: ap-guangzhou # 云函数所在区域
  entryFile: sls.js # 自定义 server 的入口文件名，默认为 sls.js，如果不想修改文件名为 sls.js 可以自定义
  src:
    src: ./ # 本地需要打包的文件目录
    exclude: # 被排除的文件或目录
      - .env
      # - 'node_modules/**'
  faas: # 函数配置相关
    name: expressDemo # 云函数名称
    runtime: Nodejs10.15 # 运行环境
    timeout: 10 # 超时时间，单位秒
    eip: false # 是否固定出口IP
    memorySize: 128 # 内存大小，单位MB
    environments: #  环境变量
      - envKey: TEST
        envVal: 123
    vpc: # 私有网络配置
      vpcId: vpc-xxxx # 私有网络的Id
      subnetId: subnet-xxxx # 子网ID
    layers:
      - name: layerName #  layer名称
        version: 1 #  版本
  apigw: #  api网关配置
    isDisabled: false # 是否禁用自动创建 API 网关功能
    id: service-xxx # api网关服务ID
    name: mytest # api网关服务名称
    description: mytest # api网关描述
    cors: true #  允许跨域
    protocols:
      - http
      - https
    environment: test
    timeout: 15
    customDomains: # 自定义域名绑定
      - domain: abc.com # 待绑定的自定义的域名
        certificateId: abcdefg # 待绑定自定义域名的证书唯一 ID
        # 如要设置自定义路径映射，请设置为 false
        isDefaultMapping: false
        # 自定义路径映射的路径。使用自定义映射时，可一次仅映射一个 path 到一个环境，也可映射多个 path 到多个环境。并且一旦使用自定义映射，原本的默认映射规则不再生效，只有自定义映射路径生效。
        pathMappingSet:
          - path: /
            environment: release
        protocols: # 绑定自定义域名的协议类型，默认与服务的前端协议一致。
          - http # 支持http协议
          - https # 支持https协议

  # 项目中静态资源自动托管到对象存储
  static:
    cos:
      bucket: static-bucket
      acl:
        permissions: public-read
      sources:
        - src: .next/static
          targetDir: /_next/static
        - src: public
          targetDir: /
    cdn:
      area: mainland
      domain: abc.com
      autoRefresh: true
      refreshType: delete
      forceRedirect:
        switch: on
        redirectType: https
        redirectStatusCode: 301
      https:
        http2: on
        certId: 'abc'
```

## 配置描述

主要的参数

| 参数名称                     | 必选 |     默认值     | 描述                                                     |
| ---------------------------- | :--: | :------------: | :------------------------------------------------------- |
| framework                    |  是  |                | 项目使用的 Web 框架                                      |
| src                          |  是  |                | 代码目录, 如果是对象, 配置参数参考 [执行目录](#执行目录) |
| region                       |  否  | `ap-guangzhou` | 项目部署所在区域                                         |
| entryFile                    |  否  |    `sls.js`    | 自定义 server 的入口文件名                               |
| [faas](#函数配置)            |  否  |                | 函数配置                                                 |
| [apigw](#API-网关配置)       |  否  |                | API 网关配置                                             |
| [static](#静态资源-CDN-配置) |  否  |                | 静态资源 CDN 配置                                        |

> 注意：目前 `framework` 支持 Web 框架有 `express`、`koa`、`egg`、`next`、`nuxt`、`nest`、`laravel`、`thinkphp`、`flask`。

## 执行目录

| 参数名称 | 必选 |   类型   | 默认值 | 描述                                                                      |
| -------- | :--: | :------: | :----: | :------------------------------------------------------------------------ |
| src      |  否  |  string  |        | 代码路径。与 obejct 不能同时存在。                                        |
| exclude  |  否  | string[] |        | 不包含的文件或路径, 遵守 [glob 语法](https://github.com/isaacs/node-glob) |
| bucket   |  否  |  string  |        | bucket 名称。                                                             |
| obejct   |  否  |  string  |        | 部署的代码在存储桶中的路径。                                              |

> **注意**：如果配置了 src，表示部署 src 的代码并压缩成 zip 后上传到 bucket-appid 对应的存储桶中；如果配置了 obejct，表示获取 bucket-appid 对应存储桶中 obejct 对应的代码进行部署。

比如需要忽略项目的 `node_modules` 目录，可以配置如下：

```yaml
exclude:
  - 'node_modules/**'
```

## 层配置

| 参数名称 | 必选 |  类型  | 默认值 | 描述     |
| -------- | :--: | :----: | :----: | :------- |
| name     |  否  | string |        | 层名称   |
| version  |  否  | string |        | 层版本号 |

### 指定区配置

| 参数名称               | 必选 | 类型   | 默认值 | 函数         |
| ---------------------- | :--: | ------ | ------ | ------------ |
| [faas](#函数配置)      |  否  | obejct |        | 函数配置     |
| [apigw](#API-网关配置) |  否  | obejct |        | API 网关配置 |

### 函数配置

参考: https://cloud.tencent.com/document/product/583/18586

| 参数名称     | 必选 |   类型   |    默认值     | 描述                                                                |
| ------------ | :--: | :------: | :-----------: | :------------------------------------------------------------------ |
| runtime      |  否  |  string  | `Nodejs10.15` | 执行环境, 目前支持: Nodejs6.10, Nodejs8.9, Nodejs10.15, Nodejs12.16 |
| name         |  否  |  string  |               | 云函数名称                                                          |
| timeout      |  否  |  number  |      `3`      | 函数最长执行时间，单位为秒，可选值范围 1-900 秒，默认为 3 秒        |
| memorySize   |  否  |  number  |     `128`     | 函数运行时内存大小，可选范围 64、128MB-3072MB，并且以 128MB 为阶梯  |
| environments |  否  | object[] |               | 函数的环境变量, 参考 [环境变量](#环境变量)                          |
| vpc          |  否  |  obejct  |               | 函数的 VPC 配置, 参考 [VPC 配置](#VPC-配置)                         |
| eip          |  否  | boolean  |    `false`    | 是否固定出口 IP                                                     |
| layers       |  否  | obejct[] |               | 云函数绑定的 layer, 配置参数参考 [层配置](#层配置)                  |

> 此处只是列举，`faas` 参数支持 [scf](https://github.com/serverless-components/tencent-scf/tree/master/docs/configure.md) 组件的所有基础配置（ `events` 除外）

##### 环境变量

| 参数名称 | 类型   | 描述           |
| -------- | ------ | :------------- |
| envKey   | string | 环境变量 key   |
| envVal   | string | 环境变量 value |

##### VPC 配置

| 参数名称 | 类型   | 描述    |
| -------- | ------ | :------ |
| vpcId    | string | VPC ID  |
| subnetId | string | 子网 ID |

### API 网关配置

| 参数名称      | 必选 | 类型     | 默认值       | 描述                                                             |
| ------------- | :--: | :------- | :----------- | :--------------------------------------------------------------- |
| id            |  否  |          |              | API 网关服务 ID,如果存在将使用这个 API 网关服务                  |
| name          |  否  |          | `serverless` | API 网关服务名称, 默认创建一个新的服务名称                       |
| description   |  否  |          |              | API 网关服务描述                                                 |
| protocols     |  否  | string[] | `['http']`   | 前端请求的类型，如 http，https，http 与 https                    |
| environment   |  否  | string   | `release`    | 发布环境. 目前支持三种发布环境: test、prepub、release.           |
| cors          |  否  | boolean  | `false`      | 开启跨域。默认值为否。                                           |
| timeout       |  否  | number   | `15`         | Api 超时时间，单位: 秒                                           |
| isDisabled    |  否  | boolean  | `false`      | 关闭自动创建 API 网关功能。默认值为否，即默认自动创建 API 网关。 |
| customDomains |  否  | obejct[] |              | 自定义 API 域名配置, 参考 [自定义域名](#自定义域名)              |

##### 自定义域名

Refer to: https://cloud.tencent.com/document/product/628/14906

| 参数名称  | 必选 |   类型   | 默认值  | 描述                                                                        |
| --------- | :--: | :------: | :-----: | :-------------------------------------------------------------------------- |
| domain    |  是  |  string  |         | 待绑定的自定义的域名。                                                      |
| certId    |  否  |  string  |         | 待绑定自定义域名的证书唯一 ID，如果设置了 type 为 `https`，则为必选         |
| customMap |  否  |  string  | `false` | 是否自定义路径映射。为 `true` 时，表示自定义路径映射，此时 `pathMap` 必填。 |
| pathMap   |  否  | object[] |  `[]`   | 自定义路径映射的路径。 参考 [自定义路径映射](#自定义路径映射)               |
| protocol  |  否  | string[] |         | 绑定自定义域名的协议类型，默认与服务的前端协议一致。                        |

#### 自定义路径映射

| 参数名称    | 必选 | 类型   | Description    |
| ----------- | :--: | :----- | :------------- |
| path        |  是  | string | 自定义映射路径 |
| environment |  是  | string | 自定义映射环境 |

> 使用自定义映射时，可一次仅映射一个 path 到一个环境，也可映射多个 path 到多个环境。并且一旦使用自定义映射，原本的默认映射规则不再生效，只有自定义映射路径生效。

### 静态资源 CDN 配置

| 参数名称 | 必选 |  类型  | 默认值 | 描述                  |
| -------- | :--: | :----: | :----: | :-------------------- |
| cos      |  是  | obejct |        | [COS 配置](#cos-配置) |
| cdn      |  否  | obejct |        | [CDN 配置](#cdn-配置) |

##### COS 配置

| 参数名称 | 必选 |   类型   |               默认值               | 描述                             |
| -------- | :--: | :------: | :--------------------------------: | :------------------------------- |
| bucket   |  是  |  string  |                                    | COS 存储同名称，没有将自动创建   |
| acl      |  否  |  obejct  |                                    | 存储桶权限配置，参考 [acl](#acl) |
| sources  |  否  | obejct[] | `` | 需要托管到 COS 的静态资源目录 |

默认的 `sources`，也可以根据个人需要自定义需要托管到 COS 的静态资源目录：

```json
[{ "src": "public", "targetDir": "/" }]
```

###### acl

| 参数名称    | 必选 |  类型  |    默认值     | 描述         |
| ----------- | :--: | :----: | :-----------: | :----------- |
| permissions |  是  | string | `public-read` | 公共权限配置 |

##### CDN 配置

| 参数名称      | 必选 |  类型   |   默认值   | 描述                                                       |
| ------------- | :--: | :-----: | :--------: | :--------------------------------------------------------- |
| domain        |  是  | string  |            | CDN 域名                                                   |
| area          |  否  | string  | `mainland` | 加速区域，mainland: 大陆，overseas：海外，global：全球加速 |
| autoRefresh   |  否  | boolean |   `true`   | 是否自动刷新 CDN                                           |
| refreshType   |  否  | boolean |  `delete`  | CDN 刷新类型，delete：刷新全部资源，flush：刷新变更资源    |
| forceRedirect |  否  | obejct  |            | 访问协议强制跳转配置，参考 [forceRedirect](#forceRedirect) |
| https         |  否  | obejct  |            | https 配置，参考 [https](#https)                           |

###### forceRedirect

| 参数名称           | 必选 |  类型  | 默认值 | 描述                                                           |
| ------------------ | :--: | :----: | :----: | :------------------------------------------------------------- |
| switch             |  是  | string |  `on`  | 访问强制跳转配置开关, on：开启，off：关闭                      |
| redirectType       |  是  | string | `http` | 访问强制跳转类型，http：强制 http 跳转，https：强制 https 跳转 |
| redirectStatusCode |  是  | number | `301`  | 强制跳转时返回状态码，支持 301、302                            |

###### https

| 参数名称 | 必选 |  类型  | 默认值 | 描述                                  |
| -------- | :--: | :----: | :----: | :------------------------------------ |
| certId   |  是  | string |        | 腾讯云托管域名证书 ID                 |
| http2    |  是  | string |        | 是否开启 HTTP2，on： 开启，off： 关闭 |
