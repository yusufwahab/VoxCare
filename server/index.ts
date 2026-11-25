/** Render entry point: listens and hands every request to server/app.ts. */
import { createServer } from 'node:http'
import { handle } from './app.js'

const port = Number(process.env.PORT ?? 3000)
createServer((req, res) => void handle(req, res)).listen(port, '0.0.0.0', () => console.log(`voxcare-api listening on ${port}`))
