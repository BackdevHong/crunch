import { Request, Response } from 'express'
import axios from 'axios'
import { prisma } from '../lib/prisma'
import { fail, ok, serverError } from '../lib/response'
import {
  createMoid,
  getNicepayBasicAuth,
  getNicepayConfig,
} from '../lib/nicepay'

type ProjectDepositRow = {
  id: string
  title: string
  budget: number | null
  authorId: string
  buyerName: string
  buyerEmail: string
}

type PaymentRow = {
  id: string
  purpose: string
  status: string
  moid: string
  tid: string | null
  projectId: string | null
  orderId: string | null
  buyerId: string
  amount: number
  goodsName: string
}

function getPlatformFeeRate(): number {
  return Number(process.env.PLATFORM_FEE_RATE ?? '0.07')
}

function getProjectDepositRate(): number {
  return Number(process.env.PROJECT_DEPOSIT_RATE ?? '0.2')
}

function getClientUrl(): string {
  return process.env.CLIENT_URL ?? 'http://localhost:5173'
}

function buildNicepayRequest(payment: PaymentRow, buyerName: string, buyerEmail: string) {
  const config = getNicepayConfig()

  return {
    scriptUrl: config.scriptUrl,
    request: {
      clientId: config.clientKey,
      method: 'card',
      orderId: payment.moid,
      amount: payment.amount,
      goodsName: payment.goodsName,
      returnUrl: config.returnUrl,
      buyerName,
      buyerEmail,
      mallReserved: payment.id,
    },
  }
}

async function findPaymentByMoid(moid: string): Promise<PaymentRow | null> {
  const rows = await prisma.$queryRaw<Array<PaymentRow>>`
    SELECT
      id,
      purpose,
      status,
      moid,
      tid,
      project_id AS projectId,
      order_id AS orderId,
      buyer_id AS buyerId,
      amount,
      goods_name AS goodsName
    FROM payments
    WHERE moid = ${moid}
    LIMIT 1
  `

  return rows[0] ?? null
}

async function recordPaymentEvent(paymentId: string | null, eventType: string, payload: unknown): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO payment_events
      (id, payment_id, provider, event_type, payload, created_at)
    VALUES
      (UUID(), ${paymentId}, 'nicepay', ${eventType}, ${JSON.stringify(payload)}, NOW(3))
  `
}

async function createProjectDepositPayment(project: ProjectDepositRow, amount: number): Promise<PaymentRow> {
  const depositRate = getProjectDepositRate()
  const moid = createMoid('PDEP')
  const goodsName = `[예치금] ${project.title}`.slice(0, 120)

  await prisma.$executeRaw`
    INSERT INTO payments
      (id, purpose, status, provider, moid, project_id, buyer_id, amount, deposit_rate, goods_name, created_at, updated_at)
    VALUES
      (UUID(), 'PROJECT_DEPOSIT', 'READY', 'nicepay', ${moid}, ${project.id}, ${project.authorId}, ${amount}, ${depositRate}, ${goodsName}, NOW(3), NOW(3))
  `

  const payment = await findPaymentByMoid(moid)
  if (!payment) throw new Error('Payment creation failed')

  return payment
}

export async function prepareProjectDepositPayment(req: Request, res: Response): Promise<void> {
  try {
    const projectId = String(req.body.projectId ?? '')
    if (!projectId) {
      fail(res, '프로젝트를 선택해주세요.')
      return
    }

    const rows = await prisma.$queryRaw<Array<ProjectDepositRow>>`
      SELECT
        p.id,
        p.title,
        p.budget,
        p.author_id AS authorId,
        u.name AS buyerName,
        u.email AS buyerEmail
      FROM projects p
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ${projectId}
      LIMIT 1
    `

    const project = rows[0]
    if (!project) {
      res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' })
      return
    }
    if (project.authorId !== req.user!.userId) {
      res.status(403).json({ success: false, message: '내 프로젝트만 결제할 수 있습니다.' })
      return
    }
    if (!project.budget || project.budget <= 0) {
      fail(res, '프로젝트 예산이 필요합니다.')
      return
    }

    const depositRate = getProjectDepositRate()
    const amount = Math.max(1, Math.floor(project.budget * depositRate))
    const existingRows = await prisma.$queryRaw<Array<PaymentRow>>`
      SELECT
        id,
        purpose,
        status,
        moid,
        tid,
        project_id AS projectId,
        order_id AS orderId,
        buyer_id AS buyerId,
        amount,
        goods_name AS goodsName
      FROM payments
      WHERE project_id = ${project.id}
        AND purpose = 'PROJECT_DEPOSIT'
        AND status IN ('READY', 'REQUESTED')
      ORDER BY created_at DESC
      LIMIT 1
    `

    const payment = existingRows[0] ?? await createProjectDepositPayment(project, amount)

    await prisma.$executeRaw`
      UPDATE projects
      SET status = '결제대기'
      WHERE id = ${project.id} AND status = '모집중'
    `

    ok(res, {
      payment: {
        id: payment.id,
        purpose: payment.purpose,
        status: payment.status,
        moid: payment.moid,
        amount: payment.amount,
        depositRate,
      },
      nicepay: buildNicepayRequest(payment, project.buyerName, project.buyerEmail),
    })
  } catch (err) {
    console.error('[prepareProjectDepositPayment]', err)
    serverError(res)
  }
}

export async function nicepayReturn(req: Request, res: Response): Promise<void> {
  const clientUrl = getClientUrl()
  const body = req.body
  const moid = String(body.orderId ?? '')
  const resultCode = String(body.authResultCode ?? '')

  try {
    const payment = moid ? await findPaymentByMoid(moid) : null
    await recordPaymentEvent(payment?.id ?? null, 'AUTH_RETURN', body)

    if (!payment) {
      res.redirect(`${clientUrl}?payment=failed&reason=payment_not_found`)
      return
    }

    if (resultCode !== '0000') {
      await prisma.$executeRaw`
        UPDATE payments
        SET status = 'FAILED', failed_at = NOW(3), updated_at = NOW(3)
        WHERE id = ${payment.id} AND status <> 'PAID'
      `
      res.redirect(`${clientUrl}?payment=failed&moid=${encodeURIComponent(payment.moid)}`)
      return
    }

    if (payment.status === 'PAID') {
      res.redirect(`${clientUrl}?payment=success&moid=${encodeURIComponent(payment.moid)}`)
      return
    }

    const amount = Number(body.amount)
    if (amount !== payment.amount) {
      await prisma.$executeRaw`
        UPDATE payments
        SET status = 'FAILED', failed_at = NOW(3), updated_at = NOW(3)
        WHERE id = ${payment.id}
      `
      res.redirect(`${clientUrl}?payment=failed&reason=amount_mismatch&moid=${encodeURIComponent(payment.moid)}`)
      return
    }

    const config = getNicepayConfig()
    const tid = String(body.tid ?? '')

    const approveRes = await axios.post(`${config.apiBaseUrl}/payments/${encodeURIComponent(tid)}`, {
      amount: payment.amount,
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${getNicepayBasicAuth(config.clientKey, config.secretKey)}`,
      },
    })

    await recordPaymentEvent(payment.id, 'APPROVE_RESPONSE', approveRes.data)

    const approveCode = String(approveRes.data?.resultCode ?? '')
    if (approveCode !== '0000') {
      await prisma.$executeRaw`
        UPDATE payments
        SET status = 'FAILED', failed_at = NOW(3), updated_at = NOW(3)
        WHERE id = ${payment.id}
      `
      res.redirect(`${clientUrl}?payment=failed&moid=${encodeURIComponent(payment.moid)}`)
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE payments
        SET
          status = 'PAID',
          tid = ${approveRes.data?.tid ?? tid},
          pay_method = ${approveRes.data?.payMethod ?? null},
          approved_at = NOW(3),
          updated_at = NOW(3)
        WHERE id = ${payment.id}
      `

      if (payment.purpose === 'PROJECT_DEPOSIT' && payment.projectId) {
        await tx.$executeRaw`
          UPDATE projects
          SET status = '모집중'
          WHERE id = ${payment.projectId}
        `
      }
    })

    res.redirect(`${clientUrl}?payment=success&moid=${encodeURIComponent(payment.moid)}`)
  } catch (err) {
    console.error('[nicepayReturn]', err)
    if (moid) {
      const payment = await findPaymentByMoid(moid).catch(() => null)
      if (payment) {
        await prisma.$executeRaw`
          UPDATE payments
          SET status = 'FAILED', failed_at = NOW(3), updated_at = NOW(3)
          WHERE id = ${payment.id} AND status <> 'PAID'
        `
      }
    }
    res.redirect(`${clientUrl}?payment=failed&reason=server_error`)
  }
}

export function getPaymentPolicy(_req: Request, res: Response): void {
  ok(res, {
    platformFeeRate: getPlatformFeeRate(),
    projectDepositRate: getProjectDepositRate(),
    provider: 'nicepay',
  })
}
