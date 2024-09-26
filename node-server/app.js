// v2-file-upload.js
const express = require('express')
const app = express()
const port = 3000
const path = require('path')
const fse = require('fs-extra')
const multiparty = require('multiparty')

app.use((req, res, next) => {
  // 请求头允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  next()
})

app.options('*', (req, res) => {
  res.sendStatus(200)
})

app.listen(port, () => console.log('基础大文件上传：监听3000端口'))

app.get('/content', async (req, res) => {
  res.send({
    code: 0,
    msg: '你成功访问了3000端口',
  })
})
