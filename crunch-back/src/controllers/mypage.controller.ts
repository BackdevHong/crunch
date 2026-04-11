import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError, fail } from '../lib/response'
import { CATEGORY_MAP } from '../lib/contains'

// 내 프로필 조회
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, name: true, email: true,
        role: true, avatarUrl: true, createdAt: true,
        freelancer: {
          include: { skills: { select: { skill: true } } },
        },
        application: {
          select: { status: true, rejectedReason: true, createdAt: true },
        },
      },
    })

    if (!user) {
      res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' })
      return
    }

    ok(res, user)
  } catch (err) {
    console.error('[getMyProfile]', err)
    serverError(res)
  }
}

// 기본 프로필 수정 (이름, 아바타)
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const { name, avatarUrl } = req.body

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    })

    ok(res, user)
  } catch (err) {
    console.error('[updateMyProfile]', err)
    serverError(res)
  }
}

// 프리랜서 프로필 수정
export async function updateFreelancerProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { role, category, experience, hourlyRate, bio, skills, online } = req.body

    const freelancer = await prisma.freelancer.findUnique({ where: { userId } })
    if (!freelancer) {
      fail(res, '프리랜서 프로필이 없습니다.')
      return
    }

    const mappedCategory = category ? CATEGORY_MAP[category] : undefined

    // skills 업데이트: 기존 삭제 후 재생성
    const updated = await prisma.$transaction(async (tx) => {
      if (skills !== undefined) {
        await tx.freelancerSkill.deleteMany({ where: { freelancerId: freelancer.id } })
        if (skills.length > 0) {
          await tx.freelancerSkill.createMany({
            data: skills.map((skill: string) => ({ freelancerId: freelancer.id, skill })),
          })
        }
      }

      return tx.freelancer.update({
        where: { userId },
        data: {
          ...(role && { role }),
          ...(mappedCategory && { category: mappedCategory as any }),
          ...(experience && { experience }),
          ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
          ...(bio !== undefined && { bio }),
          ...(online !== undefined && { online }),
        },
        include: { skills: { select: { skill: true } } },
      })
    })

    ok(res, updated)
  } catch (err) {
    console.error('[updateFreelancerProfile]', err)
    serverError(res)
  }
}

// 내 주문 내역 (구매자)
export async function getMyOrders(req: Request, res: Response): Promise<void> {
  try {
    const orders = await prisma.order.findMany({
      where: { buyerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, title: true, thumbnailUrl: true } },
        seller: { select: { id: true, name: true } },
      },
    })
    ok(res, orders)
  } catch (err) {
    console.error('[getMyOrders]', err)
    serverError(res)
  }
}

// 내 판매 내역 (프리랜서)
export async function getMySales(req: Request, res: Response): Promise<void> {
  try {
    const orders = await prisma.order.findMany({
      where: { sellerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, title: true } },
        buyer: { select: { id: true, name: true } },
      },
    })
    ok(res, orders)
  } catch (err) {
    console.error('[getMySales]', err)
    serverError(res)
  }
}

// 내 프로젝트 목록
export async function getMyProjects(req: Request, res: Response): Promise<void> {
  try {
    const projects = await prisma.project.findMany({
      where: { authorId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        skills: { select: { skill: true } },
        _count: { select: { proposals: true } },
      },
    })
    ok(res, projects)
  } catch (err) {
    console.error('[getMyProjects]', err)
    serverError(res)
  }
}