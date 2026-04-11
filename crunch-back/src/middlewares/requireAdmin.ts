import { Request, Response, NextFunction } from 'express'
import { forbidden } from '../lib/response'

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    forbidden(res, '어드민만 접근할 수 있습니다.')
    return
  }
  next()
}