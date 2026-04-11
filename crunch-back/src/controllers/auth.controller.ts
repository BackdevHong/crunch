import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { validationResult } from 'express-validator'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { ok, created, fail, unauthorized, serverError } from '../lib/response'

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12)

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
