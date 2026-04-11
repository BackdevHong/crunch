import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError } from '../lib/response'
import { Prisma } from '@prisma/client'

export async function getFreelancers(req: Request, res: Response): Promise<void> {
  try {
    const {
      category,
      minRate,
      maxRate,
      experience,
      online,
      skill,
      sort = 'rating',
      order = 'desc',
      page = '1',
      limit = '6',
      q,
    } = req.query

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(20, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const where: Prisma.FreelancerWhereInput = {
      ...(category && { category: category as any }),
      ...(minRate || maxRate ? {
        hourlyRate: {
          ...(minRate ? { gte: Number(minRate) } : {}),
          ...(maxRate ? { lte: Number(maxRate) } : {}),
        }
      } : {}),
      ...(experience && { experience: String(experience) }),
      ...(online === 'true' && { online: true }),
      ...(skill && {
        skills: { some: { skill: { contains: String(skill) } } }
      }),
      ...(q && {
        OR: [
          { user: { name: { contains: String(q) } } },
          { role: { contains: String(q) } },
          { skills: { some: { skill: { contains: String(q) } } } },
        ]
      }),
    }

    const orderBy: Prisma.FreelancerOrderByWithRelationInput =
      sort === 'hourlyRate'    ? { hourlyRate: order as any } :
      sort === 'completedJobs' ? { completedJobs: order as any } :
                                 { rating: order as any }

    const [freelancers, total] = await Promise.all([
      prisma.freelancer.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          role: true,
          badge: true,
          rating: true,
          completedJobs: true,
          hourlyRate: true,
          online: true,
          experience: true,
          category: true,
          bio: true, 
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          skills: { select: { skill: true } },
        },
      }),
      prisma.freelancer.count({ where }),
    ])

    ok(res, {
      freelancers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error('[getFreelancers]', err)
    serverError(res)
  }
}

export async function getFreelancerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const freelancer = await prisma.freelancer.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        skills: { select: { skill: true } },
      },
    })

    if (!freelancer) {
      res.status(404).json({ success: false, message: '프리랜서를 찾을 수 없습니다.' })
      return
    }

    ok(res, freelancer)
  } catch (err) {
    console.error('[getFreelancerById]', err)
    serverError(res)
  }
}