// Debug: inspect what the proxy returns and whether the hydration script
// is injected, regardless of the Incapsula 403.
import fs from 'fs'

const BASE = 'http://localhost:3000'

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'admin', password: 'AdminTest!2024' }),
  })
  const cookieJar = (loginRes.headers.get('set-cookie') || '').split(';')[0]

  // Check credentials endpoint in the SAME server instance.
  const credRes = await fetch(`${BASE}/api/medefis/credentials`, {
    headers: { cookie: cookieJar },
  })
  const credData = await credRes.json()
  console.log('credentials hasTokens:', credData.status?.hasTokens)
  console.log('credentials hasCookies:', credData.status?.hasCookies)
  console.log('credentials valid:', credData.status?.valid)

  // Fetch the proxied page directly.
  const res = await fetch(`${BASE}/api/medefis/proxy/vms.medefis5.com/`, {
    headers: { cookie: cookieJar },
  })
  const html = await res.text()
  console.log('status:', res.status)
  console.log('content-type:', res.headers.get('content-type'))
  console.log('html length:', html.length)
  console.log('has <head:', /<head[^>]*>/i.test(html))
  console.log('has </head>:', /<\/head>/i.test(html))
  console.log('has <html:', /<html[^>]*>/i.test(html))
  console.log('has "localStorage.setItem":', html.includes('localStorage.setItem'))
  console.log('has "token hydration":', html.includes('token hydration'))
  console.log('has "oidc.user":', html.includes('oidc.user'))
  console.log('--- first 600 chars ---')
  console.log(html.slice(0, 600))
  console.log('--- last 400 chars ---')
  console.log(html.slice(-400))
}

main().catch((e) => { console.error(e); process.exit(1) })
