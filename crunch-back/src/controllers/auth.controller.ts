import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import crypto from 'crypto'
import { validationResult } from 'express-validator'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { ok, created, fail, unauthorized, serverError } from '../lib/response'

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

// ── 회원가입 ─────────────────────────────────────────────────
export async function signup(req: Request, res: Response): Promise<void> {
  // 입력값 검증 결과 확인
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg as string)
    return
  }

  const { name, email, password, role = 'client' } = req.body

  try {
    // 이메일 중복 확인
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      fail(res, '이미 사용 중인 이메일입니다.')
      return
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // 유저 생성
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

    // 토큰 발급
    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    // refresh token DB 저장
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    })

    // refresh token 을 HttpOnly 쿠키로 전송
    setRefreshCookie(res, refreshToken)

    created(res, { user, accessToken })
  } catch (err) {
    console.error('[signup]', err)
    serverError(res)
  }
}

// ── 로그인 ───────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg as string)
    return
  }

  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // 유저 없음 or 비밀번호 불일치 — 동일한 메시지로 보안 강화
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      unauthorized(res, '이메일 또는 비밀번호가 올바르지 않습니다.')
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
      },
      accessToken,
    })
  } catch (err) {
    console.error('[login]', err)
    serverError(res)
  }
}

// ── Google 로그인 시작 ───────────────────────────────────────
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

// ── Google 로그인 콜백 ───────────────────────────────────────
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

  if (error) {
    res.redirect(`${clientUrl}?oauth=google&error=${encodeURIComponent(String(error))}`)
    return
  }
  if (!code || !state || state !== req.cookies?.googleOAuthState) {
    res.redirect(`${clientUrl}?oauth=google&error=invalid_state`)
    return
  }

  res.clearCookie('googleOAuthState', { httpOnly: true, sameSite: 'lax' })

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
      res.redirect(`${clientUrl}?oauth=google&error=email_not_verified`)
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
    res.redirect(`${clientUrl}?oauth=google&error=callback_failed`)
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

// ── Naver 로그인 콜백 ────────────────────────────────────────
export async function naverCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

  if (error) {
    res.redirect(`${clientUrl}?oauth=naver&error=${encodeURIComponent(String(error))}`)
    return
  }
  if (!code || !state || state !== req.cookies?.naverOAuthState) {
    res.redirect(`${clientUrl}?oauth=naver&error=invalid_state`)
    return
  }

  res.clearCookie('naverOAuthState', { httpOnly: true, sameSite: 'lax' })

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
      res.redirect(`${clientUrl}?oauth=naver&error=email_not_provided`)
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
    res.redirect(`${clientUrl}?oauth=naver&error=callback_failed`)
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

// ── Kakao 로그인 콜백 ────────────────────────────────────────
export async function kakaoCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

  if (error) {
    res.redirect(`${clientUrl}?oauth=kakao&error=${encodeURIComponent(String(error))}`)
    return
  }
  if (!code || !state || state !== req.cookies?.kakaoOAuthState) {
    res.redirect(`${clientUrl}?oauth=kakao&error=invalid_state`)
    return
  }

  res.clearCookie('kakaoOAuthState', { httpOnly: true, sameSite: 'lax' })

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
      res.redirect(`${clientUrl}?oauth=kakao&error=email_not_provided`)
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
    res.redirect(`${clientUrl}?oauth=kakao&error=callback_failed`)
  }
}

// ── 토큰 재발급 ──────────────────────────────────────────────
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
        avatar_url = CASE WHEN avatar_url IS NULL THEN ${googleUser.picture ?? null} ELSE avatar_url END
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
      (id, name, email, password_hash, auth_provider, google_id, avatar_url, role, created_at, updated_at)
    VALUES
      (UUID(), ${(googleUser.name || googleUser.email.split('@')[0]).slice(0, 50)}, ${googleUser.email}, ${passwordHash}, 'google', ${googleUser.sub}, ${googleUser.picture ?? null}, 'client', NOW(3), NOW(3))
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
        avatar_url = CASE WHEN avatar_url IS NULL THEN ${profile.profile_image ?? null} ELSE avatar_url END
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
      (id, name, email, password_hash, auth_provider, naver_id, avatar_url, role, created_at, updated_at)
    VALUES
      (UUID(), ${displayName}, ${profile.email!}, ${passwordHash}, 'naver', ${profile.id}, ${profile.profile_image ?? null}, 'client', NOW(3), NOW(3))
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
        avatar_url = CASE WHEN avatar_url IS NULL THEN ${avatarUrl ?? null} ELSE avatar_url END
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
      (id, name, email, password_hash, auth_provider, kakao_id, avatar_url, role, created_at, updated_at)
    VALUES
      (UUID(), ${nickname.slice(0, 50)}, ${email}, ${passwordHash}, 'kakao', ${kakaoId}, ${avatarUrl ?? null}, 'client', NOW(3), NOW(3))
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
