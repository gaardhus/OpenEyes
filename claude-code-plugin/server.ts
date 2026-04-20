#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'

const PORT = Number(process.env.OPENEYES_PORT ?? 4097)
const STATE_DIR = join(homedir(), '.claude', 'openeyes')
const TOKEN_PATH = join(STATE_DIR, 'token')
const INBOX_DIR = join(tmpdir(), 'openeyes-inbox')

mkdirSync(STATE_DIR, { recursive: true })
mkdirSync(INBOX_DIR, { recursive: true })

const TOKEN = loadOrCreateToken()

function loadOrCreateToken(): string {
  if (existsSync(TOKEN_PATH)) return readFileSync(TOKEN_PATH, 'utf8').trim()
  const t = randomBytes(24).toString('base64url')
  writeFileSync(TOKEN_PATH, t + '\n', { mode: 0o600 })
  console.error(`[openeyes] generated token at ${TOKEN_PATH}`)
  return t
}

function tokenMatches(provided: string | null): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(TOKEN)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const mcp = new Server(
  { name: 'openeyes', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} } },
    instructions:
      'Events from the openeyes channel arrive as <channel source="openeyes" ...>. ' +
      'They carry an instruction plus a selected DOM element from a web page: ' +
      'its HTML, CSS selector, page URL/title, and usually a screenshot referenced ' +
      'by file_path. Read the screenshot with the Read tool when present. ' +
      'One-way channel: act on the request, no reply expected.',
  },
)

await mcp.connect(new StdioServerTransport())

type Payload = {
  instruction?: string
  html?: string
  url?: string
  title?: string
  cssSelector?: string
  screenshotBase64?: string
}

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, name: 'openeyes', version: '0.1.0' })
    }

    if (req.method !== 'POST' || url.pathname !== '/ingest') {
      return new Response('not found', { status: 404 })
    }

    const provided =
      req.headers.get('x-openeyes-token') ??
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      null
    if (!tokenMatches(provided)) return new Response('forbidden', { status: 403 })

    let payload: Payload
    try {
      payload = await req.json()
    } catch {
      return new Response('bad json', { status: 400 })
    }

    const meta: Record<string, string> = {}
    if (payload.url) meta.url = payload.url
    if (payload.title) meta.title = payload.title
    if (payload.cssSelector) meta.selector = payload.cssSelector

    if (payload.screenshotBase64) {
      const filename = `openeyes-${Date.now()}-${randomBytes(4).toString('hex')}.png`
      const filePath = join(INBOX_DIR, filename)
      writeFileSync(filePath, Buffer.from(payload.screenshotBase64, 'base64'))
      meta.file_path = filePath
    }

    const lines: string[] = []
    if (payload.instruction) lines.push(`## ${payload.instruction}`, '')
    if (payload.title || payload.url) {
      lines.push(`**Page:** [${payload.title ?? payload.url}](${payload.url ?? ''})`)
    }
    if (payload.cssSelector) lines.push(`**Element:** \`${payload.cssSelector}\``)
    if (payload.html) {
      lines.push('', '```html', payload.html, '```')
    }

    await mcp.notification({
      method: 'notifications/claude/channel',
      params: { content: lines.join('\n'), meta },
    })

    return Response.json({ ok: true })
  },
})

console.error(`[openeyes] listening on http://127.0.0.1:${PORT}`)
