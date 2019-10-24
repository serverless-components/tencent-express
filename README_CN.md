# 腾讯云对象存储 COS 组件

## 简介

该组件是 serverless-tencent 组件库中的基础组件之一。通过对象存储 COS 组件，可以快速，方便的创建，配置和管理腾讯云的 COS 存储桶

## 快速开始

通过 COS 组件，对一个 COS 存储桶进行完整的创建，配置，部署和删除等操作。支持命令如下：

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

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
TENCENT_APP_ID=123
```

### 3. 配置

在 serverless.yml 中进行如下配置

```yml
# serverless.yml

myBucket:
  component: '@serverless/tencent-cos' # 添加依赖的cos组件
  inputs:
    # 必填
    bucket: myBucket-1300418942 # 存储桶后缀需要填写APPID信息，如果不填会默认帮忙添加后缀
    region: ap-guangzhou # 需要部署存储桶的地域信息

    # acl配置 (可选)
    acl:
      permissions: private
      grantRead: STRING_VALUE
      grantWrite: STRING_VALUE
      grantFullControl: STRING_VALUE

    # cors配置 (可选)
    cors:
      - id: abc
        maxAgeSeconds: '10'
        allowedMethods:
          - GET
        allowedOrigins:
          - https://tencent.com
        allowedHeaders:
          - FIRST_ALLOWED_HEADER
        exposeHeaders:
          - FIRST_EXPOSED_HEADER

    # tags标签配置 (可选)
    tags:
      - key: abc
        value: xyz
```

### 4. 部署

通过如下命令进行部署，并查看部署过程中的信息

```
myApp (master)$ serverless --debug

  DEBUG ─ "myBucket-1300418942" bucket was successfully deployed to the "eu-frankfurt" region.
  DEBUG ─ Setting ACL for "myBucket-1300418942" bucket in the "eu-frankfurt" region.
  DEBUG ─ Setting CORS rules for "myBucket-1300418942" bucket in the "eu-frankfurt" region.
  DEBUG ─ Setting Tags for "myBucket-1300418942" bucket in the "undefined" region.

  bucket:
    bucket: myBucket-1300418942
    region: eu-frankfurt
    acl:
      permissions: private
    cors:
      -
        id:             abc
        maxAgeSeconds:  10
        allowedMethods: (max depth reached)
        allowedOrigins: (max depth reached)
        allowedHeaders: (max depth reached)
        exposeHeaders:  (max depth reached)
    tags:
      -
        key:   abc
        value: xyz

  3s › bucket › done

myApp (master)$
```

### 5. 移除

通过以下命令移除部署的存储桶

```
myApp (master)$ serverless remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removing "myBucket-1300418942" bucket from the "eu-frankfurt" region.
  DEBUG ─ "myBucket-1300418942" bucket was successfully removed from the "eu-frankfurt" region.

  7s › bucket › done

myApp (master)$
```

### 还支持哪些组件？

可以在 [Serverless Components](https://github.com/serverless/components) repo 中查询更多组件的信息。
