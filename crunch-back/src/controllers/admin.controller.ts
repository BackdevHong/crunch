import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError } from '../lib/response'
import { writeAdminAuditLog } from '../lib/adminAudit'
import { createUserNotification } from '../lib/notification'
import { Prisma } from '@prisma/client'
import axios from 'axios'
import { getNicepayBasicAuth, getNicepayConfig } from '../lib/nicepay'

type UserAuthInfo = {
  authProvider: string
  googleId: string | null
  naverId: string | null
  kakaoId: string | null
}

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PAYMENT_PENDING: '결제대기',
  OPEN: '모집중',
  IN_PROGRESS: '진행중',
  DONE: '완료',
  CANCELLED: '취소',
}

type RefundablePayment = {
  id: string
  tid: string | null
  moid: string
  amount: number
}

async function recordAdminPaymentEvent(paymentId: string, eventType: string, payload: unknown): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO payment_events
      (id, payment_id, provider, event_type, payload, created_at)
    VALUES
      (UUID(), ${paymentId}, 'nicepay', ${eventType}, ${JSON.stringify(payload)}, NOW(3))
  `
}

async function refundNicepayPayment(payment: RefundablePayment, reason: string): Promise<void> {
  if (!payment.tid) {
    throw new Error('Nicepay 거래번호가 없어 자동 환불할 수 없습니다.')
  }

  const config = getNicepayConfig()
  const cancelOrderId = `${payment.moid}-REFUND-${Date.now()}`.slice(0, 64)
  const response = await axios.post(`${config.apiBaseUrl}/payments/${encodeURIComponent(payment.tid)}/cancel`, {
    reason,
    orderId: cancelOrderId,
  }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${getNicepayBasicAuth(config.clientKey, config.secretKey)}`,
    },
  })

  await recordAdminPaymentEvent(payment.id, 'CANCEL_RESPONSE', response.data)

  if (String(response.data?.resultCode ?? '') !== '0000') {
    throw new Error(response.data?.resultMsg ?? 'Nicepay ?섎텋 ?붿껌???ㅽ뙣?덉뒿?덈떎.')
  }

  await prisma.$executeRaw`
    UPDATE payments
    SET status = 'REFUNDED', canceled_at = NOW(3), updated_at = NOW(3)
    WHERE id = ${payment.id}
  `
}

// ?대뱶誘???쒕낫???붿빟
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
      recentAuditLogs,
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
      prisma.$queryRaw<Array<{
        id: string
        action: string
        targetType: string
        targetId: string
        message: string
        metadata: string | null
        createdAt: Date
        adminId: string
        adminName: string | null
      }>>`
        SELECT
          l.id,
          l.action,
          l.target_type AS targetType,
          l.target_id AS targetId,
          l.message,
          l.metadata,
          l.created_at AS createdAt,
          l.admin_id AS adminId,
          u.name AS adminName
        FROM admin_audit_logs l
        LEFT JOIN users u ON u.id = l.admin_id
        ORDER BY l.created_at DESC
        LIMIT 10
      `,
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
        auditLogs: recentAuditLogs.map(log => ({
          id: log.id,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          message: log.message,
          metadata: log.metadata,
          createdAt: log.createdAt,
          admin: { id: log.adminId, name: log.adminName },
        })),
      },
    })
  } catch (err) {
    console.error('[admin/getSummary]', err)
    serverError(res)
  }
}

// ?댁쁺 濡쒓렇 紐⑸줉
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { action, targetType, q, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const offset = (pageNum - 1) * limitNum

    const actionFilter = action && action !== 'ALL' ? String(action) : null
    const targetFilter = targetType && targetType !== 'ALL' ? String(targetType) : null
    const query = q ? `%${String(q)}%` : null

    const rows = await prisma.$queryRaw<Array<{
      id: string
      action: string
      targetType: string
      targetId: string
      message: string
      metadata: string | null
      createdAt: Date
      adminId: string
      adminName: string | null
    }>>`
      SELECT
        l.id,
        l.action,
        l.target_type AS targetType,
        l.target_id AS targetId,
        l.message,
        l.metadata,
        l.created_at AS createdAt,
        l.admin_id AS adminId,
        u.name AS adminName
      FROM admin_audit_logs l
      LEFT JOIN users u ON u.id = l.admin_id
      WHERE (${actionFilter} IS NULL OR l.action = ${actionFilter})
        AND (${targetFilter} IS NULL OR l.target_type = ${targetFilter})
        AND (${query} IS NULL OR l.message LIKE ${query} OR u.name LIKE ${query})
      ORDER BY l.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `

    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS total
      FROM admin_audit_logs l
      LEFT JOIN users u ON u.id = l.admin_id
      WHERE (${actionFilter} IS NULL OR l.action = ${actionFilter})
        AND (${targetFilter} IS NULL OR l.target_type = ${targetFilter})
        AND (${query} IS NULL OR l.message LIKE ${query} OR u.name LIKE ${query})
    `
    const total = Number(totalRows[0]?.total ?? 0)

    ok(res, {
      logs: rows.map(log => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        message: log.message,
        metadata: log.metadata,
        createdAt: log.createdAt,
        admin: { id: log.adminId, name: log.adminName },
      })),
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  } catch (err) {
    console.error('[admin/getAuditLogs]', err)
    serverError(res)
  }
}

// ?좎? 紐⑸줉
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
    const authInfoByUserId = await getUserAuthInfoMap(users.map(user => user.id))

    ok(res, {
      users: users.map(user => ({
        ...user,
        auth: authInfoByUserId[user.id] ?? emptyAuthInfo(),
      })),
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  } catch (err) {
    console.error('[admin/getUsers]', err)
    serverError(res)
  }
}

// ?좎? ?곸꽭
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
      res.status(404).json({ success: false, message: '?좎?瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }

    const [authInfo, recentServices, recentProjects, recentOrders] = await Promise.all([
      getUserAuthInfo(id),
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
      user: {
        ...user,
        auth: authInfo,
      },
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

async function getUserAuthInfo(userId: string): Promise<UserAuthInfo> {
  const rows = await prisma.$queryRaw<UserAuthInfo[]>`
    SELECT
      auth_provider AS authProvider,
      google_id AS googleId,
      naver_id AS naverId,
      kakao_id AS kakaoId
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  return rows[0] ?? emptyAuthInfo()
}

async function getUserAuthInfoMap(userIds: string[]): Promise<Record<string, UserAuthInfo>> {
  const entries = await Promise.all(userIds.map(async userId => [userId, await getUserAuthInfo(userId)] as const))
  return Object.fromEntries(entries)
}

function emptyAuthInfo(): UserAuthInfo {
  return {
    authProvider: 'local',
    googleId: null,
    naverId: null,
    kakaoId: null,
  }
}

// 유저 역할 변경
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!['client', 'freelancer', 'admin'].includes(role)) {
      res.status(400).json({ success: false, message: '?좏슚?섏? ?딆? ??븷?낅땲??' })
      return
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    })

    await writeAdminAuditLog({
      adminId: req.user!.userId,
      action: 'USER_ROLE_UPDATED',
      targetType: 'USER',
      targetId: user.id,
      message: `${user.name}?섏쓽 ??븷??${role}(??濡?蹂寃쏀뻽?듬땲??`,
      metadata: { role },
    })
    await createUserNotification({
      userId: user.id,
      type: 'USER_ROLE_UPDATED',
      title: '??븷??蹂寃쎈릺?덉뒿?덈떎',
      message: `怨꾩젙 ??븷??${role}(??濡?蹂寃쎈릺?덉뒿?덈떎.`,
      link: 'mypage-profile',
    })

    ok(res, user)
  } catch (err) {
    console.error('[admin/updateUserRole]', err)
    serverError(res)
  }
}

// ?쒕퉬??紐⑸줉 (?대뱶誘쇱슜 ??鍮꾪솢???ы븿 ?꾩껜)
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

// ?쒕퉬???곸꽭
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
      res.status(404).json({ success: false, message: '?쒕퉬?ㅻ? 李얠쓣 ???놁뒿?덈떎.' })
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

// ?쒕퉬???쒖꽦/鍮꾪솢???꾪솚
export async function toggleServiceActive(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { isActive } = req.body

    const target = await prisma.service.findUnique({
      where: { id },
      select: { approvalStatus: true, sellerId: true, title: true },
    })

    if (!target) {
      res.status(404).json({ success: false, message: '?쒕퉬?ㅻ? 李얠쓣 ???놁뒿?덈떎.' })
      return
    }
    if (isActive && target.approvalStatus !== 'APPROVED') {
      res.status(400).json({ success: false, message: '?뱀씤???쒕퉬?ㅻ쭔 ?쒖꽦?뷀븷 ???덉뒿?덈떎.' })
      return
    }

    const service = await prisma.service.update({
      where: { id },
      data: { isActive },
      select: { id: true, title: true, isActive: true, approvalStatus: true },
    })

    await writeAdminAuditLog({
      adminId: req.user!.userId,
      action: isActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED',
      targetType: 'SERVICE',
      targetId: service.id,
      message: `서비스 "${service.title}"을 ${isActive ? '활성화' : '비활성화'}했습니다.`,
      metadata: { isActive, approvalStatus: service.approvalStatus },
    })
    await createUserNotification({
      userId: target.sellerId,
      type: isActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED',
      title: `서비스가 ${isActive ? '활성화' : '비활성화'}되었습니다`,
      message: `"${target.title}" 서비스의 노출 상태가 변경되었습니다.`,
      link: 'mypage-services',
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
      res.status(400).json({ success: false, message: '?좏슚?섏? ?딆? ?뱀씤 ?곹깭?낅땲??' })
      return
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        approvalStatus: status,
        rejectedReason: status === 'REJECTED' ? (reason ?? null) : null,
        isActive: status === 'APPROVED',
      },
      select: { id: true, title: true, sellerId: true, isActive: true, approvalStatus: true, rejectedReason: true },
    })

    await writeAdminAuditLog({
      adminId: req.user!.userId,
      action: `SERVICE_${status}`,
      targetType: 'SERVICE',
      targetId: service.id,
      message: `서비스 "${service.title}"을 ${status === 'APPROVED' ? '승인' : status === 'REJECTED' ? '반려' : '심사중으로 변경'}했습니다.`,
      metadata: { status, reason: reason ?? null },
    })
    await createUserNotification({
      userId: service.sellerId,
      type: `SERVICE_${status}`,
      title: `서비스가 ${status === 'APPROVED' ? '승인' : status === 'REJECTED' ? '반려' : '심사중'}되었습니다`,
      message: status === 'REJECTED'
        ? `"${service.title}" ?쒕퉬?ㅺ? 諛섎젮?섏뿀?듬땲?? ?ъ쑀瑜??뺤씤?섍퀬 ?ъ떖?щ? ?붿껌?댁＜?몄슂.`
        : `"${service.title}" ?쒕퉬???ъ궗 ?곹깭媛 蹂寃쎈릺?덉뒿?덈떎.`,
      link: 'mypage-services',
    })

    ok(res, service)
  } catch (err) {
    console.error('[admin/updateServiceApproval]', err)
    serverError(res)
  }
}

export async function getAdminProjects(req: Request, res: Response): Promise<void> {
  try {
    const { status, q, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const where: Prisma.ProjectWhereInput = {
      ...(status && status !== 'ALL' ? { status: status as any } : {}),
      ...(q ? {
        OR: [
          { title: { contains: String(q) } },
          { description: { contains: String(q) } },
          { author: { name: { contains: String(q) } } },
          { author: { email: { contains: String(q) } } },
        ],
      } : {}),
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          author: { select: { id: true, name: true, email: true } },
          roles: true,
          _count: { select: { proposals: true, members: true } },
        },
      }),
      prisma.project.count({ where }),
    ])

    const projectIds = projects.map(project => project.id)
    const paymentRows = projectIds.length
      ? await prisma.$queryRaw<Array<{
          projectId: string
          purpose: string
          status: string
          total: bigint | number | null
        }>>`
          SELECT project_id AS projectId, purpose, status, COALESCE(SUM(amount), 0) AS total
          FROM payments
          WHERE project_id IN (${Prisma.join(projectIds)})
          GROUP BY project_id, purpose, status
        `
      : []
    const acceptedRows = projectIds.length
      ? await prisma.proposal.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds }, status: 'ACCEPTED' },
          _count: { _all: true },
        })
      : []

    const paymentsByProject = paymentRows.reduce<Record<string, Record<string, number>>>((acc, row) => {
      acc[row.projectId] ??= {}
      acc[row.projectId][`${row.purpose}_${row.status}`] = Number(row.total ?? 0)
      return acc
    }, {})
    const acceptedByProject = new Map(acceptedRows.map(row => [row.projectId, row._count._all]))

    ok(res, {
      projects: projects.map(project => ({
        ...project,
        acceptedCount: acceptedByProject.get(project.id) ?? 0,
        paymentSummary: paymentsByProject[project.id] ?? {},
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error('[admin/getProjects]', err)
    serverError(res)
  }
}

export async function getAdminProjectDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true } },
        skills: { select: { skill: true } },
        roles: true,
        proposals: {
          orderBy: { createdAt: 'desc' },
          include: {
            freelancer: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
            projectRole: true,
          },
        },
        members: {
          include: {
            freelancer: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    })

    if (!project) {
      res.status(404).json({ success: false, message: '?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }

    const [payments, settlements] = await Promise.all([
      prisma.$queryRaw<Array<{
        id: string
        purpose: string
        status: string
        amount: number
        moid: string
        approvedAt: Date | null
        createdAt: Date
      }>>`
        SELECT
          id,
          purpose,
          status,
          amount,
          moid,
          approved_at AS approvedAt,
          created_at AS createdAt
        FROM payments
        WHERE project_id = ${id}
        ORDER BY created_at DESC
      `,
      prisma.$queryRaw<Array<{
        id: string
        amount: number
        platformFeeAmount: number
        payoutAmount: number
        status: string
        paidAt: Date | null
        freelancerName: string
        role: string | null
      }>>`
        SELECT
          s.id,
          s.amount,
          s.platform_fee_amount AS platformFeeAmount,
          s.payout_amount AS payoutAmount,
          s.status,
          s.paid_at AS paidAt,
          u.name AS freelancerName,
          pr.role AS role
        FROM settlements s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN proposals p ON p.id = s.proposal_id
        LEFT JOIN project_roles pr ON pr.id = p.project_role_id
        WHERE s.project_id = ${id}
        ORDER BY s.created_at DESC
      `,
    ])

    ok(res, { project, payments, settlements })
  } catch (err) {
    console.error('[admin/getProjectDetail]', err)
    serverError(res)
  }
}

export async function updateProjectStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { status } = req.body
    const validStatuses = ['PAYMENT_PENDING', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']

    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: '?좏슚?섏? ?딆? ?꾨줈?앺듃 ?곹깭?낅땲??' })
      return
    }

    const previous = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    })
    if (!previous) {
      res.status(404).json({ success: false, message: '?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }

    const project = await prisma.project.update({
      where: { id },
      data: { status },
      select: { id: true, title: true, status: true },
    })

    await writeAdminAuditLog({
      adminId: req.user!.userId,
      action: 'PROJECT_STATUS_UPDATED',
      targetType: 'PROJECT',
      targetId: project.id,
      message: `프로젝트 "${project.title}" 상태를 ${PROJECT_STATUS_LABEL[previous.status] ?? previous.status}에서 ${PROJECT_STATUS_LABEL[project.status] ?? project.status}(으)로 변경했습니다.`,
      metadata: { previousStatus: previous.status, status: project.status },
    })

    ok(res, project)
  } catch (err) {
    console.error('[admin/updateProjectStatus]', err)
    serverError(res)
  }
}

export async function deleteAdminProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, authorId: true },
    })
    if (!project) {
      res.status(404).json({ success: false, message: '?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }

    const [paidBalanceCount, paidSettlementCount, depositPayments] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM payments
        WHERE project_id = ${id}
          AND purpose = 'PROJECT_BALANCE'
          AND status = 'PAID'
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM settlements
        WHERE project_id = ${id}
          AND status = 'PAID'
      `,
      prisma.$queryRaw<Array<RefundablePayment>>`
        SELECT id, tid, moid, amount
        FROM payments
        WHERE project_id = ${id}
          AND purpose = 'PROJECT_DEPOSIT'
          AND status = 'PAID'
        ORDER BY created_at ASC
      `,
    ])

    if (Number(paidBalanceCount[0]?.count ?? 0) > 0 || Number(paidSettlementCount[0]?.count ?? 0) > 0) {
      res.status(400).json({
        success: false,
        message: '잔금 결제 또는 정산 완료 기록이 있는 프로젝트는 삭제할 수 없습니다. 취소 상태로 변경해주세요.',
      })
      return
    }

    const paymentsWithoutTid = depositPayments.filter(payment => !payment.tid)
    if (paymentsWithoutTid.length > 0) {
      res.status(400).json({
        success: false,
        message: '예치금 결제 기록에 Nicepay 거래번호가 없어 자동 환불할 수 없습니다. 결제 내역을 확인한 뒤 수동 환불 또는 결제 상태 정리가 필요합니다.',
      })
      return
    }

    for (const payment of depositPayments) {
      await refundNicepayPayment(payment, `프로젝트 삭제 환불: ${project.title}`.slice(0, 100))
    }

    await prisma.$transaction(async (tx) => {
      await tx.channel.deleteMany({ where: { projectId: id } })
      await tx.$executeRaw`
        UPDATE payments
        SET
          status = CASE WHEN status IN ('READY', 'REQUESTED') THEN 'CANCELED' ELSE status END,
          canceled_at = CASE WHEN status IN ('READY', 'REQUESTED') THEN NOW(3) ELSE canceled_at END,
          project_id = NULL,
          updated_at = NOW(3)
        WHERE project_id = ${id}
      `
      await tx.project.delete({ where: { id } })
    })

    await writeAdminAuditLog({
      adminId: req.user!.userId,
      action: 'PROJECT_DELETED',
      targetType: 'PROJECT',
      targetId: project.id,
      message: `프로젝트 "${project.title}"을 삭제했습니다.`,
      metadata: {
        authorId: project.authorId,
        refundedDepositAmount: depositPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
        refundedDepositCount: depositPayments.length,
      },
    })

    ok(res, {
      id: project.id,
      refundedDepositAmount: depositPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      refundedDepositCount: depositPayments.length,
    })
  } catch (err) {
    console.error('[admin/deleteProject]', err)
    serverError(res)
  }
}


