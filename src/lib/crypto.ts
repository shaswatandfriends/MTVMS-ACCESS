import crypto from 'crypto'

/**
 * AES-256-GCM encryption helpers used to protect Medefis credentials
 * and session cookies at rest. The key is derived once from a secret
 * pepper (env var) so the same plaintext produces a different ciphertext
 * each save (random IV), which avoids leaking equality of secrets.
 */

const SECRET =
  process.env.PARENT_SYSTEM_SECRET ||
  'parent-control-system-default-secret-change-me-in-production-32+'

const ALGO = 'aes-256-gcm'
const KEY = crypto.createHash('sha256').update(SECRET).digest()

export interface CipherPayload {
  iv: string
  tag: string
  data: string
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload: CipherPayload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  }
  return JSON.stringify(payload)
}

export function decrypt(payloadJson: string): string {
  const payload = JSON.parse(payloadJson) as CipherPayload
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const data = Buffer.from(payload.data, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

/* ----------------------------- Password hashing ----------------------------- */

/**
 * Password hashing using Node's built-in scrypt. Avoids an extra
 * dependency (bcrypt) while still being slow & salted.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  // constant-time-ish compare
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
}

/* ------------------------------- Tokens ------------------------------------- */

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}
