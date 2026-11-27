/**
 * Host half of dsh-workspace-view.
 *
 * The page itself lives in the browser half. This half owns the one thing a
 * browser cannot share across origins: the group layout. It answers a small
 * same-origin JSON route and stores the value under the DSH home, so the
 * desktop window and any browser that reaches the same Host see one layout.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const STATE_PATH = '/dsh-workspace-view/state'
export const PROBE_PATH = '/dsh-workspace-view/probe'

/** The route needs the HTTP carrier; wait for it instead of racing the loader. */
export const inject = ['webServer']

/** The layout is a few kilobytes; anything this large is not ours. */
const BODY_LIMIT = 512 * 1024

/** At most this many paths per probe; a profile never has more workspaces. */
const PROBE_LIMIT = 400

/** Recheck interval for one path, so a mount that comes back clears the badge. */
const PROBE_TTL_MS = 60 * 1000

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
  const probeCache = new Map()

  const probePath = async (path) => {
    const cached = probeCache.get(path)
    if (cached !== undefined && cached.at + PROBE_TTL_MS > Date.now()) return cached.state
    let next
    try {
      const info = await stat(path)
      next = info.isDirectory() ? 'ok' : 'missing'
    } catch (error) {
      const code = error !== null && typeof error === 'object' ? error.code : undefined
      next = code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'unreachable'
    }
    probeCache.set(path, { at: Date.now(), state: next })
    if (probeCache.size > PROBE_LIMIT * 4) {
      const cutoff = Date.now() - PROBE_TTL_MS * 10
      for (const [key, value] of probeCache) if (value.at < cutoff) probeCache.delete(key)
    }
    return next
  }

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

  ctx.effect(
    () =>
      server.register({
        kind: 'exact',
        path: PROBE_PATH,
        handler: async (req, res) => {
          try {
            if (req.method !== 'POST') {
              res.setHeader('allow', 'POST')
              send(res, 405, { error: 'method-not-allowed' })
              return
            }
            if (!sameOrigin(req)) {
              send(res, 403, { error: 'cross-origin' })
              return
            }
            const body = JSON.parse(await readBody(req))
            const paths = Array.isArray(body?.paths)
              ? body.paths.filter((path) => typeof path === 'string' && path !== '').slice(0, PROBE_LIMIT)
              : []
            const missing = []
            const unreachable = []
            const results = await Promise.all(paths.map(async (path) => [path, await probePath(path)]))
            for (const [path, state] of results) {
              if (state === 'missing') missing.push(path)
              else if (state === 'unreachable') unreachable.push(path)
            }
            send(res, 200, { missing, unreachable })
          } catch (error) {
            const code = error instanceof Error && error.message === 'body-too-large' ? 413 : 400
            send(res, code, { error: 'bad-request' })
          }
        },
      }),
    'dsh-workspace-view: probe route',
  )
}
