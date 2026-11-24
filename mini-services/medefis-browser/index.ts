/**
 * medefis-browser — headless Chromium mini-service (port 3003).
 *
 * Runs a real Playwright Chromium that logs into Medefis on behalf of the
 * admin. Because it is a genuine browser, it passes Incapsula's bot
 * challenge. After login it extracts the cookies + OIDC tokens and hands
 * them to the gateway, which then serves employees through the lightweight
 * proxy (same server IP → Incapsula accepts the cookies).
 *
 * If the SSO login has MFA/captcha that can't be auto-completed, the
 * service pauses and exposes the live page via /screenshot + /click +
 * /type so the admin can finish the login manually through the gateway UI.
 *
 * Endpoints:
 *   GET  /status                 -> { ok, hasPage, url, title }
 *   POST /login                  -> { entryUrl, username, password }
 *                                   -> { ok, cookies, tokens, appBaseUrl } or
 *                                      { ok:false, needManual:true, reason, url }
 *   GET  /screenshot             -> image/png of the current page
 *   POST /click                  -> { x, y }
 *   POST /type                   -> { text }
 *   POST /press                  -> { key }
 *   POST /fill                   -> { selector, value }
 *   GET  /extract                -> { ok, cookies, tokens, appBaseUrl }
 *   POST /close                  -> shut down the browser
 */

import { chromium, type BrowserContext, type Page } from 'playwright'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const PORT = 3003
const USER_DATA_DIR = join(import.meta.dir, 'browser-data')
const APP_HOSTS = ['vms.medefis5.com', 'medefis5.com', 'vendor.medefis5.com']
const IDENTITY_HOST = 'identity.medefis5.com'

if (!existsSync(USER_DATA_DIR)) mkdirSync(USER_DATA_DIR, { recursive: true })

let context: BrowserContext | null = null
let page: Page | null = null
let launching = false

async function ensureBrowser(): Promise<{ context: BrowserContext; page: Page }> {
  if (context && page && !page.isClosed()) return { context, page }
  if (launching) {
    // wait for in-progress launch
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100))
      if (context && page && !page.isClosed()) return { context, page }
    }
  }
  launching = true
  try {
    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })
    // Reduce webdriver detection signals.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    const pages = context.pages()
    page = pages.length ? pages[0] : await context.newPage()
  } finally {
    launching = false
  }
  return { context, page }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  })
}

function isAppUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return APP_HOSTS.includes(h)
  } catch {
    return false
  }
}

function isIdentityUrl(url: string): boolean {
  try {
    return new URL(url).hostname === IDENTITY_HOST
  } catch {
    return false
  }
}

/**
 * Auto-fill and submit the SSO login form. Returns true if it looks like it
 * submitted, false if the form couldn't be found (caller should go manual).
 */
async function autoFillLogin(page: Page, username: string, password: string): Promise<boolean> {
  // Locate the password field — the most reliable signal of a login form.
  const passwordField = await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .then(() => page.locator('input[type="password"]').first())
    .catch(() => null)

  if (!passwordField) return false

  // Find the username field: prefer named/email/text inputs that appear
  // before the password field.
  const usernameSelectors = [
    'input[name="username"]',
    'input[name="UserName"]',
    'input[name="user"]',
    'input[name="email"]',
    'input[name="login"]',
    'input[name="account"]',
    'input[type="email"]',
    'input[type="text"]',
    'input[type="tel"]',
  ]
  let filledUser = false
  for (const sel of usernameSelectors) {
    const loc = page.locator(sel).first()
    if (await loc.isVisible().catch(() => false)) {
      await loc.fill(username)
      filledUser = true
      break
    }
  }
  if (!filledUser) {
    // fallback: first visible text-like input
    const any = page.locator('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"])').first()
    if (await any.isVisible().catch(() => false)) {
      await any.fill(username)
      filledUser = true
    }
  }

  await passwordField.fill(password)

  // Submit: prefer a submit button, else press Enter on the password field.
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:not([type])',
    'a[role="button"]',
  ]
  let submitted = false
  for (const sel of submitSelectors) {
    const loc = page.locator(sel).first()
    if (await loc.isVisible().catch(() => false)) {
      await loc.click().catch(() => {})
      submitted = true
      break
    }
  }
  if (!submitted) {
    await passwordField.press('Enter')
    submitted = true
  }
  return submitted
}

/** Wait for the SPA to populate sessionStorage with the OIDC user object. */
async function waitForOidcToken(page: Page, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const has = await page
      .evaluate(() => Object.keys(sessionStorage).some((k) => k.startsWith('oidc.user')))
      .catch(() => false)
    if (has) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

/** Extract cookies + localStorage + sessionStorage from the current page. */
async function extractSession(page: Page, context: BrowserContext) {
  const cookies = await context.cookies()
  const storage = await page
    .evaluate(() => ({
      localStorage: Object.fromEntries(Object.entries(localStorage)),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
    }))
    .catch(() => ({ localStorage: {}, sessionStorage: {} }))
  const url = page.url()
  let appBaseUrl = ''
  try {
    const u = new URL(url)
    appBaseUrl = `${u.protocol}//${u.host}`
  } catch {
    appBaseUrl = 'https://vms.medefis5.com'
  }
  // Build a cookie header string for the gateway (all cookies, any domain).
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  return {
    cookies: cookieHeader,
    cookieList: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
    })),
    tokens: storage,
    appBaseUrl,
    pageUrl: url,
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      })
    }

    try {
      // ---- status ----
      if (path === '/status' && method === 'GET') {
        return json({
          ok: true,
          hasPage: !!page && !page.isClosed(),
          url: page?.url() ?? null,
          title: page ? await page.title().catch(() => null) : null,
        })
      }

      // ---- login ----
      if (path === '/login' && method === 'POST') {
        const body = await req.json().catch(() => ({} as any))
        const { entryUrl, username, password } = body as {
          entryUrl?: string
          username?: string
          password?: string
        }
        if (!entryUrl) return json({ ok: false, error: 'entryUrl is required' }, 400)

        const { page: p } = await ensureBrowser()

        // 1. Navigate to the entry URL (vendor portal → redirects to SSO).
        try {
          await p.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
        } catch (e) {
          return json({ ok: false, error: 'Failed to open entry URL: ' + String(e) })
        }

        // Give redirects a moment to settle.
        await p.waitForLoadState('networkidle').catch(() => {})
        let currentUrl = p.url()

        // 2. If already on the app (persistent session), just extract.
        if (isAppUrl(currentUrl)) {
          await waitForOidcToken(p)
          const session = await extractSession(p, context!)
          return json({ ok: true, ...session })
        }

        // 3. If on the identity login page, auto-fill credentials.
        if (isIdentityUrl(currentUrl) || (await p.locator('input[type="password"]').first().isVisible().catch(() => false))) {
          if (!username || !password) {
            return json({
              ok: false,
              needManual: true,
              reason: 'No credentials provided — complete the login manually.',
              url: currentUrl,
            })
          }
          const filled = await autoFillLogin(p, username, password)
          if (!filled) {
            return json({
              ok: false,
              needManual: true,
              reason: 'Could not detect the login form automatically.',
              url: currentUrl,
            })
          }
          // Wait for navigation away from the login page.
          await p
            .waitForURL((u) => !isIdentityUrl(u.toString()), { timeout: 30000 })
            .catch(() => {})
          currentUrl = p.url()
        }

        // 4. Did we land on the app?
        if (isAppUrl(currentUrl)) {
          await waitForOidcToken(p)
          const session = await extractSession(p, context!)
          return json({ ok: true, ...session })
        }

        // 5. Still on identity / somewhere unexpected → likely MFA/captcha.
        return json({
          ok: false,
          needManual: true,
          reason: 'Login did not reach the Medefis app — MFA, captcha, or error page may be showing.',
          url: currentUrl,
        })
      }

      // ---- screenshot ----
      if (path === '/screenshot' && method === 'GET') {
        if (!page || page.isClosed()) return json({ error: 'no page' }, 400)
        const buf = await page.screenshot({ type: 'png', fullPage: false })
        return new Response(buf, {
          headers: {
            'content-type': 'image/png',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
          },
        })
      }

      // ---- click ----
      if (path === '/click' && method === 'POST') {
        const { x, y } = await req.json().catch(() => ({} as any))
        if (!page || page.isClosed()) return json({ error: 'no page' }, 400)
        await page.mouse.click(Number(x), Number(y))
        return json({ ok: true })
      }

      // ---- type ----
      if (path === '/type' && method === 'POST') {
        const { text } = await req.json().catch(() => ({} as any))
        if (!page || page.isClosed()) return json({ error: 'no page' }, 400)
        await page.keyboard.type(String(text))
        return json({ ok: true })
      }

      // ---- press ----
      if (path === '/press' && method === 'POST') {
        const { key } = await req.json().catch(() => ({} as any))
        if (!page || page.isClosed()) return json({ error: 'no page' }, 400)
        await page.keyboard.press(String(key))
        return json({ ok: true })
      }

      // ---- fill (by selector) ----
      if (path === '/fill' && method === 'POST') {
        const { selector, value } = await req.json().catch(() => ({} as any))
        if (!page || page.isClosed()) return json({ error: 'no page' }, 400)
        await page.locator(String(selector)).first().fill(String(value))
        return json({ ok: true })
      }

      // ---- extract ----
      if (path === '/extract' && method === 'GET') {
        if (!page || page.isClosed()) return json({ error: 'no page' }, 400)
        // Only extract if we're on the app host (tokens live there).
        if (!isAppUrl(page.url())) {
          return json({
            ok: false,
            error: 'Not on the Medefis app page. Current URL: ' + page.url(),
          })
        }
        await waitForOidcToken(page)
        const session = await extractSession(page, context!)
        return json({ ok: true, ...session })
      }

      // ---- close ----
      if (path === '/close' && method === 'POST') {
        if (context) {
          await context.close().catch(() => {})
          context = null
          page = null
        }
        return json({ ok: true })
      }

      return json({ error: 'not found', path }, 404)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return json({ ok: false, error: msg }, 500)
    }
  },
})

console.log(`medefis-browser listening on http://localhost:${PORT}`)
export default server
