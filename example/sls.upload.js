const multer = require('multer')
const express = require('express')
const path = require('path')

const app = express()
const isServerless = process.env.SERVERLESS
const upload = multer({ dest: isServerless ? '/tmp/upload' : './upload' })

// Routes
app.post('/upload', upload.single('file'), (req, res) => {
  res.send({
    success: true,
    data: req.file
  })
})

app.get(`/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.get('/user', (req, res) => {
  res.send([
    {
      title: 'serverless framework',
      link: 'https://serverless.com'
    }
  ])
})

app.get('/user/:id', (req, res) => {
  const id = req.params.id
  res.send({
    id: id,
    title: 'serverless framework',
    link: 'https://serverless.com'
  })
})

app.get('/404', (req, res) => {
  res.status(404).send('Not found')
})

app.get('/500', (req, res) => {
  res.status(500).send('Server Error')
})

// Error handler
app.use(function(err, req, res, next) {
  console.error(err)
  res.status(500).send('Internal Serverless Error')
})

if (isServerless) {
  module.exports = app
} else {
  app.listen(3000, () => {
    console.log(`Server start on http://localhost:3000`)
  })
}
