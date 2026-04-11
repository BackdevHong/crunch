import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError } from '../lib/response'
import { Prisma } from '@prisma/client'

export async function getServices(req: Request, res: Response): Promise<void> {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      deliveryDays,
      minRating,
      skill,
      sort = 'createdAt',
      order = 'desc',
      page = '1',
      limit = '6',
      q,
    } = req.query

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(20, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    // where 조건 조립
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...(category && { category: category as any }),
      ...(minPrice || maxPrice ? {
        price: {
          ...(minPrice ? { gte: Number(minPrice) } : {}),
          ...(maxPrice ? { lte: Number(maxPrice) } : {}),
        }
      } : {}),
      ...(deliveryDays && { deliveryDays: { lte: Number(deliveryDays) } }),
      ...(minRating && { rating: { gte: Number(minRating) } }),
      ...(q && {
        OR: [
          { title: { contains: String(q) } },
          { seller: { name: { contains: String(q) } } },
          { skills: { some: { skill: { contains: String(q) } } } },
        ]
      }),
      ...(skill && {
        skills: { some: { skill: { contains: String(skill) } } }
      }),
    }

    // 정렬 조건
    const orderBy: Prisma.ServiceOrderByWithRelationInput =
      sort === 'price'       ? { price: order as any } :
      sort === 'rating'      ? { rating: order as any } :
      sort === 'reviewCount' ? { reviewCount: order as any } :
                               { createdAt: order as any }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          title: true,
          category: true,
          price: true,
          deliveryDays: true,
          badge: true,
          rating: true,
          reviewCount: true,
          thumbnailUrl: true,
          createdAt: true,
          seller: {
            select: { id: true, name: true, avatarUrl: true },
          },
          skills: {
            select: { skill: true },
          },
        },
      }),
      prisma.service.count({ where }),
    ])

    ok(res, {
      services,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error('[getServices]', err)
    serverError(res)
  }
}

export async function getServiceById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, avatarUrl: true },
        },
        skills: { select: { skill: true } },
      },
    })

    if (!service || !service.isActive) {
      res.status(404).json({ success: false, message: '서비스를 찾을 수 없습니다.' })
      return
    }

    ok(res, service)
  } catch (err) {
    console.error('[getServiceById]', err)
    serverError(res)
  }
}