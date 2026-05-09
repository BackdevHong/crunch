import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError } from '../lib/response'
import { Prisma } from '@prisma/client'

// 어드민 대시보드 요약
export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const [
      totalUsers,
      clientUsers,
      freelancerUsers,
      adminUsers,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      totalServices,
      activeServices,
      inactiveServices,
      pendingServices,
      rejectedServices,
      openProjects,
      totalOrders,
      recentUsers,
      recentApplications,
      recentServices,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'client' } }),
      prisma.user.count({ where: { role: 'freelancer' } }),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.freelancerApplication.count({ where: { status: 'PENDING' } }),
      prisma.freelancerApplication.count({ where: { status: 'APPROVED' } }),
      prisma.freelancerApplication.count({ where: { status: 'REJECTED' } }),
      prisma.service.count(),
      prisma.service.count({ where: { isActive: true, approvalStatus: 'APPROVED' } }),
      prisma.service.count({ where: { isActive: false } }),
      prisma.service.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.service.count({ where: { approvalStatus: 'REJECTED' } }),
      prisma.project.count({ where: { status: 'OPEN' } }),
      prisma.order.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.freelancerApplication.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.service.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          price: true,
          isActive: true,
          approvalStatus: true,
          createdAt: true,
          seller: { select: { id: true, name: true } },
        },
      }),
    ])

    ok(res, {
      metrics: {
        users: { total: totalUsers, client: clientUsers, freelancer: freelancerUsers, admin: adminUsers },
        applications: { pending: pendingApplications, approved: approvedApplications, rejected: rejectedApplications },
        services: { total: totalServices, active: activeServices, inactive: inactiveServices, pending: pendingServices, rejected: rejectedServices },
        projects: { open: openProjects },
        orders: { total: totalOrders },
      },
      recent: {
        users: recentUsers,
        applications: recentApplications,
        services: recentServices,
      },
    })
  } catch (err) {
    console.error('[admin/getSummary]', err)
    serverError(res)
  }
}

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

// 유저 상세
export async function getUserDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        application: {
          select: {
            id: true,
            role: true,
            category: true,
            experience: true,
            hourlyRate: true,
            status: true,
            rejectedReason: true,
            createdAt: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            role: true,
            category: true,
            rating: true,
            completedJobs: true,
            hourlyRate: true,
            online: true,
            experience: true,
            skills: { select: { skill: true } },
          },
        },
        _count: {
          select: {
            services: true,
            projects: true,
            buyerOrders: true,
            sellerOrders: true,
            channelMemberships: true,
          },
        },
      },
    })

    if (!user) {
      res.status(404).json({ success: false, message: '유저를 찾을 수 없습니다.' })
      return
    }

    const [recentServices, recentProjects, recentOrders] = await Promise.all([
      prisma.service.findMany({
        where: { sellerId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, price: true, isActive: true, createdAt: true },
      }),
      prisma.project.findMany({
        where: { authorId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { OR: [{ buyerId: id }, { sellerId: id }] },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          service: { select: { title: true } },
        },
      }),
    ])

    ok(res, {
      user,
      recent: {
        services: recentServices,
        projects: recentProjects,
        orders: recentOrders,
      },
    })
  } catch (err) {
    console.error('[admin/getUserDetail]', err)
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
    const { q, approvalStatus, active, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Number(limit)

    const where: Prisma.ServiceWhereInput = {
      ...(approvalStatus && approvalStatus !== 'ALL' ? { approvalStatus: approvalStatus as any } : {}),
      ...(active === 'true' ? { isActive: true } : {}),
      ...(active === 'false' ? { isActive: false } : {}),
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
          price: true, rating: true, isActive: true, approvalStatus: true, createdAt: true,
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

// 서비스 상세
export async function getServiceDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const service = await prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        deliveryDays: true,
        badge: true,
        rating: true,
        reviewCount: true,
        thumbnailUrl: true,
        isActive: true,
        approvalStatus: true,
        rejectedReason: true,
        createdAt: true,
        updatedAt: true,
        seller: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        skills: { select: { skill: true } },
        _count: { select: { orders: true } },
      },
    })

    if (!service) {
      res.status(404).json({ success: false, message: '서비스를 찾을 수 없습니다.' })
      return
    }

    const [recentOrders, orderStats] = await Promise.all([
      prisma.order.findMany({
        where: { serviceId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          buyer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { serviceId: id },
        _count: { status: true },
      }),
    ])

    ok(res, {
      service,
      orderStats: orderStats.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row._count.status
        return acc
      }, {}),
      recent: { orders: recentOrders },
    })
  } catch (err) {
    console.error('[admin/getServiceDetail]', err)
    serverError(res)
  }
}

// 서비스 활성/비활성 전환
export async function toggleServiceActive(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { isActive } = req.body

    const target = await prisma.service.findUnique({
      where: { id },
      select: { approvalStatus: true },
    })

    if (!target) {
      res.status(404).json({ success: false, message: '서비스를 찾을 수 없습니다.' })
      return
    }
    if (isActive && target.approvalStatus !== 'APPROVED') {
      res.status(400).json({ success: false, message: '승인된 서비스만 활성화할 수 있습니다.' })
      return
    }

    const service = await prisma.service.update({
      where: { id },
      data: { isActive },
      select: { id: true, title: true, isActive: true, approvalStatus: true },
    })

    ok(res, service)
  } catch (err) {
    console.error('[admin/toggleService]', err)
    serverError(res)
  }
}

// 서비스 승인 상태 변경
export async function updateServiceApproval(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { status, reason } = req.body

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ success: false, message: '유효하지 않은 승인 상태입니다.' })
      return
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        approvalStatus: status,
        rejectedReason: status === 'REJECTED' ? (reason ?? null) : null,
        isActive: status === 'APPROVED',
      },
      select: { id: true, title: true, isActive: true, approvalStatus: true, rejectedReason: true },
    })

    ok(res, service)
  } catch (err) {
    console.error('[admin/updateServiceApproval]', err)
    serverError(res)
  }
}
