import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, created, fail, serverError } from '../lib/response'
import { Prisma } from '@prisma/client'
import { CATEGORY_MAP } from '../lib/contains'

export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const {
      title, category, budgetPreset,
      budgetMin, budgetMax, deadline,
      description, collabTags, skills,
    } = req.body
    const authorId = req.user!.userId

    const mappedCategory = CATEGORY_MAP[category]
    if (!mappedCategory) {
      fail(res, '유효하지 않은 카테고리입니다.')
      return
    }

    const project = await prisma.project.create({
      data: {
        authorId,
        title,
        category: mappedCategory,
        budgetPreset,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        deadline,
        description,
        collabTags: collabTags ?? [],
        skills: {
          create: (skills ?? []).map((skill: string) => ({ skill })),
        },
      },
      include: {
        skills: { select: { skill: true } },
        author: { select: { id: true, name: true } },
      },
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

// 내 프로젝트 목록
export async function getMyProjects(req: Request, res: Response): Promise<void> {
  try {
    const authorId = req.user!.userId

    const projects = await prisma.project.findMany({
      where: { authorId },
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