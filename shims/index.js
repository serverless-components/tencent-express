const http = require('http')
const url = require('url')
const binarycase = require('./binary-case')
const isType = require('./type-is')

function getPathWithQueryStringParams(event) {
  return url.format({ pathname: event.path, query: event.queryStringParameters })
}
function getEventBody(event) {
  return Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
}

function clone(json) {
  return JSON.parse(JSON.stringify(json))
}

function getContentType(params) {
  // only compare mime type; ignore encoding part
  return params.contentTypeHeader ? params.contentTypeHeader.split(';')[0] : ''
}

function isContentTypeBinaryMimeType(params) {
  return (
    params.binaryMimeTypes.length > 0 && !!isType.is(params.contentType, params.binaryMimeTypes)
  )
}

function mapApiGatewayEventToHttpRequest(event, context, socketPath) {
  const headers = Object.assign({}, event.headers)

  // NOTE: API Gateway is not setting Content-Length header on requests even when they have a body
  if (event.body && !headers['Content-Length']) {
    const body = getEventBody(event)
    headers['Content-Length'] = Buffer.byteLength(body)
  }

  const clonedEventWithoutBody = clone(event)
  delete clonedEventWithoutBody.body

  headers['x-apigateway-event'] = encodeURIComponent(JSON.stringify(clonedEventWithoutBody))
  headers['x-apigateway-context'] = encodeURIComponent(JSON.stringify(context))

  return {
    method: event.httpMethod,
    path: getPathWithQueryStringParams(event),
    headers,
    socketPath
  }
}

function forwardResponseToApiGateway(server, response, resolve) {
  const buf = []

  response
    .on('data', (chunk) => buf.push(chunk))
    .on('end', () => {
      const bodyBuffer = Buffer.concat(buf)
      const { statusCode, headers } = response

      // chunked transfer not currently supported by API Gateway
      /* istanbul ignore else */
      if (headers['transfer-encoding'] === 'chunked') {
        delete headers['transfer-encoding']
      }

      // eslint-disable-next-line
      Object.keys(headers).forEach((h) => {
        if (Array.isArray(headers[h])) {
          if (h.toLowerCase() === 'set-cookie') {
            headers[h].forEach((value, i) => {
              headers[binarycase(h, i + 1)] = value
            })
            delete headers[h]
          } else {
            headers[h] = headers[h].join(',')
          }
        }
      })

      const contentType = getContentType({ contentTypeHeader: headers['content-type'] })
      const isBase64Encoded = isContentTypeBinaryMimeType({
        contentType,
        binaryMimeTypes: server._binaryTypes
      })
      const body = bodyBuffer.toString(isBase64Encoded ? 'base64' : 'utf8')
      const successResponse = { statusCode, body, headers, isBase64Encoded }

      resolve(successResponse)
    })
}

function forwardConnectionErrorResponseToApiGateway(error, resolve) {
  console.log('ERROR: tencent-serverless-express connection error') // eslint-disable-line
  console.error(error) // eslint-disable-line
  const errorResponse = {
    statusCode: 502, // "DNS resolution, TCP level errors, or actual HTTP parse errors" - https://nodejs.org/api/http.html#http_http_request_options_callback
    body: '',
    headers: {}
  }

  resolve(errorResponse)
}

function forwardLibraryErrorResponseToApiGateway(error, resolve) {
  console.log('ERROR: tencent-serverless-express error') // eslint-disable-line
  console.error(error) // eslint-disable-line
  const errorResponse = {
    statusCode: 500,
    body: '',
    headers: {}
  }

  resolve(errorResponse)
}

function getSocketPath(socketPathSuffix) {
  if (/^win/.test(process.platform)) {
    const path = require('path')
    return path.join('\\\\?\\pipe', process.cwd(), `server-${socketPathSuffix}`)
  }
  return `/tmp/server-${socketPathSuffix}.sock`
}

function forwardRequestToNodeServer(server, event, context, resolve) {
  try {
    const requestOptions = mapApiGatewayEventToHttpRequest(
      event,
      context,
      getSocketPath(server._socketPathSuffix)
    )
    const req = http.request(requestOptions, (response) =>
      forwardResponseToApiGateway(server, response, resolve)
    )
    if (event.body) {
      const body = getEventBody(event)

      req.write(body)
    }

    req.on('error', (error) => forwardConnectionErrorResponseToApiGateway(error, resolve)).end()
  } catch (error) {
    forwardLibraryErrorResponseToApiGateway(error, resolve)
    return server
  }
}

function startServer(server) {
  return server.listen(getSocketPath(server._socketPathSuffix))
}

function getRandomString() {
  return Math.random()
    .toString(36)
    .substring(2, 15)
}

function createServer(requestListener, serverListenCallback, binaryTypes) {
  const server = http.createServer(requestListener)

  server._socketPathSuffix = getRandomString()
  server._binaryTypes = binaryTypes ? binaryTypes.slice() : []
  server.on('listening', () => {
    server._isListening = true

    if (serverListenCallback) {
      serverListenCallback()
    }
  })
  server
    .on('close', () => {
      server._isListening = false
    })
    .on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        // eslint-disable-next-line
        console.warn(
          `WARNING: Attempting to listen on socket ${getSocketPath(
            server._socketPathSuffix
          )}, but it is already in use.`
        )
        server._socketPathSuffix = getRandomString()
        return server.close(() => startServer(server))
      }
      // eslint-disable-next-line
      console.log('ERROR: server error')
      // eslint-disable-next-line
      console.error(error)
    })

  return server
}

function proxy(server, event, context) {
  return new Promise((resolve) => {
    if (server._isListening) {
      forwardRequestToNodeServer(server, event, context, resolve)
    } else {
      startServer(server).on('listening', () =>
        forwardRequestToNodeServer(server, event, context, resolve)
      )
    }
  })
}

function handler(event, context) {
  const app = require('./app')
  const server = createServer(app)
  return proxy(server, event, context)
}

exports.handler = handler
