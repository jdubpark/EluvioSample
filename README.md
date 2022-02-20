# Sample Project for Eluvio App
By Jongwon Park

Stack: Node.js/TypeScript, Jest, and Redis

## Guide
1. Run `redis-server` to start the Redis server.
2. Run `npm install` to install packages.
3. Copy `.env.example` to `.env` in the root folder.
4. Start local redis and adjust `REDIS_PORT=6379` accordingly.
5. Run `npm run start` and adjust `APP_PORT=5678` if needed.
6. Access `localhost:APP_PORT/get?ids=...,...,...`, where `...,...,...` is comma-separated ids. 

e.g. http://localhost:5678/get?ids=sdkflcoersf,xf4934djk

## Test
1. Make sure redis is running and env is adjusted properly.
2. Run `npm run test`

## Workings
1. Uses `redis`, which will return cached data instead of re-fetching data for the same ID. Each key is expired after 60s to ensure data accuracy.
2. Uses `EventEmitter` to maximize concurrency (max 5 for the given API). So there are always 5 outgoing API requests, each a unique ID (ones not cached in `redis`).

## Structure
"Concurrency pool" manages current outgoing API calls and is capped at size of 5. Once an API call is complete, it emits an event that removes the API's requested ID from the pool. If there are more IDs left to fetch (ie. requestIDs queue is not empty), the requestID queue is shifted and the first request ID is added to the concurrency pool.

By using a set for the concurrency pool, we ignore duplicate request IDs & we also perform additional validations to skip duplicate request IDs.

When our API route (`/get`) is called, a new request router is opened & all requested IDs are added to the queue, and the concurrency pool begins.