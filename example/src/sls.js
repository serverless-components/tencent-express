const express = require('express')
const path = require('path')
const app = express()

// Routes
app.get(`/*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

// Error handler
app.use(function(err, req, res) {
  console.error(err)
  res.status(500).send('Internal Serverless Error')
})

module.exports = app
