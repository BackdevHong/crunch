import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, JwtPayload } from '../lib/jwt'
import { unauthorized } from '../lib/response'

// Express Request 에 user 속성 추가
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res)
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch {
    unauthorized(res, '토큰이 유효하지 않거나 만료되었습니다.')
  }
}

// 특정 role 만 허용하는 미들웨어
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      unauthorized(res, '접근 권한이 없습니다.')
      return
    }
    next()
  }
}
