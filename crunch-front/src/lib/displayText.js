const LEADING_BROKEN_TOKEN = /^[^\s가-힣a-zA-Z0-9]*[?�][^\s]*\s+/

export function cleanDisplayText(value, fallback = '') {
  if (value === null || value === undefined) return fallback

  const text = String(value)
    .replace(/\uFFFD/g, '')
    .replace(/쨌/g, '·')
    .trim()

  return text.replace(LEADING_BROKEN_TOKEN, '').trim() || fallback
}
