import { nanoid } from "nanoid"

import setupRequester  from '../src/main'

describe('Requester', () => {
  const ENV_DATA = process.env

  const testIdNum = 4
  const requestIds: string[] = Array.from(Array(testIdNum), () => nanoid())

  let redisClient

  beforeAll(async () => {
    // Clear cache & reset env var
    jest.resetModules()
    jest.setTimeout(50000)
    process.env = { ...ENV_DATA }
  })

  // beforeEach(async () => {
  // })

  afterEach(async () => {
    await redisClient.quit()
  })

  it('Should emit correctly', async () => {
    const requester = await setupRequester(requestIds)
    redisClient = requester.client
    requester.init()

    const { emitter } = requester
    let counter = 0

    emitter.on('start', () => counter += 1)
    emitter.on('complete', () => counter += 1)
    emitter.on('end', () => counter += 1)

    await requester.onEnd()
    expect(counter).toBe(testIdNum * 2 + 1)
  })

  it('Should return data for all requested ids', async () => {
    const requester = await setupRequester(requestIds)
    redisClient = requester.client
    requester.init()

    const data = await requester.onEnd()
    expect(Object.keys(data).length).toBe(testIdNum)
  })
})
