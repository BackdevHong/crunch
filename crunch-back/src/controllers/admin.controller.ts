import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError } from '../lib/response'
import { Prisma } from '@prisma/client'

// 유저 목록
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { role, q, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Number(limit)

    const where: Prisma.UserWhereInput = {
      ...(role && { role: role as any }),
      ...(q && {
        OR: [
          { name: { contains: String(q) } },
          { email: { contains: String(q) } },
        ],
      }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        select: {
          id: true, name: true, email: true,
          role: true, avatarUrl: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    ok(res, {
      users,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  } catch (err) {
    console.error('[admin/getUsers]', err)
    serverError(res)
  }
}

// 유저 역할 변경
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!['client', 'freelancer', 'admin'].includes(role)) {
      res.status(400).json({ success: false, message: '유효하지 않은 역할입니다.' })
      return
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    })

    ok(res, user)
  } catch (err) {
    console.error('[admin/updateUserRole]', err)
    serverError(res)
  }
}

// 서비스 목록 (어드민용 — 비활성 포함 전체)
export async function getAdminServices(req: Request, res: Response): Promise<void> {
  try {
    const { q, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Number(limit)

    const where: Prisma.ServiceWhereInput = {
      ...(q && {
        OR: [
          { title: { contains: String(q) } },
          { seller: { name: { contains: String(q) } } },
        ],
      }),
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        select: {
          id: true, title: true, category: true,
          price: true, rating: true, isActive: true, createdAt: true,
          seller: { select: { id: true, name: true } },
        },
      }),
      prisma.service.count({ where }),
    ])

    ok(res, {
      services,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  } catch (err) {
    console.error('[admin/getServices]', err)
    serverError(res)
  }
}

// 서비스 활성/비활성 전환
export async function toggleServiceActive(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { isActive } = req.body

    const service = await prisma.service.update({
      where: { id },
      data: { isActive },
      select: { id: true, title: true, isActive: true },
    })

    ok(res, service)
  } catch (err) {
    console.error('[admin/toggleService]', err)
    serverError(res)
  }
}