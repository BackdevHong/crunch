import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, created, fail, serverError } from '../lib/response'
import { CATEGORY_MAP } from '../lib/contains'

// 프리랜서 신청
export async function applyFreelancer(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { role, category, experience, hourlyRate, bio, skills, portfolioUrl } = req.body

    // 이미 신청했는지 확인
    const existing = await prisma.freelancerApplication.findUnique({ where: { userId } })
    if (existing) {
      if (existing.status === 'PENDING') {
        fail(res, '이미 심사 중인 신청이 있습니다.')
        return
      }
      if (existing.status === 'APPROVED') {
        fail(res, '이미 프리랜서로 등록되어 있습니다.')
        return
      }
      // REJECTED면 재신청 허용 — 기존 레코드 업데이트
      const updated = await prisma.freelancerApplication.update({
        where: { userId },
        data: {
          role, experience, bio, portfolioUrl,
          category: CATEGORY_MAP[category] as any,
          hourlyRate: Number(hourlyRate),
          skills: skills ?? [],
          status: 'PENDING',
          rejectedReason: null,
        },
      })
      ok(res, updated)
      return
    }

    const application = await prisma.freelancerApplication.create({
      data: {
        userId,
        role,
        category: CATEGORY_MAP[category] as any,
        experience,
        hourlyRate: Number(hourlyRate),
        bio,
        skills: skills ?? [],
        portfolioUrl,
      },
    })

    created(res, application)
  } catch (err) {
    console.error('[applyFreelancer]', err)
    serverError(res)
  }
}

// 내 신청 현황 조회
export async function getMyApplication(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const application = await prisma.freelancerApplication.findUnique({ where: { userId } })
    ok(res, application)
  } catch (err) {
    console.error('[getMyApplication]', err)
    serverError(res)
  }
}

// ── 어드민 전용 ───────────────────────────────────────────────

// 신청 목록 조회
export async function getApplications(req: Request, res: Response): Promise<void> {
  try {
    const { status = 'PENDING', page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    const where = status === 'ALL' ? {} : { status: status as any }

    const [applications, total] = await Promise.all([
      prisma.freelancerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      prisma.freelancerApplication.count({ where }),
    ])

    ok(res, {
      applications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error('[getApplications]', err)
    serverError(res)
  }
}

// 신청 승인
export async function approveApplication(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const application = await prisma.freelancerApplication.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!application) {
      res.status(404).json({ success: false, message: '신청을 찾을 수 없습니다.' })
      return
    }
    if (application.status !== 'PENDING') {
      fail(res, '대기 중인 신청만 처리할 수 있습니다.')
      return
    }

    // 트랜잭션으로 한번에 처리
    await prisma.$transaction([
      // 1. 신청 상태 변경
      prisma.freelancerApplication.update({
        where: { id },
        data: { status: 'APPROVED' },
      }),
      // 2. freelancers 테이블에 등록
      prisma.freelancer.upsert({
        where: { userId: application.userId },
        create: {
          userId: application.userId,
          role: application.role,
          category: application.category,
          experience: application.experience,
          hourlyRate: application.hourlyRate,
          bio: application.bio,
          badge: 'New',
          skills: {
            create: ((application.skills as string[]) ?? []).map(skill => ({ skill })),
          },
        },
        update: {
          role: application.role,
          category: application.category,
          experience: application.experience,
          hourlyRate: application.hourlyRate,
          bio: application.bio,
        },
      }),
      // 3. 유저 role 변경
      prisma.user.update({
        where: { id: application.userId },
        data: { role: 'freelancer' },
      }),
    ])

    ok(res, { message: '승인이 완료되었습니다.' })
  } catch (err) {
    console.error('[approveApplication]', err)
    serverError(res)
  }
}

// 신청 거절
export async function rejectApplication(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { reason } = req.body

    const application = await prisma.freelancerApplication.findUnique({ where: { id } })
    if (!application) {
      res.status(404).json({ success: false, message: '신청을 찾을 수 없습니다.' })
      return
    }
    if (application.status !== 'PENDING') {
      fail(res, '대기 중인 신청만 처리할 수 있습니다.')
      return
    }

    await prisma.freelancerApplication.update({
      where: { id },
      data: { status: 'REJECTED', rejectedReason: reason ?? null },
    })

    ok(res, { message: '거절 처리되었습니다.' })
  } catch (err) {
    console.error('[rejectApplication]', err)
    serverError(res)
  }
}