# Tencent Express

Instantly deploy Express applications to Tencent Cloud using Serverless Components

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)
5. [Remove](#5-remove)

&nbsp;

### 1. Install

```console
$ npm install -g serverless
```

### 2. Create

Just create `serverless.yml` and `.env` files

```console
$ touch serverless.yml
$ touch .env # your Tencent API Keys
```

Set Tencent credentials in the `.env` file.

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
TENCENT_APP_ID=123
```

### 3. Configure

```yml
# serverless.yml

myBucket:
  component: '@serverless/tencent-cos'
  inputs:
    # Required
    bucket: myBucket-1300418942 # if you don't add the AppId suffix, it will be added automatically for you
    region: ap-guangzhou

    # acl (Optional)
    acl:
      permissions: private
      grantRead: STRING_VALUE
      grantWrite: STRING_VALUE
      grantFullControl: STRING_VALUE

    # cors (Optional)
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

    # tags (Optional)
    tags:
      - key: abc
        value: xyz
```

### 4. Deploy

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

### 5. Remove

```
myApp (master)$ serverless remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removing "myBucket-1300418942" bucket from the "eu-frankfurt" region.
  DEBUG ─ "myBucket-1300418942" bucket was successfully removed from the "eu-frankfurt" region.

  7s › bucket › done

myApp (master)$
```

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
