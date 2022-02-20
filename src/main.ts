import axios, { AxiosResponse, AxiosError } from 'axios'
import { once, EventEmitter } from 'events'
import { createClient } from 'redis'

import envVars from './config/env-vars'
import { EXPIRATION_TIME, MAX_CONCURRENCY } from './constants'

type RedisClientType = ReturnType<typeof createClient> // locally define the type inferred from createClient

interface ConnectRedisConfig {
  REDIS_HOST: string,
  REDIS_PORT: string,
  REDIS_USERNAME: string,
  REDIS_PASSWORD: string,
}

async function connectToRedis(config: ConnectRedisConfig) {
  const client = createClient({
    url: `redis://${config.REDIS_USERNAME}:${config.REDIS_PASSWORD}@${config.REDIS_HOST}:${config.REDIS_PORT}`,
  })

  client.on('error', (err) => console.log('Redis Client Error', err))

  await client.connect()
  return client
}

/**
 * Save given key: field in redis
 * @param key
 * @param field
 * @param client
 */
async function saveToRedis(key: string, field: string, client: RedisClientType): Promise<any> {
  await client.set(key, field)
  return client.expire(key, EXPIRATION_TIME)
}

/**
 * Get data from redis or API
 * @param someId
 * @param client
 */
async function requestData(someId: string, client: RedisClientType): Promise<string | null> {
  try {
    // First, try to get data from redis
    let data = await client.get(someId)

    // If redis doesn't have key (either never fetched or not stored),
    // fetch from API, save to redis, and return data
    if (!data) {
      const authKey = Buffer.from(someId).toString('base64')
      const res: AxiosResponse = await axios.get(`https://challenges.qluv.io/items/${someId}`, { headers: { Authorization: authKey } })
      if (!res.data) throw new Error('Data is null')

      data = res.data
      await saveToRedis(someId, data, client)
    }

    return Promise.resolve(data)
  } catch (err) {
    console.log(err.name)
    // Too many requests
    if ((err as AxiosError).response?.status === 429) {
      return Promise.reject(429)
    }
    return Promise.reject(null)
  }
}

/**
 * Add to existing request Ids & concurrency pool
 * @param someId
 * @param requestIds
 * @param concurrencyPool
 * @param requestEmitter
 */
function addToRequestIds(someId: string | undefined, requestIds: string[], concurrencyPool: Set<string>, requestEmitter: EventEmitter) {
  if (!someId) return
  if (!requestIds.includes(someId)) {
    requestIds.push(someId)
    addToConcurrencyPool(someId, concurrencyPool, requestEmitter)
  }
}

/**
 * Add request id to concurrency pool for requestData() if pool is free
 * @param someId
 * @param concurrencyPool
 * @param requestEmitter
 */
function addToConcurrencyPool(someId: string, concurrencyPool: Set<string>, requestEmitter: EventEmitter) {
  if (!concurrencyPool.has(someId) && concurrencyPool.size < MAX_CONCURRENCY) {
    // Add to concurrency pool only if there's less than MAX_CONCURRENCY (5) ids
    requestEmitter.emit('start', someId)
  }
}

/**
 * Set up request emitter
 * @param {string[]} requestIds
 * @param {Set<string>} concurrencyPool
 * @param {object} finalData
 * @param {RedisClientType} client
 */
function setupEmitter(requestIds: string[], concurrencyPool: Set<string>, finalData: object, client: RedisClientType): EventEmitter {
  const requestEmitter = new EventEmitter()

  requestEmitter.on('start', async (someId) => {
    // console.log('start', someId)
    concurrencyPool.add(someId)
    try {
      finalData[someId] = await requestData(someId, client)
      requestEmitter.emit('complete', someId)
    } catch (err) {
      if (err === 429) {
        // "Too many request" error, re-emit the id into the concurrency pool after timeout
        requestEmitter.emit('start', someId)
      } else {
        // Otherwise, just emit completion
        requestEmitter.emit('complete', someId)
      }
    }
  })

  requestEmitter.on('complete', (someId) => {
    // console.log('complete', someId)
    concurrencyPool.delete(someId)
    if (requestIds.includes(someId)) {
      // Remove `someId` from the request pool
      requestIds.slice(requestIds.indexOf(someId), 1)
    }

    if (requestIds.length) {
      // Continue adding to concurrency pool if there are request ids
      addToConcurrencyPool(requestIds.shift(), concurrencyPool, requestEmitter)
    } else if (concurrencyPool.size === 0) {
      // No more request id AND concurrency pool is empty (no outgoing request), so finish
      requestEmitter.emit('end')
    }
  })

  return requestEmitter
}

/**
 * Set up request router
 * @param {string[]} toBeRequestedIds queue, FIFO -- pool of request ids
 */
export default async function setupRequester(toBeRequestedIds: string[]) {
  const client: RedisClientType = await connectToRedis(envVars)

  const requestIds: string[] = []
  const concurrencyPool = new Set<string>() // unordered set

  const finalData = {}

  const requestEmitter = setupEmitter(requestIds, concurrencyPool, finalData, client)

  return {
    client,
    data: () => finalData,
    emitter: requestEmitter,
    init: () => {
      for (const someId of toBeRequestedIds) {
        addToRequestIds(someId, requestIds, concurrencyPool, requestEmitter)
      }
    },
    onEnd: async () => {
      await once(requestEmitter, 'end')
      return finalData
    }
  }
}
