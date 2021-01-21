# 部署 `output` 参数介绍

> 组件输出可以在别的组件中通过 `${output:${stage}:${app}:<name>.<variable_name>}` 获取
>
> 例如，如果该组件名称是 `test_name`, ·且只部署于一个地域，则可以通过 `${output:${stage}:${app}:test_name.apigw.url}` 在别的组件中获取该组件的 API 网关的 `url`。

| 名称        |      类型       | 描述                                                   |
| :---------- | :-------------: | :----------------------------------------------------- | ---------------- |
| templateUrl |     string      | 未提供代码时的模板代码 url                             |
| region      |     string      | 地域信息（只有一个地域时才提供）                       |
| scf         | [`FunctionOutput | Record<string,FunctionOutput>`](#云函数输出-`FunctionOutput`) | 云函数输出信息   |
| apigw       |  [`ApigwOutput   | Record<string:ApigwOutput>`](#API-网关输出-`ApigwOutput`)     | API 网关输出信息 |

## 云函数输出 `FunctionOutput`

| 名称                 |      类型      | 描述                   |
| :------------------- | :------------: | :--------------------- |
| functionName         |     string     | 云函数名称             |
| runtime              |     string     | 云运行环境             |
| namespace            |     string     | 云函数名称空间         |
| lastVersion          |     string     | 云函数版本             |
| traffic              | `number (0~1)` | 将多少流量导向该云函数 |
| configTrafficVersion |     string     |                        |

## API 网关输出 `ApigwOutput`

| 名称          |                                 类型                                 | 描述                       |
| :------------ | :------------------------------------------------------------------: | :------------------------- | ------- | -------- |
| serviceId     |                                string                                | API 网关 ID                |
| subDomain     |                                string                                | API 网关子域名             |
| enviroment    |                              `"release"                              | "prepub"                   | "test"` | API 网关 |
| url           |                                string                                | API 网关对外的完整 URL     |
| traffic       |                             number (0~1)                             | 将多少流量导向该云函数     |
| customDomains | [CustomDomain[]](#API-网关自定义域名输出-`ApigwOutput.CustomDomain`) | API 网关自定义域名输出列表 |

## API 网关自定义域名输出 `ApigwOutput.CustomDomain`

| 名称             |                                类型                                | 描述                       |
| :--------------- | :----------------------------------------------------------------: | :------------------------- | ---------- |
| domain           |                               string                               | 自定义域名                 |
| certificateId    |                               string                               | 域名证书 ID                |
| isDefaultMapping |                              boolean                               | 该自定义域名是否为默认域名 |
| pathMappingSet   | [PathMapping[]](#-API-网关域名映射规则-`CustomDomain.PathMapping`) | 该域名的路径映射规则列表   |
| protocols        |                              `"http"                               | "https"`                   | 启用的协议 |



## API 网关域名映射规则 `CustomDomain.PathMapping`

| 名称       |  类型  | 描述             |
| :--------- | :----: | :--------------- |
| path       | string | 路径             |
| enviroment | string | 路径映射到的环境 |
