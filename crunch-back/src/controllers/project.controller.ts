import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, created, fail, serverError } from '../lib/response'
import { Prisma } from '@prisma/client'
import { CATEGORY_MAP } from '../lib/contains'

export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const payload = normalizeProjectPayload(req.body)
    if ('error' in payload) {
      fail(res, payload.error ?? '입력값을 확인해주세요.')
      return
    }
    const authorId = req.user!.userId

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          authorId,
          title: payload.title,
          category: payload.mappedCategory,
          budgetPreset: payload.budgetPreset ?? `${payload.budgetAmount.toLocaleString('ko-KR')}원`,
          budgetMin: payload.budgetMin ? Number(payload.budgetMin) : null,
          budgetMax: payload.budgetMax ? Number(payload.budgetMax) : null,
          deadline: payload.deadline,
          description: payload.description,
          collabTags: payload.collabTags ?? [],
          skills: {
            create: (payload.skills ?? []).map((skill: string) => ({ skill })),
          },
        },
        include: {
          skills: { select: { skill: true } },
          author: { select: { id: true, name: true } },
        },
      })

      await tx.$executeRaw`
        UPDATE projects
        SET budget = ${payload.budgetAmount}, status = '결제대기'
        WHERE id = ${createdProject.id}
      `

      for (const role of payload.normalizedRoles) {
        await tx.$executeRaw`
          INSERT INTO project_roles
            (id, project_id, role, headcount, budget_percent, budget_amount)
          VALUES
            (UUID(), ${createdProject.id}, ${role.role}, ${role.headcount}, ${role.budgetPercent}, ${role.budgetAmount})
        `
      }

      return {
        ...createdProject,
        budget: payload.budgetAmount,
        roles: payload.normalizedRoles,
      }
    })

    created(res, project)
  } catch (err) {
    console.error('[createProject]', err)
    serverError(res)
  }
}

// 프로젝트 목록
export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const {
      category, status = 'OPEN',
      page = '1', limit = '10', q,
    } = req.query

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(20, Number(limit))
    const skip = (pageNum - 1) * limitNum

    const where: Prisma.ProjectWhereInput = {
      ...(status && { status: status as any }),
      ...(category && { category: category as any }),
      ...(q && {
        OR: [
          { title: { contains: String(q) } },
          { description: { contains: String(q) } },
        ],
      }),
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          author: { select: { id: true, name: true } },
          skills: { select: { skill: true } },
          _count: { select: { proposals: true } },
        },
      }),
      prisma.project.count({ where }),
    ])

    ok(res, {
      projects,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error('[getProjects]', err)
    serverError(res)
  }
}

// 프로젝트 상세
export async function getProjectById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        skills: { select: { skill: true } },
        _count: { select: { proposals: true } },
      },
    })

    if (!project) {
      res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' })
      return
    }

    ok(res, project)
  } catch (err) {
    console.error('[getProjectById]', err)
    serverError(res)
  }
}

// 결제 전 프로젝트 수정
export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const authorId = req.user!.userId
    const payload = normalizeProjectPayload(req.body)
    if ('error' in payload) {
      fail(res, payload.error ?? '입력값을 확인해주세요.')
      return
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string
      authorId: string
      status: string
      paidCount: bigint
    }>>`
      SELECT
        p.id,
        p.author_id AS authorId,
        p.status,
        COUNT(pay.id) AS paidCount
      FROM projects p
      LEFT JOIN payments pay
        ON pay.project_id = p.id
       AND pay.purpose = 'PROJECT_DEPOSIT'
       AND pay.status = 'PAID'
      WHERE p.id = ${id}
      GROUP BY p.id, p.author_id, p.status
      LIMIT 1
    `

    const project = rows[0]
    if (!project) {
      res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' })
      return
    }
    if (project.authorId !== authorId) {
      res.status(403).json({ success: false, message: '내 프로젝트만 수정할 수 있습니다.' })
      return
    }
    if (project.status !== '결제대기' || Number(project.paidCount) > 0) {
      fail(res, '예치금 결제 전 프로젝트만 수정할 수 있습니다.')
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          title: payload.title,
          category: payload.mappedCategory as any,
          budgetPreset: payload.budgetPreset ?? `${payload.budgetAmount.toLocaleString('ko-KR')}원`,
          budgetMin: payload.budgetMin ? Number(payload.budgetMin) : null,
          budgetMax: payload.budgetMax ? Number(payload.budgetMax) : null,
          deadline: payload.deadline,
          description: payload.description,
          collabTags: payload.collabTags ?? [],
          skills: {
            deleteMany: {},
            create: (payload.skills ?? []).map((skill: string) => ({ skill })),
          },
        },
      })

      await tx.$executeRaw`
        UPDATE projects
        SET budget = ${payload.budgetAmount}
        WHERE id = ${id}
      `
      await tx.$executeRaw`DELETE FROM project_roles WHERE project_id = ${id}`
      await tx.$executeRaw`
        UPDATE payments
        SET status = 'CANCELED', canceled_at = NOW(3), updated_at = NOW(3)
        WHERE project_id = ${id}
          AND purpose = 'PROJECT_DEPOSIT'
          AND status IN ('READY', 'REQUESTED')
      `

      for (const role of payload.normalizedRoles) {
        await tx.$executeRaw`
          INSERT INTO project_roles
            (id, project_id, role, headcount, budget_percent, budget_amount)
          VALUES
            (UUID(), ${id}, ${role.role}, ${role.headcount}, ${role.budgetPercent}, ${role.budgetAmount})
        `
      }
    })

    const updated = await getProjectSnapshot(id)
    ok(res, updated)
  } catch (err) {
    console.error('[updateProject]', err)
    serverError(res)
  }
}

// 내 프로젝트 목록
export async function getMyProjects(req: Request, res: Response): Promise<void> {
  try {
    const authorId = req.user!.userId

    const projects = await prisma.$queryRaw<Array<any>>`
      SELECT
        p.id,
        p.author_id AS authorId,
        p.title,
        p.category,
        p.budget,
        p.budget_preset AS budgetPreset,
        p.budget_min AS budgetMin,
        p.budget_max AS budgetMax,
        p.deadline,
        p.description,
        p.collab_tags AS collabTags,
        p.status,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        (
          SELECT COUNT(*)
          FROM proposals pr
          WHERE pr.project_id = p.id
        ) AS proposalCount,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('skill', ps.skill))
          FROM project_skills ps
          WHERE ps.project_id = p.id
        ) AS skills,
        (
          SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', r.id,
            'role', r.role,
            'headcount', r.headcount,
            'budgetPercent', r.budget_percent,
            'budgetAmount', r.budget_amount
          ))
          FROM project_roles r
          WHERE r.project_id = p.id
        ) AS roles
      FROM projects p
      WHERE p.author_id = ${authorId}
      ORDER BY p.created_at DESC
    `

    ok(res, projects.map(project => ({
      ...project,
      skills: project.skills ?? [],
      roles: project.roles ?? [],
      _count: { proposals: Number(project.proposalCount ?? 0) },
    })))
  } catch (err) {
    console.error('[getMyProjects]', err)
    serverError(res)
  }
}

function normalizeProjectPayload(body: any) {
  const {
    title, category, budget, budgetPreset,
    budgetMin, budgetMax, deadline,
    description, collabTags, skills, roles,
  } = body

  const mappedCategory = CATEGORY_MAP[category]
  if (!mappedCategory) {
    return { error: '유효하지 않은 카테고리입니다.' }
  }

  const budgetAmount = Number(budget)
  if (!Number.isInteger(budgetAmount) || budgetAmount <= 0) {
    return { error: '프로젝트 예산을 입력해주세요.' }
  }

  const projectRoles = Array.isArray(roles) ? roles : []
  if (projectRoles.length === 0) {
    return { error: '필요한 프리랜서 역할을 1개 이상 추가해주세요.' }
  }

  let totalPercent = 0
  const normalizedRoles: Array<{
    role: string
    headcount: number
    budgetPercent: number
    budgetAmount: number
  }> = []
  for (const item of projectRoles) {
    const role = String(item.role ?? '').trim()
    const headcount = Number(item.headcount)
    const budgetPercent = Number(item.budgetPercent)

    if (!role || !Number.isInteger(headcount) || headcount < 1 || !Number.isInteger(budgetPercent) || budgetPercent < 1) {
      return { error: '필요 역할, 인원, 예산 배분율을 확인해주세요.' }
    }

    totalPercent += budgetPercent
    normalizedRoles.push({
      role: role.slice(0, 80),
      headcount,
      budgetPercent,
      budgetAmount: Math.floor(budgetAmount * budgetPercent / 100),
    })
  }

  if (totalPercent > 100) {
    return { error: '역할별 예산 배분율은 총 100%를 넘을 수 없습니다.' }
  }

  return {
    title,
    mappedCategory,
    budgetAmount,
    budgetPreset,
    budgetMin,
    budgetMax,
    deadline,
    description,
    collabTags,
    skills,
    normalizedRoles,
  }
}

async function getProjectSnapshot(id: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    authorId: string
    title: string
    category: string
    budget: number | null
    budgetPreset: string | null
    budgetMin: number | null
    budgetMax: number | null
    deadline: string | null
    description: string | null
    collabTags: unknown
    status: string
    createdAt: Date
    updatedAt: Date
  }>>`
    SELECT
      id,
      author_id AS authorId,
      title,
      category,
      budget,
      budget_preset AS budgetPreset,
      budget_min AS budgetMin,
      budget_max AS budgetMax,
      deadline,
      description,
      collab_tags AS collabTags,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM projects
    WHERE id = ${id}
    LIMIT 1
  `
  const project = rows[0]
  if (!project) return null

  const [skills, roles] = await Promise.all([
    prisma.projectSkill.findMany({ where: { projectId: id }, select: { skill: true } }),
    prisma.$queryRaw<Array<{
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
      WHERE project_id = ${id}
      ORDER BY id ASC
    `,
  ])

  return {
    ...project,
    skills,
    roles,
  }
}
