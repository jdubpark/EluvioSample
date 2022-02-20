# Sample Project for Eluvio App
By Jongwon Park

## Requirements
- Node
- Redis

## Guide
1. Start local redis and adjust REDIS_PORT=6379 accordingly
2. Access `localhost:APP_PORT/get?ids=...,...,...`, where `...,...,...` is comma-separated ids. 

e.g. http://localhost:5678/get?ids=sdkflcoersf,xf4934djk

## Test
1. Make sure redis is running and env is adjusted properly.
2. Run `npm run test`

## Workings
1. Uses `redis`, which will return cached data instead of re-fetching data for the same ID. Each key is expired after 60s to ensure data accuracy.
2. Uses `EventEmitter` to maximize concurrency (max 5 for the given API). So there are always 5 outgoing API requests, each a unique ID (ones not cached in `redis`).