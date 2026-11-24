import { db } from './db'
import { encrypt, decrypt } from './crypto'

/**
 * Medefis integration layer.
 *
 * The parent system never exposes Medefis credentials to employees.
 * Instead it either (a) performs a server-side login with the stored
 * credentials and captures the session cookies, or (b) accepts cookies
 * pasted manually by the admin (reliable fallback for SSO flows).
 *
 * Employees then browse Medefis through `/api/medefis/proxy/<host>/<path>`
 * which injects the captured cookies and rewrites upstream URLs so the
 * whole application appears to live inside our origin.
 */

// Known Medefis hosts. The login (identity) host and any app hosts that
// appear after the SSO redirect are proxied through host-qualified paths.
const IDENTITY_HOST = 'identity.medefis5.com'
const DEFAULT_APP_HOST = 'medefis5.com'

export interface MedefisCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
}

export interface LoginResult {
  success: boolean
  error?: string
  cookies?: MedefisCookie[]
  appBaseUrl?: string
}

/* ----------------------------- Cookie storage ------------------------------- */

export async function getStoredCookies(): Promise<MedefisCookie[]> {
  const session = await db.medefisSession.findFirst({
    orderBy: { updatedAt: 'desc' },
  })
  if (!session) return []
  try {
    const json = decrypt(session.cookiesBlob)
    return JSON.parse(json) as MedefisCookie[]
  } catch {
    return []
  }
}

export async function getStoredAppBaseUrl(): Promise<string | null> {
  const session = await db.medefisSession.findFirst({
    orderBy: { updatedAt: 'desc' },
  })
  return session?.appBaseUrl ?? null
}

export async function saveSession(
  cookies: MedefisCookie[],
  appBaseUrl: string,
  valid = true,
) {
  const blob = encrypt(JSON.stringify(cookies))
  const existing = await db.medefisSession.findFirst()
  const expiresAt = computeExpiry(cookies)
  if (existing) {
    await db.medefisSession.update({
      where: { id: existing.id },
      data: { cookiesBlob: blob, appBaseUrl, valid, expiresAt, updatedAt: new Date() },
    })
  } else {
    await db.medefisSession.create({
      data: { cookiesBlob: blob, appBaseUrl, valid, expiresAt },
    })
  }
}

export async function markSessionInvalid() {
  const existing = await db.medefisSession.findFirst()
  if (existing) {
    await db.medefisSession.update({
      where: { id: existing.id },
      data: { valid: false },
    })
  }
}

export async function getSessionStatus() {
  const session = await db.medefisSession.findFirst({ orderBy: { updatedAt: 'desc' } })
  const cred = await db.medefisCredential.findFirst()
  return {
    hasCredentials: !!cred,
    hasSession: !!session && session.valid,
    valid: session?.valid ?? false,
    appBaseUrl: session?.appBaseUrl ?? null,
    expiresAt: session?.expiresAt ?? null,
    updatedAt: session?.updatedAt ?? null,
    lastVerifiedAt: cred?.lastVerifiedAt ?? null,
    lastError: cred?.lastError ?? session?.appBaseUrl ? null : null,
  }
}

function computeExpiry(cookies: MedefisCookie[]): Date | null {
  let latest: number | null = null
  for (const c of cookies) {
    if (!c.expires) continue
    const t = Date.parse(c.expires)
    if (!isNaN(t)) {
      if (latest === null || t > latest) latest = t
    }
  }
  if (latest === null) {
    // default 8 hours if no explicit expiry
    return new Date(Date.now() + 8 * 60 * 60 * 1000)
  }
  return new Date(latest)
}

/* --------------------------- Credential storage ----------------------------- */

export async function saveCredentials(username: string, password: string) {
  const usernameCipher = encrypt(username)
  const passwordCipher = encrypt(password)
  const existing = await db.medefisCredential.findFirst()
  if (existing) {
    await db.medefisCredential.update({
      where: { id: existing.id },
      data: { username, usernameCipher, passwordCipher, lastError: null, updatedAt: new Date() },
    })
  } else {
    await db.medefisCredential.create({
      data: { username, usernameCipher, passwordCipher },
    })
  }
}

export async function getStoredCredentials(): Promise<{ username: string; password: string } | null> {
  const cred = await db.medefisCredential.findFirst()
  if (!cred) return null
  try {
    return {
      username: decrypt(cred.usernameCipher),
      password: decrypt(cred.passwordCipher),
    }
  } catch {
    return null
  }
}

export async function setCredentialError(error: string | null) {
  const cred = await db.medefisCredential.findFirst()
  if (cred) {
    await db.medefisCredential.update({
      where: { id: cred.id },
      data: { lastError: error, lastVerifiedAt: error ? null : new Date() },
    })
  }
}

export async function clearCredentials() {
  await db.medefisCredential.deleteMany()
}

/* ------------------------------- Login flow --------------------------------- */

/**
 * Parse Set-Cookie headers (which may contain multiple cookies) into
 * structured cookie objects.
 */
function parseSetCookies(setCookieHeaders: string[]): MedefisCookie[] {
  const cookies: MedefisCookie[] = []
  for (const header of setCookieHeaders) {
    if (!header) continue
    const parts = header.split(';').map((p) => p.trim())
    if (!parts.length) continue
    const [nameValue, ...attrs] = parts
    const eq = nameValue.indexOf('=')
    if (eq === -1) continue
    const name = nameValue.slice(0, eq).trim()
    const value = nameValue.slice(eq + 1).trim()
    const cookie: MedefisCookie = { name, value, domain: '', path: '/' }
    for (const attr of attrs) {
      const aeq = attr.indexOf('=')
      const attrName = (aeq === -1 ? attr : attr.slice(0, aeq)).toLowerCase()
      const attrVal = aeq === -1 ? '' : attr.slice(aeq + 1)
      if (attrName === 'domain') cookie.domain = attrVal
      else if (attrName === 'path') cookie.path = attrVal || '/'
      else if (attrName === 'expires') cookie.expires = attrVal
      else if (attrName === 'httponly') cookie.httpOnly = true
      else if (attrName === 'secure') cookie.secure = true
      else if (attrName === 'samesite') cookie.sameSite = attrVal
    }
    cookies.push(cookie)
  }
  return cookies
}

function cookieHeader(cookies: MedefisCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

function mergeCookies(
  existing: MedefisCookie[],
  incoming: MedefisCookie[],
): MedefisCookie[] {
  const map = new Map<string, MedefisCookie>()
  for (const c of existing) map.set(`${c.domain}|${c.path}|${c.name}`, c)
  for (const c of incoming) {
    const key = `${c.domain}|${c.path}|${c.name}`
    if (c.value === '' && c.expires && Date.parse(c.expires) < Date.now()) {
      map.delete(key)
    } else {
      map.set(key, c)
    }
  }
  return Array.from(map.values())
}

/**
 * Fetch a URL following redirects manually so we can accumulate the
 * Set-Cookie headers across the whole chain (Node fetch does not expose
 * intermediate cookies by default).
 */
async function fetchWithCookieChain(
  url: string,
  init: RequestInit = {},
  startingCookies: MedefisCookie[] = [],
): Promise<{
  finalUrl: string
  status: number
  cookies: MedefisCookie[]
  headers: Headers
  body: string
}> {
  let currentUrl = url
  let cookies = [...startingCookies]
  let status = 200
  let headers = new Headers()
  let body = ''
  const maxRedirects = 12

  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
      headers: {
        ...(init.headers || {}),
        cookie: cookieHeader(cookies.filter((c) => matchesDomain(c, new URL(currentUrl).hostname))),
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    })

    status = res.status
    headers = res.headers

    // Accumulate Set-Cookie (node exposes them as an array via getSetCookie)
    const setCookies = res.headers.getSetCookie?.() ?? []
    if (setCookies.length) {
      const parsed = parseSetCookies(setCookies).map((c) => ({
        ...c,
        domain: c.domain || new URL(currentUrl).hostname,
      }))
      cookies = mergeCookies(cookies, parsed)
    }

    if (status >= 300 && status < 400) {
      const loc = res.headers.get('location')
      if (loc) {
        currentUrl = new URL(loc, currentUrl).toString()
        continue
      }
    }

    body = await res.text()
    break
  }

  return { finalUrl: currentUrl, status, cookies, headers, body }
}

function matchesDomain(cookie: MedefisCookie, host: string): boolean {
  if (!cookie.domain) return true
  const d = cookie.domain.replace(/^\./, '')
  return host === d || host.endsWith('.' + d)
}

/**
 * Attempt an automatic server-side login to Medefis using stored
 * credentials. Best-effort: SSO/SAML flows may require a manual cookie
 * paste (see `saveManualCookies`).
 */
export async function performMedefisLogin(signinParam?: string): Promise<LoginResult> {
  const creds = await getStoredCredentials()
  if (!creds) {
    return { success: false, error: 'No Medefis credentials stored.' }
  }

  try {
    const loginUrl = signinParam
      ? `https://${IDENTITY_HOST}/identity/login?signin=${encodeURIComponent(signinParam)}`
      : `https://${IDENTITY_HOST}/identity/login`

    // 1. Fetch the login page (may set csrf cookies).
    const page = await fetchWithCookieChain(loginUrl, { method: 'GET' })
    const pageCookies = page.cookies

    // 2. Parse the login form to collect hidden fields + form action.
    const form = parseLoginForm(page.body, loginUrl)
    if (!form) {
      // Could not detect a form; fall back to a direct POST with common field names.
      const result = await submitLoginGuess(
        loginUrl,
        creds.username,
        creds.password,
        pageCookies,
      )
      return result
    }

    // 3. Fill username/password and POST.
    const fields: Record<string, string> = { ...form.fields }
    fields[form.usernameField] = creds.username
    fields[form.passwordField] = creds.password

    const body = new URLSearchParams(fields).toString()
    const result = await fetchWithCookieChain(form.action, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        referer: loginUrl,
      },
      body,
    }, pageCookies)

    const appBaseUrl = deriveAppBaseUrl(result.finalUrl, page.body)
    await saveSession(result.cookies, appBaseUrl, true)
    await setCredentialError(null)

    return {
      success: true,
      cookies: result.cookies,
      appBaseUrl,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await setCredentialError(msg)
    return { success: false, error: msg }
  }
}

interface ParsedForm {
  action: string
  method: string
  fields: Record<string, string>
  usernameField: string
  passwordField: string
}

function parseLoginForm(html: string, baseUrl: string): ParsedForm | null {
  // Find <form ...> blocks. We prefer a form that contains a password field.
  const formRegex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi
  let match: RegExpExecArray | null
  while ((match = formRegex.exec(html)) !== null) {
    const attrs = match[1]
    const inner = match[2]
    const actionMatch = attrs.match(/action\s*=\s*"([^"]*)"/i) || attrs.match(/action\s*=\s*'([^']*)'/i)
    const methodMatch = attrs.match(/method\s*=\s*"([^"]*)"/i) || attrs.match(/method\s*=\s*'([^']*)'/i)
    const action = actionMatch ? new URL(actionMatch[1], baseUrl).toString() : baseUrl
    const method = (methodMatch ? methodMatch[1] : 'POST').toUpperCase()

    // Collect inputs
    const fields: Record<string, string> = {}
    let usernameField = ''
    let passwordField = ''
    const inputRegex = /<input\b([^>]*)\/?>/gi
    let im: RegExpExecArray | null
    while ((im = inputRegex.exec(inner)) !== null) {
      const a = im[1]
      const nameM = a.match(/name\s*=\s*"([^"]*)"/i) || a.match(/name\s*=\s*'([^']*)'/i)
      if (!nameM) continue
      const name = nameM[1]
      const valueM = a.match(/value\s*=\s*"([^"]*)"/i) || a.match(/value\s*=\s*'([^']*)'/i)
      const value = valueM ? valueM[1] : ''
      const typeM = a.match(/type\s*=\s*"([^"]*)"/i) || a.match(/type\s*=\s*'([^']*)'/i)
      const type = (typeM ? typeM[1] : 'text').toLowerCase()
      if (type === 'password') {
        passwordField = name
      } else if (
        !usernameField &&
        (type === 'text' || type === 'email') &&
        /(user|email|login|account)/i.test(name)
      ) {
        usernameField = name
      }
      if (type !== 'submit' && type !== 'button' && type !== 'reset') {
        fields[name] = value
      }
    }

    if (passwordField) {
      if (!usernameField) {
        // first text field without a known name becomes username
        const textNames = Object.keys(fields).filter((n) => n !== passwordField)
        usernameField = textNames[0] ?? 'username'
      }
      return { action, method, fields, usernameField, passwordField }
    }
  }
  return null
}

async function submitLoginGuess(
  loginUrl: string,
  username: string,
  password: string,
  pageCookies: MedefisCookie[],
): Promise<LoginResult> {
  const guesses = [
    { u: 'username', p: 'password' },
    { u: 'UserName', p: 'Password' },
    { u: 'email', p: 'password' },
    { u: 'user', p: 'pass' },
    { u: 'login', p: 'password' },
  ]
  for (const g of guesses) {
    const body = new URLSearchParams({ [g.u]: username, [g.p]: password }).toString()
    const result = await fetchWithCookieChain(loginUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }, pageCookies)
    const hasSessionCookie = result.cookies.some(
      (c) => c.name.toLowerCase().includes('asp') || c.name.toLowerCase().includes('session') || c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('med'),
    )
    if (hasSessionCookie || (result.status >= 200 && result.status < 300)) {
      const appBaseUrl = deriveAppBaseUrl(result.finalUrl, '')
      await saveSession(result.cookies, appBaseUrl, true)
      await setCredentialError(null)
      return { success: true, cookies: result.cookies, appBaseUrl }
    }
  }
  await setCredentialError('Could not detect login form fields automatically. Use manual cookie paste.')
  return { success: false, error: 'Login form could not be parsed. Please use manual cookie paste.' }
}

function deriveAppBaseUrl(finalUrl: string, html: string): string {
  // If we ended on a non-identity host, that's the app.
  try {
    const u = new URL(finalUrl)
    if (u.hostname !== IDENTITY_HOST) {
      return `${u.protocol}//${u.host}`
    }
  } catch {
    /* ignore */
  }
  // Look for a meta refresh or base href pointing to the app.
  const baseM = html.match(/<base\s+href="([^"]+)"/i)
  if (baseM) {
    try {
      const u = new URL(baseM[1])
      if (u.hostname !== IDENTITY_HOST) return `${u.protocol}//${u.host}`
    } catch {
      /* ignore */
    }
  }
  return `https://${DEFAULT_APP_HOST}`
}

/* --------------------------- Manual cookie paste ---------------------------- */

/**
 * Admin can paste a cookie header string copied from their own browser
 * DevTools after logging into Medefis. This is the reliable path for
 * SSO/SAML providers that resist headless automation.
 */
export async function saveManualCookies(
  cookieHeader: string,
  appBaseUrl: string,
): Promise<LoginResult> {
  const cookies: MedefisCookie[] = []
  const parts = cookieHeader.split(';').map((p) => p.trim()).filter(Boolean)
  let host = DEFAULT_APP_HOST
  try {
    host = new URL(appBaseUrl).hostname
  } catch {
    /* keep default */
  }
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    cookies.push({
      name: part.slice(0, eq).trim(),
      value: part.slice(eq + 1).trim(),
      domain: host,
      path: '/',
    })
  }
  if (!cookies.length) {
    return { success: false, error: 'No valid cookies detected in the pasted header.' }
  }
  await saveSession(cookies, appBaseUrl, true)
  await setCredentialError(null)
  return { success: true, cookies, appBaseUrl }
}

/* --------------------------------- Proxy ----------------------------------- */

export interface ProxyResult {
  status: number
  headers: Record<string, string>
  body: Buffer
}

const UPSTREAM_HOSTS = new Set([
  IDENTITY_HOST,
  DEFAULT_APP_HOST,
  'www.medefis5.com',
  'app.medefis5.com',
  'vendor.medefis5.com',
  'vms.medefis5.com',
])

/**
 * Resolve the host-qualified proxy prefix for a given upstream host.
 * e.g. identity.medefis5.com -> "/api/medefis/proxy/identity.medefis5.com"
 */
export function proxyPrefixForHost(host: string): string {
  return `/api/medefis/proxy/${host}`
}

/**
 * Rewrite an upstream absolute URL so it points back into our proxy.
 * Returns null if the URL is not a known Medefis host.
 */
export function rewriteUpstreamUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl, 'https://placeholder.invalid/')
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      if (UPSTREAM_HOSTS.has(u.hostname)) {
        const path = u.pathname + u.search + u.hash
        return `${proxyPrefixForHost(u.hostname)}${path}`
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Rewrite URLs inside HTML/CSS/JS payloads so resources load through
 * the proxy. Also strips framing defenses so the result can be iframed.
 */
export function rewriteHtml(html: string): string {
  for (const host of UPSTREAM_HOSTS) {
    const re = new RegExp(
      `https?://${host.replace(/\./g, '\\.')}`,
      'g',
    )
    html = html.replace(re, proxyPrefixForHost(host))
    // protocol-relative URLs //host
    const re2 = new RegExp(`//${host.replace(/\./g, '\\.')}`, 'g')
    html = html.replace(re2, proxyPrefixForHost(host))
  }
  // Inject a tiny bootstrap script that patches client-side navigation
  // (window.location assignments, fetch/XHR) to stay within the proxy.
  const inject = `<script>(function(){
    try {
      var PREFIX='/api/medefis/proxy/';
      var HOSTS=['identity.medefis5.com','medefis5.com','www.medefis5.com','app.medefis5.com','vendor.medefis5.com','vms.medefis5.com'];
      function rewrite(u){
        try{ if(typeof u!=='string') return u;
          if(u.indexOf(PREFIX)===0) return u;
          for(var i=0;i<HOSTS.length;i++){var h=HOSTS[i];
            if(u.indexOf('https://'+h)===0) return PREFIX+h+u.slice(8+h.length);
            if(u.indexOf('http://'+h)===0) return PREFIX+h+u.slice(7+h.length);
            if(u.indexOf('//'+h)===0) return PREFIX+h+u.slice(2+h.length);
          }
        }catch(e){} return u;
      }
      var origFetch=window.fetch;
      if(origFetch){ window.fetch=function(input,init){
        if(typeof input==='string') input=rewrite(input);
        else if(input&&input.url) input=new Request(rewrite(input.url),input);
        return origFetch.call(this,input,init);
      }; }
      var XHR=window.XMLHttpRequest;
      if(XHR){ var origOpen=XHR.prototype.open;
        XHR.prototype.open=function(m,u){ return origOpen.call(this,m,rewrite(u)); };
      }
      // block top-level navigation out of the iframe
      var origAssign=window.location.assign?window.location.assign.bind(window.location):null;
      // No-op: links already rewritten in HTML.
    } catch(e){ }
  })();</script>`
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, inject + '</head>')
  } else if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, inject + '</body>')
  } else {
    html = inject + html
  }
  return html
}

/**
 * Headers we must strip so the proxied page can render inside our iframe
 * and so it does not fight our origin.
 */
const STRIP_RESPONSE_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'strict-transport-security',
  'set-cookie',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
])

export async function proxyRequest(
  host: string,
  pathWithSearch: string,
  method: string,
  reqHeaders: Headers,
  body: Buffer | null,
): Promise<ProxyResult> {
  const targetUrl = `https://${host}${pathWithSearch}`
  const cookies = await getStoredCookies()
  const hostCookies = cookies.filter((c) => matchesDomain(c, host))

  const forwardHeaders: Record<string, string> = {
    cookie: cookieHeader(hostCookies),
    'user-agent':
      reqHeaders.get('user-agent') ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: reqHeaders.get('accept') ?? '*/*',
    'accept-language': reqHeaders.get('accept-language') ?? 'en-US,en;q=0.9',
    referer: `https://${host}/`,
  }
  const xRequested = reqHeaders.get('x-requested-with')
  if (xRequested) forwardHeaders['x-requested-with'] = xRequested
  const xCsrf = reqHeaders.get('x-csrf-token') || reqHeaders.get('requestverificationtoken')
  if (xCsrf) forwardHeaders['x-csrf-token'] = xCsrf

  const init: RequestInit = {
    method: method.toUpperCase(),
    headers: forwardHeaders,
    redirect: 'manual',
  }
  if (body && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
    init.body = body
    const ct = reqHeaders.get('content-type')
    if (ct) forwardHeaders['content-type'] = ct
  }

  const res = await fetch(targetUrl, init)

  // Capture any refreshed cookies so the session stays alive.
  const setCookies = res.headers.getSetCookie?.() ?? []
  if (setCookies.length) {
    const parsed = parseSetCookies(setCookies).map((c) => ({
      ...c,
      domain: c.domain || host,
    }))
    const merged = mergeCookies(cookies, parsed)
    const appBaseUrl = (await getStoredAppBaseUrl()) ?? `https://${host}`
    await saveSession(merged, appBaseUrl, true)
  }

  const outHeaders: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (STRIP_RESPONSE_HEADERS.has(lower)) return
    if (lower === 'location') {
      const rewritten = rewriteUpstreamUrl(value)
      outHeaders[key] = rewritten ?? value
      return
    }
    outHeaders[key] = value
  })

  const buf = Buffer.from(await res.arrayBuffer())
  const ct = (res.headers.get('content-type') || '').toLowerCase()

  let finalBody = buf
  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    finalBody = Buffer.from(rewriteHtml(buf.toString('utf8')), 'utf8')
  } else if (ct.includes('text/css') || ct.includes('javascript') || ct.includes('text/javascript')) {
    let text = buf.toString('utf8')
    for (const host2 of UPSTREAM_HOSTS) {
      const re = new RegExp(`https?://${host2.replace(/\./g, '\\.')}`, 'g')
      text = text.replace(re, proxyPrefixForHost(host2))
    }
    finalBody = Buffer.from(text, 'utf8')
  }

  // If the upstream returned a redirect we did not rewrite (relative),
  // make it host-qualified so the iframe follows it correctly.
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location')
    if (loc && !outHeaders['Location'] && !outHeaders['location']) {
      const abs = new URL(loc, targetUrl)
      const rewritten = rewriteUpstreamUrl(abs.toString())
      outHeaders['Location'] = rewritten ?? abs.toString()
    }
  }

  return { status: res.status, headers: outHeaders, body: finalBody }
}

/* ----------------------------- Activity log -------------------------------- */

export async function logActivity(params: {
  employeeId?: string
  actor: string
  role: 'admin' | 'employee'
  action: string
  detail?: string
  ip?: string | null
}) {
  await db.activityLog.create({
    data: {
      employeeId: params.employeeId ?? null,
      actor: params.actor,
      role: params.role,
      action: params.action,
      detail: params.detail ?? null,
      ip: params.ip ?? null,
    },
  })
}
