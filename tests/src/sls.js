const express = require('express')
const app = express()

app.get('/', function(req, res) {
  res.json('hello world')
})

module.exports = app
