import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

const ENVELOPE_PREFIX = 'gob:v1:'
const LEGACY_XOR_KEYS = ['gameofbones_secure_key_2025', 'gob_secret_2024_gameofbones_in_kalyan']
const LEGACY_WRITE_KEY = 'gob_secret_2024_gameofbones_in_kalyan'

function encryptionKey(): Buffer {
  const encoded = process.env.GOB_DATA_ENCRYPTION_KEY
  if (!encoded) throw new Error('Customer-data encryption is not configured')

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('Customer-data encryption key must be 32 bytes')
  return key
}

function isLegacyCiphertext(value: string): boolean {
  return value.length >= 8 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

function xor(value: Buffer, key: string): string {
  return Array.from(value, (byte, index) => String.fromCharCode(byte ^ key.charCodeAt(index % key.length))).join('')
}

function decryptLegacyXor(value: string): string {
  if (!isLegacyCiphertext(value)) return value

  try {
    const bytes = Buffer.from(value, 'base64')
    for (const key of LEGACY_XOR_KEYS) {
      const decoded = xor(bytes, key)
      if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) return decoded
    }
    return value
  } catch {
    return value
  }
}

export function protectLegacyPii(value: string): string {
  if (!value) return ''
  const bytes = Buffer.from(value, 'utf8')
  return Buffer.from(Array.from(bytes, (byte, index) => byte ^ LEGACY_WRITE_KEY.charCodeAt(index % LEGACY_WRITE_KEY.length))).toString('base64')
}

export function protectLegacyPiiValue(value: unknown): unknown {
  if (typeof value === 'string') return protectLegacyPii(value)
  if (Array.isArray(value)) return value.map(protectLegacyPiiValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, protectLegacyPiiValue(item)]))
  return value
}

export function revealLegacyPii(value: unknown): string {
  return typeof value === 'string' ? decryptLegacyXor(value).trim() : ''
}

export function revealLegacyPiiValue(value: unknown): unknown {
  if (typeof value === 'string') return decryptLegacyXor(value)
  if (Array.isArray(value)) return value.map(revealLegacyPiiValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revealLegacyPiiValue(item)]))
  }
  return value
}

export function encryptPii(value: unknown): string | null {
  const plaintext = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
  if (!plaintext) return null

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENVELOPE_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptPii(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.startsWith(ENVELOPE_PREFIX)) return decryptLegacyXor(value)

  const payload = value.slice(ENVELOPE_PREFIX.length).split('.')
  if (payload.length !== 3) throw new Error('Invalid encrypted customer-data payload')

  const [ivValue, tagValue, ciphertextValue] = payload
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8')
}

export function normalizePhoneForHash(value: unknown): string {
  const digits = revealLegacyPii(value).replace(/\D/g, '')
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
}

export function normalizeEmailForHash(value: unknown): string {
  return revealLegacyPii(value).trim().toLowerCase()
}

export function piiHash(value: string): string | null {
  if (!value) return null
  return createHmac('sha256', encryptionKey()).update(`gob:pii:v1:${value}`, 'utf8').digest('hex')
}
