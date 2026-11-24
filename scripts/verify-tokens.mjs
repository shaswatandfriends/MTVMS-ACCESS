// One-off verification: store captured Medefis tokens and confirm the proxy
// injects the OIDC hydration script into the proxied HTML.
import fs from 'fs'

const BASE = 'http://localhost:3000'

async function main() {
  // 1. Log in as admin.
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'admin', password: 'AdminTest!2024' }),
  })
  const cookie = loginRes.headers.get('set-cookie') || ''
  const cookieJar = cookie.split(';')[0] // pcs_session=...
  console.log('1. Admin login:', loginRes.status, cookieJar ? 'OK' : 'NO COOKIE')

  // 2. Read the captured tokens blob.
  const tokens = fs.readFileSync('./upload/Pasted Content_1795484740870.txt', 'utf8')
  console.log('2. Tokens blob size:', tokens.length, 'bytes')

  // 3. POST the session with cookies + tokens.
  const cookies =
    'visid_incap_1921308=Ui99NucnRruZN19VDrskPvzbBGsAAAAAQUIPAAAAAAAqoWefjPrYflDXZX9tYLE5; incap_ses_988_2990938=mIj+FnhPJUJ+WMFYOBW2DYXnBGsAAAAAd17ZMgnHNWCOHvrRyFV7AQ=='
  const pasteRes = await fetch(`${BASE}/api/medefis/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({ cookies, appBaseUrl: 'https://vms.medefis5.com', tokens }),
  })
  const pasteData = await pasteRes.json()
  console.log('3. Paste session:', pasteRes.status, 'ok=', pasteData.ok)
  console.log('   status.hasTokens:', pasteData.status?.hasTokens, 'hasCookies:', pasteData.status?.hasCookies)
  console.log('   status.valid:', pasteData.status?.valid, 'appBaseUrl:', pasteData.status?.appBaseUrl)
  if (pasteData.error) console.log('   ERROR:', pasteData.error)

  // 4. Verify the credentials endpoint reports tokens.
  const credRes = await fetch(`${BASE}/api/medefis/credentials`, { headers: { cookie: cookieJar } })
  const credData = await credRes.json()
  console.log('4. Credentials status: hasTokens=', credData.status?.hasTokens, 'expiresAt=', credData.status?.expiresAt)

  // 5. Fetch the proxied HTML and check for the hydration script + OIDC key.
  const proxyRes = await fetch(`${BASE}/api/medefis/proxy`, {
    headers: { cookie: cookieJar },
    redirect: 'manual',
  })
  console.log('5. Proxy entry:', proxyRes.status, proxyRes.headers.get('location'))
  const loc = proxyRes.headers.get('location') || ''
  const proxied = await fetch(loc || `${BASE}/api/medefis/proxy/vms.medefis5.com/`, {
    headers: { cookie: cookieJar },
  })
  const html = await proxied.text()
  console.log('   proxied status:', proxied.status, 'html length:', html.length)
  const hasHydration = html.includes('token hydration failed') || html.includes('window.localStorage.setItem')
  const hasOidcKey = html.includes('oidc.user:https://identity.medefis5.com')
  const hasAccessToken = html.includes('access_token')
  console.log('   hydration script injected:', hasHydration)
  console.log('   oidc.user key in injected blob:', hasOidcKey)
  console.log('   access_token in injected blob:', hasAccessToken)
}

main().catch((e) => { console.error(e); process.exit(1) })
