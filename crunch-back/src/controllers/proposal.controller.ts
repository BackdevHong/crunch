import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, created, fail, forbidden, notFound, serverError } from '../lib/response'
import { ProjectStatus, ProposalStatus } from '@prisma/client'

// 제안 등록 (프리랜서)
export async function createProposal(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { projectId, message, price, deliveryDays } = req.body

    if (!projectId || !message || price == null || deliveryDays == null) {
      fail(res, '필수 항목을 모두 입력해주세요.')
      return
    }

    const freelancer = await prisma.freelancer.findUnique({ where: { userId } })
    if (!freelancer) {
      fail(res, '프리랜서 프로필이 없습니다.')
      return
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      notFound(res, '프로젝트를 찾을 수 없습니다.')
      return
    }
    if (project.status !== ProjectStatus.OPEN) {
      fail(res, '모집이 마감된 프로젝트입니다.')
      return
    }

    const existing = await prisma.proposal.findUnique({
      where: { projectId_freelancerId: { projectId, freelancerId: freelancer.id } },
    })
    if (existing) {
      fail(res, '이미 제안을 제출했습니다.')
      return
    }

    const proposal = await prisma.proposal.create({
      data: {
        projectId,
        freelancerId: freelancer.id,
        message,
        price: Number(price),
        deliveryDays: Number(deliveryDays),
      },
      include: {
        freelancer: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    })

    created(res, proposal)
  } catch (err) {
    console.error('[createProposal]', err)
    serverError(res)
  }
}

// 프로젝트별 제안 목록 조회 (프로젝트 작성자만)
export async function getProjectProposals(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { projectId } = req.params

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      notFound(res, '프로젝트를 찾을 수 없습니다.')
      return
    }
    if (project.authorId !== userId) {
      forbidden(res)
      return
    }

    const proposals = await prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            skills: { select: { skill: true } },
          },
        },
      },
    })

    ok(res, proposals)
  } catch (err) {
    console.error('[getProjectProposals]', err)
    serverError(res)
  }
}

// 제안 수락 / 거절 (프로젝트 작성자만)
export async function updateProposalStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { id } = req.params
    const { status } = req.body

    if (status !== 'ACCEPTED' && status !== 'REJECTED') {
      fail(res, '유효하지 않은 상태입니다.')
      return
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { project: true },
    })
    if (!proposal) {
      notFound(res, '제안을 찾을 수 없습니다.')
      return
    }
    if (proposal.project.authorId !== userId) {
      forbidden(res)
      return
    }

    if (status === 'ACCEPTED') {
      await prisma.$transaction([
        prisma.proposal.update({
          where: { id },
          data: { status: ProposalStatus.ACCEPTED },
        }),
        prisma.proposal.updateMany({
          where: { projectId: proposal.projectId, id: { not: id } },
          data: { status: ProposalStatus.REJECTED },
        }),
        prisma.project.update({
          where: { id: proposal.projectId },
          data: { status: ProjectStatus.IN_PROGRESS },
        }),
      ])
    } else {
      await prisma.proposal.update({
        where: { id },
        data: { status: ProposalStatus.REJECTED },
      })
    }

    ok(res, { message: status === 'ACCEPTED' ? '제안을 수락했습니다.' : '제안을 거절했습니다.' })
  } catch (err) {
    console.error('[updateProposalStatus]', err)
    serverError(res)
  }
}
