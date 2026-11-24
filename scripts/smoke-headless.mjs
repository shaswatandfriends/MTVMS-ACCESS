// End-to-end smoke test: gateway -> headless browser service.
import fs from 'fs'

const BASE = 'http://localhost:3000'

async function main() {
  // 1. Admin login.
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'admin', username: 'admin', password: 'AdminTest!2024' }),
  })
  const cookieJar = (loginRes.headers.get('set-cookie') || '').split(';')[0]
  console.log('1. Admin login:', loginRes.status, cookieJar ? 'OK' : 'FAIL')

  // 2. Save credentials with an entry URL (example.com for smoke test).
  const credRes = await fetch(`${BASE}/api/medefis/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({ username: 'test.user', password: 'TestPass!2024', entryUrl: 'https://example.com' }),
  })
  console.log('2. Save credentials:', credRes.status, (await credRes.json()).ok ? 'OK' : 'FAIL')

  // 3. Verify credentials stored with entryUrl.
  const getRes = await fetch(`${BASE}/api/medefis/credentials`, { headers: { cookie: cookieJar } })
  const getData = await getRes.json()
  console.log('3. Stored entryUrl:', getData.entryUrl, '| username:', getData.username)

  // 4. Check headless browser service status.
  const statusRes = await fetch(`${BASE}/api/medefis/headless/status`, { headers: { cookie: cookieJar } })
  const statusData = await statusRes.json()
  console.log('4. Headless status:', statusRes.status, JSON.stringify(statusData).slice(0, 120))

  // 5. Trigger automated login (will navigate to example.com, return needManual).
  const loginStart = Date.now()
  const hlRes = await fetch(`${BASE}/api/medefis/headless/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({}),
  })
  const hlData = await hlRes.json()
  console.log('5. Headless login:', hlRes.status, `(${Date.now() - loginStart}ms)`, JSON.stringify(hlData).slice(0, 200))

  // 6. Fetch screenshot through the gateway.
  const shotRes = await fetch(`${BASE}/api/medefis/headless/screenshot`, { headers: { cookie: cookieJar } })
  const shotBuf = await shotRes.arrayBuffer()
  const shotPath = '/tmp/headless-shot.png'
  fs.writeFileSync(shotPath, Buffer.from(shotBuf))
  console.log('6. Screenshot:', shotRes.status, shotRes.headers.get('content-type'), `${shotBuf.byteLength} bytes -> ${shotPath}`)

  // 7. Click on the screenshot (center).
  const clickRes = await fetch(`${BASE}/api/medefis/headless/click`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({ x: 640, y: 450 }),
  })
  console.log('7. Click:', clickRes.status, (await clickRes.json()).ok ? 'OK' : 'FAIL')

  // 8. Type text.
  const typeRes = await fetch(`${BASE}/api/medefis/headless/type`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({ text: 'hello' }),
  })
  console.log('8. Type:', typeRes.status, (await typeRes.json()).ok ? 'OK' : 'FAIL')

  // 9. Press Enter.
  const pressRes = await fetch(`${BASE}/api/medefis/headless/press`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({ key: 'Enter' }),
  })
  console.log('9. Press Enter:', pressRes.status, (await pressRes.json()).ok ? 'OK' : 'FAIL')

  // 10. Extract (should fail since we're on example.com, not the Medefis app).
  const extractRes = await fetch(`${BASE}/api/medefis/headless/extract`, { headers: { cookie: cookieJar } })
  const extractData = await extractRes.json()
  console.log('10. Extract:', extractRes.status, JSON.stringify(extractData).slice(0, 160))

  console.log('\n=== SMOKE TEST COMPLETE ===')
}

main().catch((e) => { console.error(e); process.exit(1) })
