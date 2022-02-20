import * as express from 'express'

import envVars from './config/env-vars'
import setupRequester from './main'

const app = express()

app.get('/get', async (req, res) => {
  try {
    // console.log(req.query.ids)
    const requestIds = req.query.ids.split(',') // parse comma-separated ids into array

    if (!Array.isArray(requestIds) || requestIds.length == 0) {
      res.status(401).send('Invalid data')
      return
    }

    const requester = await setupRequester(requestIds)

    requester.init()

    const data = await requester.onEnd()
    console.log(data)
    res.status(200).send(JSON.stringify(data))
  } catch (err){
    console.log(err)
    res.status(500)
  }
})

app.get('*', (_, res) => {
  res.status(404).send('Unknown path')
})

app.listen(envVars.APP_PORT, () => {
  console.log(`Sample app listening on http://localhost:${envVars.APP_PORT}`)
})
