import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, created, fail, serverError } from '../lib/response'

// 주문 생성
export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId, requirements } = req.body
    const buyerId = req.user!.userId

    const service = await prisma.service.findUnique({
      where: { id: serviceId, isActive: true },
      select: { id: true, sellerId: true, price: true },
    })

    if (!service) {
      fail(res, '서비스를 찾을 수 없습니다.')
      return
    }

    if (service.sellerId === buyerId) {
      fail(res, '본인의 서비스는 주문할 수 없습니다.')
      return
    }

    const order = await prisma.order.create({
      data: {
        serviceId,
        buyerId,
        sellerId: service.sellerId,
        amount: service.price,
        requirements,
      },
      include: {
        service: { select: { id: true, title: true, price: true } },
        seller: { select: { id: true, name: true } },
      },
    })

    created(res, order)
  } catch (err) {
    console.error('[createOrder]', err)
    serverError(res)
  }
}

// 내 주문 목록
export async function getMyOrders(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { role = 'buyer' } = req.query

    const where = role === 'seller'
      ? { sellerId: userId }
      : { buyerId: userId }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, title: true, thumbnailUrl: true } },
        buyer:   { select: { id: true, name: true } },
        seller:  { select: { id: true, name: true } },
      },
    })

    ok(res, orders)
  } catch (err) {
    console.error('[getMyOrders]', err)
    serverError(res)
  }
}

// 주문 상세
export async function getOrderById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        service: { select: { id: true, title: true, price: true, thumbnailUrl: true } },
        buyer:   { select: { id: true, name: true, avatarUrl: true } },
        seller:  { select: { id: true, name: true, avatarUrl: true } },
        reviews: true,
      },
    })

    if (!order) {
      res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' })
      return
    }

    // 본인(구매자 or 판매자)만 조회 가능
    if (order.buyerId !== userId && order.sellerId !== userId) {
      res.status(403).json({ success: false, message: '접근 권한이 없습니다.' })
      return
    }

    ok(res, order)
  } catch (err) {
    console.error('[getOrderById]', err)
    serverError(res)
  }
}

// 주문 상태 변경
export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { status } = req.body
    const userId = req.user!.userId

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order) {
      res.status(404).json({ success: false, message: '주문을 찾을 수 없습니다.' })
      return
    }

    // 상태 변경 권한 체크
    const allowedTransitions: Record<string, string[]> = {
      seller: ['IN_PROGRESS', 'REVIEW'],   // 판매자: 진행중, 검수 요청
      buyer:  ['DONE', 'CANCELLED'],        // 구매자: 완료 확정, 취소
    }

    const isSeller = order.sellerId === userId
    const isBuyer  = order.buyerId  === userId

    if (!isSeller && !isBuyer) {
      res.status(403).json({ success: false, message: '접근 권한이 없습니다.' })
      return
    }

    const myRole = isSeller ? 'seller' : 'buyer'
    if (!allowedTransitions[myRole].includes(status)) {
      fail(res, '해당 상태로 변경할 권한이 없습니다.')
      return
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(status === 'DONE' ? { completedAt: new Date() } : {}),
      },
    })

    ok(res, updated)
  } catch (err) {
    console.error('[updateOrderStatus]', err)
    serverError(res)
  }
}