import crypto from 'crypto'

const SANDBOX_SCRIPT_URL = 'https://pay.nicepay.co.kr/v1/js/'
const SANDBOX_API_URL = 'https://sandbox-api.nicepay.co.kr/v1'
const PRODUCTION_API_URL = 'https://api.nicepay.co.kr/v1'

export function getNicepayConfig() {
  const clientKey = process.env.NICEPAY_CLIENT_KEY
  const secretKey = process.env.NICEPAY_SECRET_KEY

  if (!clientKey || !secretKey) {
    throw new Error('NICEPAY_CLIENT_KEY and NICEPAY_SECRET_KEY are required')
  }

  return {
    clientKey,
    secretKey,
    scriptUrl: process.env.NICEPAY_SCRIPT_URL ?? SANDBOX_SCRIPT_URL,
    apiBaseUrl: process.env.NICEPAY_API_URL ?? (process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : SANDBOX_API_URL),
    returnUrl: process.env.NICEPAY_RETURN_URL ?? `${process.env.API_URL ?? 'http://localhost:4000'}/api/payments/nicepay/return`,
  }
}

export function getNicepayBasicAuth(clientKey: string, secretKey: string): string {
  return Buffer.from(`${clientKey}:${secretKey}`).toString('base64')
}

export function createMoid(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'CRUNCH'
  const random = crypto.randomBytes(6).toString('hex').toUpperCase()
  return `${safePrefix}${Date.now()}${random}`.slice(0, 64)
}
