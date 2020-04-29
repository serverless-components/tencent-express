# Configure document

## Complete configuration

```yml
# serverless.yml

component: express # (required) name of the component. In that case, it's express.
name: expressDemo # (required) name of your express component instance.
org: orgDemo # (optional) serverless dashboard org. default is the first org you created during signup.
app: appDemo # (optional) serverless dashboard app. default is the same as the name property.
stage: dev # (optional) serverless dashboard stage. default is dev.

inputs:
  region: ap-guangzhou
  functionName: expressDemo
  serviceName: mytest
  runtime: Nodejs10.15
  serviceId: service-np1uloxw
  src: ./src
  # src:
  #   src: ./src
  #   exclude:
  #     - .env
  #     - node_modules
  layers:
    - name: expressLayer
      version: 1
  functionConf:
    timeout: 10
    memorySize: 128
    environment:
      variables:
        TEST: vale
    vpcConfig:
      subnetId: ''
      vpcId: ''
  apigatewayConf:
    customDomains:
      - domain: abc.com
        certificateId: abcdefg
        isDefaultMapping: 'FALSE'
        pathMappingSet:
          - path: /
            environment: release
        protocols:
          - http
          - https
    protocols:
      - http
      - https
    environment: test
    usagePlan:
      usagePlanId: 1111
      usagePlanName: slscmp
      usagePlanDesc: sls create
      maxRequestNum: 1000
    auth:
      serviceTimeout: 15
      secretName: secret
      secretIds:
        - xxx
```

## Configuration description

Main param description

| Param                                    | Required |     Default     | Description                                                                               |
| ---------------------------------------- | :------: | :-------------: | :---------------------------------------------------------------------------------------- |
| runtime                                  |    N     |   Nodejs10.15   | Function Runtime, support: Nodejs6.10, Nodejs8.9, Nodejs10.15                             |
| region                                   |    N     |  ap-guangzhou   | Deploy region                                                                             |
| functionName                             |    N     |                 | Serverless Cloud Function Name                                                            |
| serviceName                              |    N     |                 | API-Gateway service name, default to create a new serivce                                 |
| serviceId                                |    N     |                 | API-Gateway service id, if it has will use this APII-Gateway service                      |
| src                                      |    N     | `process.cwd()` | Default is current working directory, if it is object, refer to [src object](#src-object) |
| layers                                   |    N     |                 | Bind layers for scf, array of [Layer](#layer)                                             |
| exclude                                  |    N     |                 | exclude file                                                                              |
| include                                  |    N     |                 | include file, if relative path, should relative to `serverless.yml`                       |
| [functionConf](#funtionConf)             |    N     |                 | Function configure                                                                        |
| [apigatewayConf](#apigatewayConf)        |    N     |                 | API-Gateway configure                                                                     |
| [cloudDNSConf](#cloudDNSConf)            |    N     |                 | Special config for region                                                                 |
| [Region special config](#apigatewayConf) |    N     |                 | Special config for region. Use region name for key                                        |

## src object

| Param   | Required |      Type       | Default | Description                                                                   |
| ------- | :------: | :-------------: | :-----: | :---------------------------------------------------------------------------- |
| src     |    N     |     String      |         | code path                                                                     |
| exclude |    N     | Array of String |         | Exclude path or file, using [glob sytax](https://github.com/isaacs/node-glob) |
| bucket  |    N     |     String      |         | bucket name                                                                   |
| object  |    N     |     String      |         | bucket object name                                                            |

## layer

| Param   | Required |  Type  | Default | Description   |
| ------- | :------: | :----: | :-----: | :------------ |
| name    |    N     | String |         | layer name    |
| version |    N     | String |         | layer version |

### cloudDNSConf

Refer to: https://cloud.tencent.com/document/product/302/8516

| Param      | Required | Type     | Default | Description                    |
| ---------- | :------: | -------- | :-----: | :----------------------------- |
| ttl        |    N     | Number   |   600   | TTL, support value: 1 - 604800 |
| recordLine |    N     | String[] |         | record line                    |

### Region special config

| Param                             | Required | Type   | Default | Description               |
| --------------------------------- | :------: | ------ | ------- | ------------------------- |
| [functionConf](#funtionConf)      |    N     | Object |         | Function configure        |
| [apigatewayConf](#apigatewayConf) |    N     | Object |         | API-Gateway configure     |
| [cloudDNSConf](#cloudDNSConf)     |    N     | Object |         | Special config for region |

### funtionConf

Refer to: https://cloud.tencent.com/document/product/583/18586

| Param       | Required |  Type  | Default | Description                                                                                                                                     |
| ----------- | :------: | :----: | :-----: | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| timeout     |    N     | Number |    3    | The duration a function allowed to execute. Choose a value between 1 and 300 seconds; The default is 3 seconds.                                 |
| memorySize  |    N     | Number |   128   | The size of memory size available to the function during execution. Specify a value between 128 MB (default) and 1,536 MB in 128 MB increments. |
| environment |    N     | Object |         | Environment variable of the function, refer to [environment](#environment)                                                                      |
| vpcConfig   |    N     | Object |         | VPC configuration of the function, refer to [vpcConfig](#vpcConfig)                                                                             |

##### environment

| Param     | Type   | Description                                       |
| --------- | ------ | :------------------------------------------------ |
| variables | Object | Environment variables, can contain many key-value |

##### vpcConfig

| Param    | Type   | Description      |
| -------- | ------ | :--------------- |
| subnetId | String | ID of the VPC    |
| vpcId    | String | ID of the subnet |

### apigatewayConf

| Param        | Required | Type     | Default  | Description                                                                                              |
| ------------ | :------: | :------- | :------- | :------------------------------------------------------------------------------------------------------- |
| protocols    |    N     | String[] | ['http'] | Frontend request type of the service, such as HTTP, HTTPS, HTTP and HTTPS.                               |
| environment  |    N     | String   | release  | The name of the environment to be published. Three environments are supported: test, prepub and release. |
| usagePlan    |    N     |          |          | Usage plan config, reter to [usagePlan](#usagePlan)                                                      |
| auth         |    N     |          |          | APi auth secret config, reter to [auth](#auth)                                                           |
| customDomain |    N     | Object[] |          | Custom API Domain, refer to [customDomain](#customDomain)                                                |
| isDisabled   |    N     | Boolean  | false    | Desable auto create api gateway service, Default: false                                                  |

- usagePlan

Refer to: https://cloud.tencent.com/document/product/628/14947

| Param         | Required | Type   | Description                                                                                                   |
| ------------- | :------: | ------ | :------------------------------------------------------------------------------------------------------------ |
| usagePlanId   |    N     | String | User-defined usage plan id                                                                                    |
| usagePlanName |    N     | String | User-defined usage plan name                                                                                  |
| usagePlanDesc |    N     | String | User-defined usage plan description                                                                           |
| maxRequestNum |    N     | Int    | Total number of requests allowed. If this is left empty, -1 will be used by default, indicating it’s disabled |

- auth

Refer to: https://cloud.tencent.com/document/product/628/14916

| Param      | Type   | Description       |
| ---------- | :----- | :---------------- |
| secretName | String | Secret name       |
| secretIds  | String | Secret Id (Array) |

##### customDomain

Refer to: https://cloud.tencent.com/document/product/628/14906

| Param            | Required |   Type   | Default  | Description                                                                                               |
| ---------------- | :------: | :------: | :------: | :-------------------------------------------------------------------------------------------------------- |
| domain           |    Y     | Strings  |          | custom domain to bind.                                                                                    |
| certificateId    |    N     | Strings  |          | Certificate for custom domain, if set https, it is required.                                              |
| isDefaultMapping |    N     |  String  | `'TRUE'` | Whether using default path mapping. If want to customize path mapping, set to `FALSE`                     |
| pathMappingSet   |    N     | Object[] |   `[]`   | Custom path mapping, when `isDefaultMapping` is `FALSE`, it is required.                                  |
| protocol         |    N     | String[] |          | Bind custom domain protocol type, such as HTTP, HTTPS, HTTP and HTTPS, default same as frontend protocols |

- pathMappingSet

| Param       | Required | Type | Description                   |
| ----------- | :------: | :--- | :---------------------------- |
| path        |    Y     | type | Customize mapping path        |
| environment |    Y     | type | Customize mapping environment |
