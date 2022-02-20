import {nanoid} from "nanoid"
import setupRequester from "./main"

(async () => {
  const testIdNum = 10
  const requestIds: string[] = Array.from(Array(testIdNum), () => nanoid())

  const requester = await setupRequester(requestIds)

  requester.init()

  const data = await requester.onEnd()
  console.log(data)

  process.exit(1)
})()
