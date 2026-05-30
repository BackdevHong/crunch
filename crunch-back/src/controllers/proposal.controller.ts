import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, created, fail, forbidden, notFound, serverError } from '../lib/response'
import { Prisma, ProjectStatus, ProposalStatus } from '@prisma/client'
import { createUserNotification } from '../lib/notification'

async function attachProjectRolesToProposals(proposals: any[]) {
  const roleIds = proposals
    .map(proposal => proposal.projectRoleId)
    .filter(Boolean)

  if (roleIds.length === 0) return proposals

  const roles = await prisma.$queryRaw<Array<{
    id: string
    role: string
    headcount: number
    budgetPercent: number
    budgetAmount: number
  }>>`
    SELECT
      id,
      role,
      headcount,
      budget_percent AS budgetPercent,
      budget_amount AS budgetAmount
    FROM project_roles
    WHERE id IN (${Prisma.join(roleIds)})
  `
  const roleMap = new Map(roles.map(role => [role.id, role]))

  return proposals.map(proposal => ({
    ...proposal,
    projectRole: proposal.projectRoleId ? roleMap.get(proposal.projectRoleId) ?? null : null,
  }))
}

// 제안 등록 (프리랜서)
export async function createProposal(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { projectId, projectRoleId, message, deliveryDays } = req.body

    if (!projectId || !projectRoleId || !message || deliveryDays == null) {
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

    const roleRows = await prisma.$queryRaw<Array<{
      id: string
      projectId: string
      role: string
      headcount: number
      budgetAmount: number
    }>>`
      SELECT
        id,
        project_id AS projectId,
        role,
        headcount,
        budget_amount AS budgetAmount
      FROM project_roles
      WHERE id = ${projectRoleId} AND project_id = ${projectId}
      LIMIT 1
    `
    const projectRole = roleRows[0]
    if (!projectRole) {
      fail(res, '신청할 역할을 선택해주세요.')
      return
    }

    const proposalPrice = Math.floor(projectRole.budgetAmount / Math.max(1, projectRole.headcount))

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
        projectRoleId,
        freelancerId: freelancer.id,
        message,
        price: proposalPrice,
        deliveryDays: Number(deliveryDays),
      } as any,
      include: {
        freelancer: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    })

    await createUserNotification({
      userId: project.authorId,
      type: 'PROJECT_PROPOSAL_CREATED',
      title: '새 프로젝트 제안이 도착했습니다',
      message: `"${project.title}" 프로젝트의 ${projectRole.role} 역할에 ${proposal.freelancer.user.name}님이 신청했습니다.`,
      link: 'mypage-projects',
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

    ok(res, await attachProjectRolesToProposals(proposals))
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
      include: {
        project: true,
        freelancer: { select: { id: true, userId: true } },
      },
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
      if (proposal.projectRoleId) {
        const role = await prisma.projectRole.findUnique({
          where: { id: proposal.projectRoleId },
          select: { headcount: true },
        })
        const acceptedRoleCount = await prisma.proposal.count({
          where: {
            projectRoleId: proposal.projectRoleId,
            status: ProposalStatus.ACCEPTED,
            id: { not: proposal.id },
          },
        })

        if (role && acceptedRoleCount >= role.headcount) {
          fail(res, '이미 해당 역할의 모집 인원이 모두 채워졌습니다.')
          return
        }
      }
      // 프리랜서의 userId 조회
      const freelancerUser = await prisma.user.findUnique({
        where: { id: proposal.freelancer.userId },
        select: { id: true },
      })

      await prisma.$transaction(async (tx) => {
        // 제안 수락
        await tx.proposal.update({
          where: { id },
          data: { status: ProposalStatus.ACCEPTED },
        })

        // 프로젝트 멤버 추가 (중복 무시)
        await tx.projectMember.upsert({
          where: { projectId_freelancerId: { projectId: proposal.projectId, freelancerId: proposal.freelancerId } },
          create: { projectId: proposal.projectId, freelancerId: proposal.freelancerId },
          update: {},
        })

        // 채널 생성 또는 조회
        let channel = await tx.channel.findUnique({
          where: { projectId: proposal.projectId },
        })
        if (!channel) {
          channel = await tx.channel.create({
            data: {
              name: proposal.project.title,
              projectId: proposal.projectId,
            },
          })
          // 프로젝트 작성자를 채널에 추가
          await tx.channelMember.upsert({
            where: { channelId_userId: { channelId: channel.id, userId: proposal.project.authorId } },
            create: { channelId: channel.id, userId: proposal.project.authorId },
            update: {},
          })
        }

        // 프리랜서를 채널에 추가
        if (freelancerUser) {
          await tx.channelMember.upsert({
            where: { channelId_userId: { channelId: channel.id, userId: freelancerUser.id } },
            create: { channelId: channel.id, userId: freelancerUser.id },
            update: {},
          })
        }

        const roles = await tx.projectRole.findMany({
          where: { projectId: proposal.projectId },
          select: { id: true, headcount: true },
        })

        if (roles.length > 0) {
          const acceptedGroups = await tx.proposal.groupBy({
            by: ['projectRoleId'],
            where: {
              projectId: proposal.projectId,
              status: ProposalStatus.ACCEPTED,
              projectRoleId: { in: roles.map(role => role.id) },
            },
            _count: { _all: true },
          })
          const acceptedCountByRole = new Map(
            acceptedGroups.map(group => [group.projectRoleId, group._count._all])
          )
          const allRolesFilled = roles.every(role =>
            (acceptedCountByRole.get(role.id) ?? 0) >= role.headcount
          )

          if (allRolesFilled && proposal.project.status === ProjectStatus.OPEN) {
            await tx.project.update({
              where: { id: proposal.projectId },
              data: { status: ProjectStatus.IN_PROGRESS },
            })
          }
        }
      })
    } else {
      await prisma.proposal.update({
        where: { id },
        data: { status: ProposalStatus.REJECTED },
      })
    }

    await createUserNotification({
      userId: proposal.freelancer.userId,
      type: status === 'ACCEPTED' ? 'PROJECT_PROPOSAL_ACCEPTED' : 'PROJECT_PROPOSAL_REJECTED',
      title: `프로젝트 제안이 ${status === 'ACCEPTED' ? '수락' : '거절'}되었습니다`,
      message: `"${proposal.project.title}" 프로젝트 제안 결과를 확인해주세요.`,
      link: 'mypage-proposals',
    })

    ok(res, { message: status === 'ACCEPTED' ? '제안을 수락했습니다.' : '제안을 거절했습니다.' })
  } catch (err) {
    console.error('[updateProposalStatus]', err)
    serverError(res)
  }
}
