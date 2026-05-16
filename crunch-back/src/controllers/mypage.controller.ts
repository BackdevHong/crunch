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

// 내 계정 설정 조회
export async function getMyAccountSettings(req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string
      name: string
      email: string
      role: string
      avatarUrl: string | null
      authProvider: string
      googleId: string | null
      naverId: string | null
      kakaoId: string | null
      createdAt: Date
    }>>`
      SELECT
        id,
        name,
        email,
        role,
        avatar_url AS avatarUrl,
        auth_provider AS authProvider,
        google_id AS googleId,
        naver_id AS naverId,
        kakao_id AS kakaoId,
        created_at AS createdAt
      FROM users
      WHERE id = ${req.user!.userId}
      LIMIT 1
    `

    const user = rows[0]
    if (!user) {
      res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' })
      return
    }

    const hasSocialProvider = Boolean(user.googleId || user.naverId || user.kakaoId)

    ok(res, {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      auth: {
        primaryProvider: user.authProvider,
        providers: {
          local: user.authProvider === 'local' || !hasSocialProvider,
          google: Boolean(user.googleId),
          naver: Boolean(user.naverId),
          kakao: Boolean(user.kakaoId),
        },
      },
    })
  } catch (err) {
    console.error('[getMyAccountSettings]', err)
    serverError(res)
  }
}

// 내 알림 목록
export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const notifications = await prisma.$queryRaw<Array<{
      id: string
      type: string
      title: string
      message: string
      link: string | null
      readAt: Date | null
      createdAt: Date
    }>>`
      SELECT
        id,
        type,
        title,
        message,
        link,
        read_at AS readAt,
        created_at AS createdAt
      FROM user_notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    `
    const unreadRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
      FROM user_notifications
      WHERE user_id = ${userId} AND read_at IS NULL
    `

    ok(res, {
      notifications,
      unreadCount: Number(unreadRows[0]?.total ?? 0),
    })
  } catch (err) {
    console.error('[getMyNotifications]', err)
    serverError(res)
  }
}

// 내 알림 읽음 처리
export async function markMyNotificationsRead(req: Request, res: Response): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE user_notifications
      SET read_at = NOW(3)
      WHERE user_id = ${req.user!.userId} AND read_at IS NULL
    `
    ok(res, { success: true })
  } catch (err) {
    console.error('[markMyNotificationsRead]', err)
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

// 내 서비스 목록 (프리랜서)
export async function getMyServices(req: Request, res: Response): Promise<void> {
  try {
    const services = await prisma.service.findMany({
      where: { sellerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        price: true,
        deliveryDays: true,
        rating: true,
        reviewCount: true,
        description: true,
        thumbnailUrl: true,
        isActive: true,
        approvalStatus: true,
        rejectedReason: true,
        createdAt: true,
        skills: { select: { skill: true } },
        _count: { select: { orders: true } },
      },
    })

    ok(res, services)
  } catch (err) {
    console.error('[getMyServices]', err)
    serverError(res)
  }
}

// 내 제안 목록 (프리랜서)
export async function getMyProposals(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const freelancer = await prisma.freelancer.findUnique({ where: { userId } })
    if (!freelancer) {
      ok(res, [])
      return
    }

    const proposals = await prisma.proposal.findMany({
      where: { freelancerId: freelancer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          include: {
            author: { select: { id: true, name: true } },
            skills: { select: { skill: true } },
          },
        },
      },
    })

    ok(res, proposals)
  } catch (err) {
    console.error('[getMyProposals]', err)
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
