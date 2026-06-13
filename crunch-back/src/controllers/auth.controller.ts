import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import crypto from 'crypto'
import { validationResult } from 'express-validator'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { ok, created, fail, unauthorized, serverError } from '../lib/response'
import { sendVerificationEmail } from '../lib/mailer'

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12)
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const NAVER_AUTH_URL = 'https://nid.naver.com/oauth2.0/authorize'
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token'
const NAVER_USERINFO_URL = 'https://openapi.naver.com/v1/nid/me'
const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize'
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const KAKAO_USERINFO_URL = 'https://kapi.kakao.com/v2/user/me'

type GoogleUserInfo = {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

type NaverUserInfo = {
  resultcode: string
  message: string
  response: {
    id: string
    email?: string
    name?: string
    nickname?: string
    profile_image?: string
  }
}

type KakaoUserInfo = {
  id: number
  kakao_account?: {
    email?: string
    profile?: {
      nickname?: string
      profile_image_url?: string
      thumbnail_image_url?: string
    }
  }
  properties?: {
    nickname?: string
    profile_image?: string
    thumbnail_image?: string
  }
}

type AuthUser = {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

type OAuthProvider = 'google' | 'naver' | 'kakao'

class OAuthLinkError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

// ── 회원가입 ─────────────────────────────────────────────────
export async function signup(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg as string)
    return
  }

  const { name, email, password, role = 'client' } = req.body

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      fail(res, '?? ?? ?? ??????.')
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    await sendEmailVerification(user.id, user.email, user.name)

    created(res, {
      user,
      requiresEmailVerification: true,
      message: '????? ???????. ??? ?? ? ???????.',
    })
  } catch (err) {
    console.error('[signup]', err)
    serverError(res)
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg as string)
    return
  }

  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      unauthorized(res, '??? ?? ????? ???? ????.')
      return
    }

    if (!user.emailVerifiedAt) {
      await sendEmailVerification(user.id, user.email, user.name)
      fail(res, '??? ??? ?????. ?? ??? ?? ?????.')
      return
    }

    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    })

    setRefreshCookie(res, refreshToken)

    ok(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      accessToken,
    })
  } catch (err) {
    console.error('[login]', err)
    serverError(res)
  }
}

export function googleLogin(_req: Request, res: Response): void {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Google OAuth 설정이 필요합니다.' })
    return
  }

  const state = crypto.randomBytes(24).toString('hex')
  res.cookie('googleOAuthState', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}

// ── Google 계정 연결 시작 ───────────────────────────────────
export function googleLink(req: Request, res: Response): void {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Google OAuth 설정이 필요합니다.' })
    return
  }

  const state = setOAuthStateCookies(res, 'google', req.user!.userId)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })

  ok(res, { url: `${GOOGLE_AUTH_URL}?${params.toString()}` })
}

// ── Google 로그인 콜백 ───────────────────────────────────────
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  const requestedLink = Boolean(req.cookies?.googleOAuthLinkUserId)

  if (error) {
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'google', String(error), requestedLink))
    return
  }
  if (!code || !state || state !== req.cookies?.googleOAuthState) {
    clearOAuthStateCookies(res, 'google')
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'google', 'invalid_state', requestedLink))
    return
  }

  const linkUserId = req.cookies?.googleOAuthLinkUserId as string | undefined
  clearOAuthStateCookies(res, 'google')

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth environment variables')
    }

    const tokenRes = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
      code: String(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const accessTokenFromGoogle = tokenRes.data.access_token as string | undefined
    if (!accessTokenFromGoogle) throw new Error('Google access token is missing')

    const { data: googleUser } = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessTokenFromGoogle}` },
    })

    if (!googleUser.email || googleUser.email_verified === false) {
      res.redirect(getOAuthClientRedirectUrl(clientUrl, 'google', 'email_not_verified', Boolean(linkUserId)))
      return
    }

    if (linkUserId) {
      await linkGoogleUser(linkUserId, googleUser)
      res.redirect(`${clientUrl}?oauth=google&linked=1&page=mypage-account`)
      return
    }

    const user = await upsertGoogleUser(googleUser)
    const accessToken = await issueAuthTokens(res, user)
    const params = new URLSearchParams({
      oauth: 'google',
      accessToken,
    })

    res.redirect(`${clientUrl}?${params.toString()}`)
  } catch (err) {
    console.error('[googleCallback]', err)
    const errorCode = err instanceof OAuthLinkError ? err.code : 'callback_failed'
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'google', errorCode, Boolean(linkUserId)))
  }
}

// ── Naver 로그인 시작 ────────────────────────────────────────
export function naverLogin(_req: Request, res: Response): void {
  const clientId = process.env.NAVER_CLIENT_ID
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Naver OAuth 설정이 필요합니다.' })
    return
  }

  const state = crypto.randomBytes(24).toString('hex')
  res.cookie('naverOAuthState', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getNaverRedirectUri(),
    state,
  })

  res.redirect(`${NAVER_AUTH_URL}?${params.toString()}`)
}

// ── Naver 계정 연결 시작 ────────────────────────────────────
export function naverLink(req: Request, res: Response): void {
  const clientId = process.env.NAVER_CLIENT_ID
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Naver OAuth 설정이 필요합니다.' })
    return
  }

  const state = setOAuthStateCookies(res, 'naver', req.user!.userId)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getNaverRedirectUri(),
    state,
  })

  ok(res, { url: `${NAVER_AUTH_URL}?${params.toString()}` })
}

// ── Naver 로그인 콜백 ────────────────────────────────────────
export async function naverCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  const requestedLink = Boolean(req.cookies?.naverOAuthLinkUserId)

  if (error) {
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'naver', String(error), requestedLink))
    return
  }
  if (!code || !state || state !== req.cookies?.naverOAuthState) {
    clearOAuthStateCookies(res, 'naver')
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'naver', 'invalid_state', requestedLink))
    return
  }

  const linkUserId = req.cookies?.naverOAuthLinkUserId as string | undefined
  clearOAuthStateCookies(res, 'naver')

  try {
    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('Missing Naver OAuth environment variables')
    }

    const tokenRes = await axios.get(NAVER_TOKEN_URL, {
      params: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        state: String(state),
      },
    })

    const accessTokenFromNaver = tokenRes.data.access_token as string | undefined
    if (!accessTokenFromNaver) throw new Error('Naver access token is missing')

    const { data: naverUser } = await axios.get<NaverUserInfo>(NAVER_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessTokenFromNaver}` },
    })

    if (naverUser.resultcode !== '00' || !naverUser.response.email) {
      res.redirect(getOAuthClientRedirectUrl(clientUrl, 'naver', 'email_not_provided', Boolean(linkUserId)))
      return
    }

    if (linkUserId) {
      await linkNaverUser(linkUserId, naverUser)
      res.redirect(`${clientUrl}?oauth=naver&linked=1&page=mypage-account`)
      return
    }

    const user = await upsertNaverUser(naverUser)
    const accessToken = await issueAuthTokens(res, user)
    const params = new URLSearchParams({
      oauth: 'naver',
      accessToken,
    })

    res.redirect(`${clientUrl}?${params.toString()}`)
  } catch (err) {
    console.error('[naverCallback]', err)
    const errorCode = err instanceof OAuthLinkError ? err.code : 'callback_failed'
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'naver', errorCode, Boolean(linkUserId)))
  }
}

// ── Kakao 로그인 시작 ────────────────────────────────────────
export function kakaoLogin(_req: Request, res: Response): void {
  const clientId = process.env.KAKAO_REST_API_KEY
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Kakao OAuth 설정이 필요합니다.' })
    return
  }

  const state = crypto.randomBytes(24).toString('hex')
  res.cookie('kakaoOAuthState', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getKakaoRedirectUri(),
    state,
  })

  res.redirect(`${KAKAO_AUTH_URL}?${params.toString()}`)
}

// ── Kakao 계정 연결 시작 ────────────────────────────────────
export function kakaoLink(req: Request, res: Response): void {
  const clientId = process.env.KAKAO_REST_API_KEY
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Kakao OAuth 설정이 필요합니다.' })
    return
  }

  const state = setOAuthStateCookies(res, 'kakao', req.user!.userId)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getKakaoRedirectUri(),
    state,
  })

  ok(res, { url: `${KAKAO_AUTH_URL}?${params.toString()}` })
}

// ── Kakao 로그인 콜백 ────────────────────────────────────────
export async function kakaoCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  const requestedLink = Boolean(req.cookies?.kakaoOAuthLinkUserId)

  if (error) {
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'kakao', String(error), requestedLink))
    return
  }
  if (!code || !state || state !== req.cookies?.kakaoOAuthState) {
    clearOAuthStateCookies(res, 'kakao')
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'kakao', 'invalid_state', requestedLink))
    return
  }

  const linkUserId = req.cookies?.kakaoOAuthLinkUserId as string | undefined
  clearOAuthStateCookies(res, 'kakao')

  try {
    const clientId = process.env.KAKAO_REST_API_KEY
    if (!clientId) throw new Error('Missing Kakao OAuth environment variables')

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: getKakaoRedirectUri(),
      code: String(code),
    })

    if (process.env.KAKAO_CLIENT_SECRET) {
      tokenParams.set('client_secret', process.env.KAKAO_CLIENT_SECRET)
    }

    const tokenRes = await axios.post(KAKAO_TOKEN_URL, tokenParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const accessTokenFromKakao = tokenRes.data.access_token as string | undefined
    if (!accessTokenFromKakao) throw new Error('Kakao access token is missing')

    const { data: kakaoUser } = await axios.get<KakaoUserInfo>(KAKAO_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessTokenFromKakao}` },
    })

    if (!kakaoUser.kakao_account?.email) {
      res.redirect(getOAuthClientRedirectUrl(clientUrl, 'kakao', 'email_not_provided', Boolean(linkUserId)))
      return
    }

    if (linkUserId) {
      await linkKakaoUser(linkUserId, kakaoUser)
      res.redirect(`${clientUrl}?oauth=kakao&linked=1&page=mypage-account`)
      return
    }

    const user = await upsertKakaoUser(kakaoUser)
    const accessToken = await issueAuthTokens(res, user)
    const params = new URLSearchParams({
      oauth: 'kakao',
      accessToken,
    })

    res.redirect(`${clientUrl}?${params.toString()}`)
  } catch (err) {
    console.error('[kakaoCallback]', err)
    const errorCode = err instanceof OAuthLinkError ? err.code : 'callback_failed'
    res.redirect(getOAuthClientRedirectUrl(clientUrl, 'kakao', errorCode, Boolean(linkUserId)))
  }
}

// ── 토큰 재발급 ──────────────────────────────────────────────
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const token = String(req.query.token ?? '')
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

  if (!token) {
    res.redirect(`${clientUrl}?emailVerification=missing_token`)
    return
  }

  try {
    const tokenHash = hashEmailVerificationToken(token)
    const rows = await prisma.$queryRaw<Array<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null }>>`
      SELECT id, user_id AS userId, expires_at AS expiresAt, used_at AS usedAt
      FROM email_verification_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `
    const verification = rows[0]

    if (!verification || verification.usedAt || new Date(verification.expiresAt).getTime() < Date.now()) {
      res.redirect(`${clientUrl}?emailVerification=invalid`)
      return
    }

    await prisma.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE users
        SET email_verified_at = COALESCE(email_verified_at, NOW(3)), updated_at = NOW(3)
        WHERE id = ${verification.userId}
      `
      await tx.$executeRaw`
        UPDATE email_verification_tokens
        SET used_at = NOW(3)
        WHERE id = ${verification.id}
      `
    })

    res.redirect(`${clientUrl}?emailVerification=success`)
  } catch (err) {
    console.error('[verifyEmail]', err)
    res.redirect(`${clientUrl}?emailVerification=failed`)
  }
}

export async function resendVerificationEmail(req: Request, res: Response): Promise<void> {
  const email = String(req.body.email ?? '').trim().toLowerCase()
  if (!email) {
    fail(res, '이메일을 입력해주세요.')
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, emailVerifiedAt: true },
    })

    if (!user) {
      ok(res, { message: '인증 메일을 보냈습니다.' })
      return
    }
    if (user.emailVerifiedAt) {
      ok(res, { message: '이미 인증된 이메일입니다.' })
      return
    }

    await sendEmailVerification(user.id, user.email, user.name)
    ok(res, { message: '인증 메일을 보냈습니다.' })
  } catch (err) {
    console.error('[resendVerificationEmail]', err)
    serverError(res)
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken as string | undefined

  if (!token) {
    unauthorized(res, 'Refresh token 이 없습니다.')
    return
  }

  try {
    const payload = verifyRefreshToken(token)

    // DB 에 저장된 토큰과 비교 (탈취 방지)
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || user.refreshToken !== token) {
      unauthorized(res, '유효하지 않은 Refresh token 입니다.')
      return
    }

    const newPayload = { userId: user.id, email: user.email, role: user.role }
    const newAccessToken = signAccessToken(newPayload)
    const newRefreshToken = signRefreshToken(newPayload)

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    })

    setRefreshCookie(res, newRefreshToken)

    ok(res, { accessToken: newAccessToken })
  } catch {
    unauthorized(res, 'Refresh token 이 만료되었습니다. 다시 로그인해주세요.')
  }
}

// ── 로그아웃 ─────────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken as string | undefined

  if (token) {
    try {
      const payload = verifyRefreshToken(token)
      await prisma.user.update({
        where: { id: payload.userId },
        data: { refreshToken: null },
      })
    } catch {
      // 만료된 토큰이어도 쿠키는 제거
    }
  }

  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' })
  ok(res, { message: '로그아웃 되었습니다.' })
}

// ── 내 정보 조회 ─────────────────────────────────────────────
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        freelancer: {
          select: {
            id: true,
            role: true,
            badge: true,
            rating: true,
            completedJobs: true,
            hourlyRate: true,
            online: true,
          },
        },
      },
    })

    if (!user) {
      unauthorized(res, '사용자를 찾을 수 없습니다.')
      return
    }

    ok(res, user)
  } catch (err) {
    console.error('[me]', err)
    serverError(res)
  }
}

// ── Helper ───────────────────────────────────────────────────
function setRefreshCookie(res: Response, token: string): void {
  const maxAge = 7 * 24 * 60 * 60 * 1000 // 7일
  res.cookie('refreshToken', token, {
    httpOnly: true,                              // XSS 방지
    secure: process.env.NODE_ENV === 'production', // HTTPS 전용 (prod)
    sameSite: 'lax',                             // CSRF 방지
    maxAge,
  })
}

function getOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  }
}

function setOAuthStateCookies(res: Response, provider: OAuthProvider, userId?: string): string {
  const state = crypto.randomBytes(24).toString('hex')
  const options = { ...getOAuthCookieOptions(), maxAge: 10 * 60 * 1000 }

  res.cookie(`${provider}OAuthState`, state, options)
  if (userId) res.cookie(`${provider}OAuthLinkUserId`, userId, options)

  return state
}

function clearOAuthStateCookies(res: Response, provider: OAuthProvider): void {
  const options = getOAuthCookieOptions()
  res.clearCookie(`${provider}OAuthState`, options)
  res.clearCookie(`${provider}OAuthLinkUserId`, options)
}

function getOAuthClientRedirectUrl(
  clientUrl: string,
  provider: OAuthProvider,
  error: string,
  linkMode: boolean,
): string {
  const params = new URLSearchParams({
    oauth: provider,
    error,
  })

  if (linkMode) {
    params.set('link', '1')
    params.set('page', 'mypage-account')
  }

  return `${clientUrl}?${params.toString()}`
}

function getGoogleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${process.env.API_URL ?? 'http://localhost:4000'}/api/auth/google/callback`
}

function getNaverRedirectUri(): string {
  return process.env.NAVER_REDIRECT_URI ?? `${process.env.API_URL ?? 'http://localhost:4000'}/api/auth/naver/callback`
}

function getKakaoRedirectUri(): string {
  return process.env.KAKAO_REDIRECT_URI ?? `${process.env.API_URL ?? 'http://localhost:4000'}/api/auth/kakao/callback`
}

async function issueAuthTokens(
  res: Response,
  user: { id: string; email: string; role: string },
): Promise<string> {
  const payload = { userId: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  setRefreshCookie(res, refreshToken)
  return accessToken
}

function hashEmailVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getEmailVerificationUrl(token: string): string {
  const apiUrl = process.env.API_URL ?? 'http://localhost:4000'
  return `${apiUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`
}

async function sendEmailVerification(userId: string, email: string, name: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashEmailVerificationToken(token)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await prisma.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE email_verification_tokens
      SET used_at = NOW(3)
      WHERE user_id = ${userId}
        AND used_at IS NULL
    `
    await tx.$executeRaw`
      INSERT INTO email_verification_tokens
        (id, user_id, token_hash, expires_at, created_at)
      VALUES
        (UUID(), ${userId}, ${tokenHash}, ${expiresAt}, NOW(3))
    `
  })

  await sendVerificationEmail({
    to: email,
    name,
    verifyUrl: getEmailVerificationUrl(token),
  })
}

async function assertProviderAvailable(provider: OAuthProvider, providerId: string, userId: string): Promise<void> {
  const column = provider === 'google'
    ? 'google_id'
    : provider === 'naver'
      ? 'naver_id'
      : 'kakao_id'

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE
      (${column} = 'google_id' AND google_id = ${providerId}) OR
      (${column} = 'naver_id' AND naver_id = ${providerId}) OR
      (${column} = 'kakao_id' AND kakao_id = ${providerId})
    LIMIT 1
  `

  if (rows[0] && rows[0].id !== userId) {
    throw new OAuthLinkError('provider_in_use')
  }
}

async function ensureLinkTargetUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new OAuthLinkError('account_not_found')
}

async function linkGoogleUser(userId: string, googleUser: GoogleUserInfo): Promise<void> {
  await ensureLinkTargetUser(userId)
  await assertProviderAvailable('google', googleUser.sub, userId)

  await prisma.$executeRaw`
    UPDATE users
    SET
      google_id = ${googleUser.sub},
      avatar_url = CASE WHEN avatar_url IS NULL THEN ${googleUser.picture ?? null} ELSE avatar_url END,
      email_verified_at = COALESCE(email_verified_at, NOW(3)),
      updated_at = NOW(3)
    WHERE id = ${userId}
  `
}

async function linkNaverUser(userId: string, naverUser: NaverUserInfo): Promise<void> {
  const profile = naverUser.response
  await ensureLinkTargetUser(userId)
  await assertProviderAvailable('naver', profile.id, userId)

  await prisma.$executeRaw`
    UPDATE users
    SET
      naver_id = ${profile.id},
      avatar_url = CASE WHEN avatar_url IS NULL THEN ${profile.profile_image ?? null} ELSE avatar_url END,
      email_verified_at = COALESCE(email_verified_at, NOW(3)),
      updated_at = NOW(3)
    WHERE id = ${userId}
  `
}

async function linkKakaoUser(userId: string, kakaoUser: KakaoUserInfo): Promise<void> {
  const kakaoId = String(kakaoUser.id)
  const avatarUrl = kakaoUser.kakao_account?.profile?.profile_image_url || kakaoUser.properties?.profile_image
  await ensureLinkTargetUser(userId)
  await assertProviderAvailable('kakao', kakaoId, userId)

  await prisma.$executeRaw`
    UPDATE users
    SET
      kakao_id = ${kakaoId},
      avatar_url = CASE WHEN avatar_url IS NULL THEN ${avatarUrl ?? null} ELSE avatar_url END,
      email_verified_at = COALESCE(email_verified_at, NOW(3)),
      updated_at = NOW(3)
    WHERE id = ${userId}
  `
}

async function upsertGoogleUser(googleUser: GoogleUserInfo): Promise<AuthUser> {
  const usersByGoogleId = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      id,
      name,
      email,
      role,
      avatar_url AS avatarUrl
    FROM users
    WHERE google_id = ${googleUser.sub}
    LIMIT 1
  `
  if (usersByGoogleId[0]) return usersByGoogleId[0]

  const byEmail = await prisma.user.findUnique({ where: { email: googleUser.email } })
  if (byEmail) {
    await prisma.$executeRaw`
      UPDATE users
      SET
      auth_provider = CASE WHEN auth_provider = 'local' THEN 'google' ELSE auth_provider END,
      google_id = ${googleUser.sub},
      avatar_url = CASE WHEN avatar_url IS NULL THEN ${googleUser.picture ?? null} ELSE avatar_url END,
      email_verified_at = COALESCE(email_verified_at, NOW(3))
      WHERE id = ${byEmail.id}
    `

    return {
      id: byEmail.id,
      name: byEmail.name,
      email: byEmail.email,
      role: byEmail.role,
      avatarUrl: byEmail.avatarUrl,
    }
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS)
  await prisma.$executeRaw`
    INSERT INTO users
      (id, name, email, password_hash, auth_provider, google_id, avatar_url, email_verified_at, role, created_at, updated_at)
    VALUES
      (UUID(), ${(googleUser.name || googleUser.email.split('@')[0]).slice(0, 50)}, ${googleUser.email}, ${passwordHash}, 'google', ${googleUser.sub}, ${googleUser.picture ?? null}, NOW(3), 'client', NOW(3), NOW(3))
  `

  const usersByEmail = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      id,
      name,
      email,
      role,
      avatar_url AS avatarUrl
    FROM users
    WHERE email = ${googleUser.email}
    LIMIT 1
  `

  return usersByEmail[0]
}

async function upsertNaverUser(naverUser: NaverUserInfo): Promise<AuthUser> {
  const profile = naverUser.response
  const usersByNaverId = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      id,
      name,
      email,
      role,
      avatar_url AS avatarUrl
    FROM users
    WHERE naver_id = ${profile.id}
    LIMIT 1
  `
  if (usersByNaverId[0]) return usersByNaverId[0]

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email! } })
  if (byEmail) {
    await prisma.$executeRaw`
      UPDATE users
      SET
      auth_provider = CASE WHEN auth_provider = 'local' THEN 'naver' ELSE auth_provider END,
      naver_id = ${profile.id},
      avatar_url = CASE WHEN avatar_url IS NULL THEN ${profile.profile_image ?? null} ELSE avatar_url END,
      email_verified_at = COALESCE(email_verified_at, NOW(3))
      WHERE id = ${byEmail.id}
    `

    return {
      id: byEmail.id,
      name: byEmail.name,
      email: byEmail.email,
      role: byEmail.role,
      avatarUrl: byEmail.avatarUrl,
    }
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS)
  const displayName = (profile.name || profile.nickname || profile.email!.split('@')[0]).slice(0, 50)

  await prisma.$executeRaw`
    INSERT INTO users
      (id, name, email, password_hash, auth_provider, naver_id, avatar_url, email_verified_at, role, created_at, updated_at)
    VALUES
      (UUID(), ${displayName}, ${profile.email!}, ${passwordHash}, 'naver', ${profile.id}, ${profile.profile_image ?? null}, NOW(3), 'client', NOW(3), NOW(3))
  `

  const usersByEmail = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      id,
      name,
      email,
      role,
      avatar_url AS avatarUrl
    FROM users
    WHERE email = ${profile.email!}
    LIMIT 1
  `

  return usersByEmail[0]
}

async function upsertKakaoUser(kakaoUser: KakaoUserInfo): Promise<AuthUser> {
  const kakaoId = String(kakaoUser.id)
  const account = kakaoUser.kakao_account!
  const email = account.email!
  const nickname = account.profile?.nickname || kakaoUser.properties?.nickname || email.split('@')[0]
  const avatarUrl = account.profile?.profile_image_url || kakaoUser.properties?.profile_image

  const usersByKakaoId = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      id,
      name,
      email,
      role,
      avatar_url AS avatarUrl
    FROM users
    WHERE kakao_id = ${kakaoId}
    LIMIT 1
  `
  if (usersByKakaoId[0]) return usersByKakaoId[0]

  const byEmail = await prisma.user.findUnique({ where: { email } })
  if (byEmail) {
    await prisma.$executeRaw`
      UPDATE users
      SET
      auth_provider = CASE WHEN auth_provider = 'local' THEN 'kakao' ELSE auth_provider END,
      kakao_id = ${kakaoId},
      avatar_url = CASE WHEN avatar_url IS NULL THEN ${avatarUrl ?? null} ELSE avatar_url END,
      email_verified_at = COALESCE(email_verified_at, NOW(3))
      WHERE id = ${byEmail.id}
    `

    return {
      id: byEmail.id,
      name: byEmail.name,
      email: byEmail.email,
      role: byEmail.role,
      avatarUrl: byEmail.avatarUrl,
    }
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS)
  await prisma.$executeRaw`
    INSERT INTO users
      (id, name, email, password_hash, auth_provider, kakao_id, avatar_url, email_verified_at, role, created_at, updated_at)
    VALUES
      (UUID(), ${nickname.slice(0, 50)}, ${email}, ${passwordHash}, 'kakao', ${kakaoId}, ${avatarUrl ?? null}, NOW(3), 'client', NOW(3), NOW(3))
  `

  const usersByEmail = await prisma.$queryRaw<AuthUser[]>`
    SELECT
      id,
      name,
      email,
      role,
      avatar_url AS avatarUrl
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `

  return usersByEmail[0]
}
