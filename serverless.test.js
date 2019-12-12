const test = require('tape')

const Component = require('./serverless')

test('getDefaultProtocol()', (t) => {
  t.plan(5)

  const comp = new Component()
  t.equal(comp.getDefaultProtocol(['http']), 'http')
  t.equal(comp.getDefaultProtocol(['https']), 'https')
  t.equal(comp.getDefaultProtocol(['http', 'https']), 'https')
  t.equal(comp.getDefaultProtocol(['HTTP', 'hTTpS']), 'https')
  t.equal(comp.getDefaultProtocol(['http', 'ftp']), 'http')
})
