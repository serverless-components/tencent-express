# 配置文档

## 全部配置

```yml
# serverless.yml

component: express # (必选) 组件名称，在该实例中为express
name: expressDemo # 必选) 组件实例名称.
org: orgDemo # (可选) 用于记录组织信息，默认值为您的腾讯云账户 appid，必须为字符串
app: appDemo # (可选) 用于记录组织信息. 默认与name相同，必须为字符串
stage: dev # (可选) 用于区分环境信息，默认值是 dev

inputs:
  region: ap-guangzhou # 云函数所在区域
  functionName: expressDemo # 云函数名称
  serviceName: mytest # api网关服务名称
  runtime: Nodejs10.15 # 运行环境
  serviceId: service-np1uloxw # api网关服务ID
  src: ./src # 第一种为string时，会打包src对应目录下的代码上传到默认cos上。
  # src:  # 第二种，部署src下的文件代码，并打包成zip上传到bucket上
  #   src: ./src  # 本地需要打包的文件目录
  #   bucket: bucket01 # bucket name，当前会默认在bucket name后增加 appid 后缀, 本例中为 bucket01-appid
  #   exclude:   # 被排除的文件或目录
  #     - .env
  #     - node_modules
  # src: # 第三种，在指定存储桶bucket中已经存在了object代码，直接部署
  #   bucket: bucket01 # bucket name，当前会默认在bucket name后增加 appid 后缀, 本例中为 bucket01-appid
  #   object: cos.zip  # bucket key 指定存储桶内的文件
  layers:
    - name: layerName #  layer名称
      version: 1 #  版本
  functionConf: # 函数配置相关
    timeout: 10 # 超时时间，单位秒
    memorySize: 128 # 内存大小，单位MB
    environment: #  环境变量
      variables: #  环境变量数组
        TEST: vale
    vpcConfig: # 私有网络配置
      vpcId: '' # 私有网络的Id
      subnetId: '' # 子网ID
  apigatewayConf: #  api网关配置
    isDisabled: false # 是否禁用自动创建 API 网关功能
    enableCORS: true #  允许跨域
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
    protocols:
      - http
      - https
    environment: test
    serviceTimeout: 15
    usagePlan: #  用户使用计划
      usagePlanId: 1111
      usagePlanName: slscmp
      usagePlanDesc: sls create
      maxRequestNum: 1000
    auth: #  密钥
      secretName: secret
      secretIds:
        - xxx
```

## 配置描述

主要的参数

| 参数名称                             | 是否必选 |     默认值      | 描述                                                                |
| ------------------------------------ | :------: | :-------------: | :------------------------------------------------------------------ |
| runtime                              |    否    |   Nodejs10.15   | 执行环境, 目前支持: Nodejs6.10, Nodejs8.9, Nodejs10.15, Nodejs12.16 |
| region                               |    否    |  ap-guangzhou   | 项目部署所在区域，默认广州区                                        |
| functionName                         |    否    |                 | 云函数名称                                                          |
| serviceName                          |    否    |                 | API 网关服务名称, 默认创建一个新的服务名称                          |
| serviceId                            |    否    |                 | API 网关服务 ID,如果存在将使用这个 API 网关服务                     |
| src                                  |    否    | `process.cwd()` | 默认为当前目录, 如果是对象, 配置参数参考 [执行目录](#执行目录)      |
| layers                               |    否    |                 | 云函数绑定的 layer, 配置参数参考 [层配置](#层配置)                  |
| [functionConf](#函数配置)            |    否    |                 | 函数配置                                                            |
| [apigatewayConf](#API-网关配置)      |    否    |                 | API 网关配置                                                        |
| [cloudDNSConf](#DNS-配置)            |    否    |                 | DNS 配置                                                            |
| [Region special config](#指定区配置) |    否    |                 | 指定区配置                                                          |

## 执行目录

| 参数名称 | 是否必选 |      类型       | 默认值 | 描述                                                                                                                                                                                 |
| -------- | :------: | :-------------: | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src      |    否    |     String      |        | 代码路径。与 object 不能同时存在。                                                                                                                                                   |
| exclude  |    否    | Array of String |        | 不包含的文件或路径, 遵守 [glob 语法](https://github.com/isaacs/node-glob)                                                                                                            |
| bucket   |    否    |     String      |        | bucket 名称。如果配置了 src，表示部署 src 的代码并压缩成 zip 后上传到 bucket-appid 对应的存储桶中；如果配置了 object，表示获取 bucket-appid 对应存储桶中 object 对应的代码进行部署。 |
| object   |    否    |     String      |        | 部署的代码在存储桶中的路径。                                                                                                                                                         |

## 层配置

| 参数名称 | 是否必选 |  类型  | 默认值 | 描述     |
| -------- | :------: | :----: | :----: | :------- |
| name     |    否    | String |        | 层名称   |
| version  |    否    | String |        | 层版本号 |

### DNS 配置

参考: https://cloud.tencent.com/document/product/302/8516

| 参数名称   | 是否必选 | 类型     | 默认值 | 描述                                            |
| ---------- | :------: | -------- | :----: | :---------------------------------------------- |
| ttl        |    否    | Number   |  600   | TTL 值，范围 1 - 604800，不同等级域名最小值不同 |
| recordLine |    否    | String[] |        | 记录的线路名称                                  |

### 指定区配置

| 参数名称                        | 是否必选 | 类型   | 默认值 | 函数         |
| ------------------------------- | :------: | ------ | ------ | ------------ |
| [functionConf](#函数配置)       |    否    | Object |        | 函数配置     |
| [apigatewayConf](#API-网关配置) |    否    | Object |        | API 网关配置 |
| [cloudDNSConf](#DNS-配置)       |    否    | Object |        | DNS 配置     |

### 函数配置

参考: https://cloud.tencent.com/document/product/583/18586

| 参数名称    | 是否必选 |  类型  | 默认值 | 描述                                                                            |
| ----------- | :------: | :----: | :----: | :------------------------------------------------------------------------------ |
| timeout     |    否    | Number |   3    | 函数最长执行时间，单位为秒，可选值范围 1-900 秒，默认为 3 秒                    |
| memorySize  |    否    | Number |  128   | 函数运行时内存大小，默认为 128M，可选范围 64、128MB-3072MB，并且以 128MB 为阶梯 |
| environment |    否    | Object |        | 函数的环境变量, 参考 [环境变量](#环境变量)                                      |
| vpcConfig   |    否    | Object |        | 函数的 VPC 配置, 参考 [VPC 配置](#VPC-配置)                                     |

##### 环境变量

| 参数名称  | 类型 | 描述                                      |
| --------- | ---- | :---------------------------------------- |
| variables |      | 环境变量参数, 包含多对 key-value 的键值对 |

##### VPC 配置

| 参数名称 | 类型   | 描述    |
| -------- | ------ | :------ |
| subnetId | String | 子网 ID |
| vpcId    | String | VPC ID  |

### API 网关配置

| 参数名称       | 是否必选 | 类型     | 默认值   | 描述                                                                               |
| -------------- | :------: | :------- | :------- | :--------------------------------------------------------------------------------- |
| protocols      |    否    | String[] | ['http'] | 前端请求的类型，如 http，https，http 与 https                                      |
| environment    |    否    | String   | release  | 发布环境. 目前支持三种发布环境: test（测试）, prepub（预发布） 与 release（发布）. |
| usagePlan      |    否    |          |          | 使用计划配置, 参考 [使用计划](#使用计划)                                           |
| auth           |    否    |          |          | API 密钥配置, 参考 [API 密钥](#API-密钥配置)                                       |
| customDomain   |    否    | Object[] |          | 自定义 API 域名配置, 参考 [自定义域名](#自定义域名)                                |
| enableCORS     |    否    | Boolean  | `false`  | 开启跨域。默认值为否。                                                             |
| serviceTimeout |    否    | Number   | `15`     | Api 超时时间，单位: 秒                                                             |
| isDisabled     |    否    | Boolean  | `false`  | 关闭自动创建 API 网关功能。默认值为否，即默认自动创建 API 网关。                   |

##### 使用计划

参考: https://cloud.tencent.com/document/product/628/14947

| 参数名称      | 是否必选 | 类型   | 描述                                                    |
| ------------- | :------: | ------ | :------------------------------------------------------ |
| usagePlanId   |    否    | String | 用户自定义使用计划 ID                                   |
| usagePlanName |    否    | String | 用户自定义的使用计划名称                                |
| usagePlanDesc |    否    | String | 用户自定义的使用计划描述                                |
| maxRequestNum |    否    | Int    | 请求配额总数，如果为空，将使用-1 作为默认值，表示不开启 |

##### API 密钥配置

参考: https://cloud.tencent.com/document/product/628/14916

| 参数名称   | 类型   | 描述     |
| ---------- | :----- | :------- |
| secretName | String | 密钥名称 |
| secretIds  | String | 密钥 ID  |

##### 自定义域名

Refer to: https://cloud.tencent.com/document/product/628/14906

| 参数名称         | 是否必选 |   类型   | 默认值 | 描述                                                                                                                                                                                 |
| ---------------- | :------: | :------: | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain           |    是    |  String  |        | 待绑定的自定义的域名。                                                                                                                                                               |
| certificateId    |    否    |  String  |        | 待绑定自定义域名的证书唯一 ID，如果设置了 type 为 https，则为必选                                                                                                                    |
| isDefaultMapping |    否    |  String  | `true` | 是否使用默认路径映射，默认为 true。为 false 时，表示自定义路径映射，此时 pathMappingSet 必填。                                                                                       |
| pathMappingSet   |    否    | Object[] |  `[]`  | 自定义路径映射的路径。使用自定义映射时，可一次仅映射一个 path 到一个环境，也可映射多个 path 到多个环境。并且一旦使用自定义映射，原本的默认映射规则不再生效，只有自定义映射路径生效。 |
| protocol         |    否    | String[] |        | 绑定自定义域名的协议类型，默认与服务的前端协议一致。                                                                                                                                 |

- 自定义路径映射

| 参数名称    | 是否必选 | 类型   | Description    |
| ----------- | :------: | :----- | :------------- |
| path        |    是    | String | 自定义映射路径 |
| environment |    是    | String | 自定义映射环境 |
