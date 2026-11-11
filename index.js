/**
 * Host half of dsh-workspace-view.
 *
 * The page itself lives in the browser half. This half owns the one thing a
 * browser cannot share across origins: the group layout. It answers a small
 * same-origin JSON route and stores the value under the DSH home, so the
 * desktop window and any browser that reaches the same Host see one layout.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const STATE_PATH = '/dsh-workspace-view/state'

/** The layout is a few kilobytes; anything this large is not ours. */
const BODY_LIMIT = 512 * 1024

function stateFile() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, 'dsh-workspace-view', 'groups.json')
}

function isLayout(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && value.version === 1
}

async function readLayout(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'))
    return isLayout(value) ? value : null
  } catch (_error) {
    return null
  }
}

async function writeLayout(file, value) {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(value))
  await rename(temp, file)
}

function send(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(text)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) throw new Error('body-too-large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Refuse cross-site writes; a same-origin fetch carries the same Host. */
function sameOrigin(req) {
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin === undefined || host === undefined) return true
  try {
    return new URL(origin).host === host
  } catch (_error) {
    return false
  }
}

export function apply(ctx) {
  const server = ctx.get('webServer')
  if (server === undefined) return

  const file = stateFile()

  ctx.effect(
    () =>
      server.register({
        kind: 'exact',
        path: STATE_PATH,
        handler: async (req, res) => {
          try {
            const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
            if (pathname !== STATE_PATH) {
              send(res, 404, { error: 'not-found' })
              return
            }

            if (req.method === 'GET') {
              send(res, 200, { state: await readLayout(file) })
              return
            }

            if (req.method === 'PUT') {
              if (!sameOrigin(req)) {
                send(res, 403, { error: 'cross-origin' })
                return
              }
              const value = JSON.parse(await readBody(req))
              if (!isLayout(value)) {
                send(res, 400, { error: 'invalid-layout' })
                return
              }
              await writeLayout(file, value)
              send(res, 200, { ok: true })
              return
            }

            res.setHeader('allow', 'GET, PUT')
            send(res, 405, { error: 'method-not-allowed' })
          } catch (error) {
            const code = error instanceof Error && error.message === 'body-too-large' ? 413 : 400
            send(res, code, { error: 'bad-request' })
          }
        },
      }),
    'dsh-workspace-view: state route',
  )
}
