# Configure document

## Complete configuration

```yml
# serverless.yml

express:
  region: ap-shanghai
  component: '@serverless/tencent-express'
  inputs:
    region: ap-shanghai
    functionName: eslam-function
    serviceName: mytest 
    serviceId: service-np1uloxw
    code: ./code
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
      protocol: https
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
          - AKIDNSdvdFcJ8GJ9th6qeZH0ll8r7dE6HHaSuchJ
         
```

## Configuration description

Main param description

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----      |
| region       | Optional             |ap-guangzhou |  |
| functionName | Optional             |             | ServerlessCloudFunction Name |
| serviceName  | Optional             |             | API-Gateway service name, default to create a new serivce |
| serviceId    | Optional             |             | API-Gateway service id, if it has will use this APII-Gateway service |
| code         | Optional             |             | Default is current working directory |
| [functionConf](#funtionConf-param-description) | Optional             |             | Function configure |
| [apigatewayConf](#apigatewayConf-param-description)| Optional            |             | API-Gateway configure |


### funtionConf param description

| Param        | Required/Optional    |  Default    |  Description |
| --------     | :-----:              | :----:      |  :----      |
| timeout      | Optional             | 3s          | The duration a function allowed to execute. Choose a value between 1 and 300 seconds; The default is 3 seconds. |
| memorySize   | Optional             |128M         | The size of memory size available to the function during execution. Specify a value between 128 MB (default) and 1,536 MB in 128 MB increments. |
| environment  | Optional             |             | Environment variable of the function |
| vpcConfig    | Optional             |             | VPC configuration of the function |


* environment param description

| Param        |   Description |
| --------     |   :----      |
| variables    |   Environment variable array |


* vpcConfig param description

| Param        |  Description |
| --------     |   :----      |
| subnetId     |  ID of the VPC |
| vpcId        | ID of the subnet |

### apigatewayConf param description

| Param        | Required/Optional    |  Description |
| --------     | :-----:              |   :----      |
| protocol      | Optional             | Frontend request type of the service, such as HTTP, HTTPS, HTTP and HTTPS. |
| environment   | Optional             |  The name of the environment to be published. Three environments are supported: test, prepub and release. |
| usagePlan  | Optional             |             |
| auth    | Optional            |           |

* usagePlan param description

| Param        |  Description |
| --------     |   :----      |
| usagePlanId | User-defined usage plan id |
| usagePlanName | User-defined usage plan name |
| usagePlanDesc | User-defined usage plan description |
| maxRequestNum | Total number of requests allowed. If this is left empty, -1 will be used by default, indicating it’s disabled |


* auth param description

| Param        |  Description |
| --------     |   :----      |
| serviceTimeout  |   Service timeout    |
| secretName     |    Secret name    |
| secretIds     |    Secret Id (Array)     |
