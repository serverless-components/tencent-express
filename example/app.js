const express = require('express')
const app = express()

app.get('/', function(req, res) {
  console.log('Current environment: ', process.env.RUN_ENV)
  res.cookie('c1', '1', {
    maxAge: 315000000,
    path: '/',
    httpOnly: false,
    overwrite: true
  })
  res.cookie('c2', 2, {
    maxAge: 315000000,
    path: '/',
    httpOnly: false,
    overwrite: true
  })
  res.send({
    message: 'Hello Express',
    query: req.query,
    runEnv: process.env.RUN_ENV
  })
})

// don't forget to export!
module.exports = app
