import { Request, Response } from 'express'
import axios from 'axios'
import { prisma } from '../lib/prisma'
import { fail, ok, serverError } from '../lib/response'
import {
  createMoid,
  getNicepayBasicAuth,
  getNicepayConfig,
} from '../lib/nicepay'
import { createUserNotifications } from '../lib/notification'

type ProjectDepositRow = {
  id: string
  title: string
  budget: number | null
  authorId: string
  buyerName: string
  buyerEmail: string
}

type ProjectSettlementRow = ProjectDepositRow & {
  status: string
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

type AcceptedProposalRow = {
  proposalId: string
  projectId: string
  freelancerId: string
  userId: string
  freelancerName: string
  role: string | null
  price: number
  settlementStatus: string | null
  platformFeeAmount: number | null
  payoutAmount: number | null
  paymentId: string | null
  paidAt: Date | null
}

type SettlementSummaryRow = AcceptedProposalRow

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
  const goodsName = `[?덉튂湲? ${project.title}`.slice(0, 120)

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

async function getPaidProjectDepositAmount(projectId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ total: number | null }>>`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE project_id = ${projectId}
      AND purpose = 'PROJECT_DEPOSIT'
      AND status = 'PAID'
  `

  return Number(rows[0]?.total ?? 0)
}

async function getAcceptedProposalRows(projectId: string): Promise<AcceptedProposalRow[]> {
  return prisma.$queryRaw<Array<AcceptedProposalRow>>`
    SELECT
      p.id AS proposalId,
      p.project_id AS projectId,
      p.freelancer_id AS freelancerId,
      f.user_id AS userId,
      u.name AS freelancerName,
      pr.role AS role,
      p.price,
      s.status AS settlementStatus,
      s.platform_fee_amount AS platformFeeAmount,
      s.payout_amount AS payoutAmount,
      s.payment_id AS paymentId,
      s.paid_at AS paidAt
    FROM proposals p
    JOIN project_members pm
      ON pm.project_id = p.project_id
     AND pm.freelancer_id = p.freelancer_id
    JOIN freelancers f ON f.id = p.freelancer_id
    JOIN users u ON u.id = f.user_id
    LEFT JOIN project_roles pr ON pr.id = p.project_role_id
    LEFT JOIN settlements s ON s.proposal_id = p.id
    WHERE p.project_id = ${projectId}
    ORDER BY p.created_at ASC
  `
}

async function createProjectBalancePayment(project: ProjectSettlementRow, amount: number): Promise<PaymentRow> {
  const moid = createMoid('PBAL')
  const goodsName = `[?붽툑] ${project.title}`.slice(0, 120)

  await prisma.$executeRaw`
    INSERT INTO payments
      (id, purpose, status, provider, moid, project_id, buyer_id, amount, goods_name, created_at, updated_at)
    VALUES
      (UUID(), 'PROJECT_BALANCE', 'READY', 'nicepay', ${moid}, ${project.id}, ${project.authorId}, ${amount}, ${goodsName}, NOW(3), NOW(3))
  `

  const payment = await findPaymentByMoid(moid)
  if (!payment) throw new Error('Payment creation failed')

  return payment
}

async function markProjectBalancePaid(payment: PaymentRow): Promise<void> {
  if (!payment.projectId) return

  const projectId = payment.projectId
  const feeRate = getPlatformFeeRate()
  const proposals = await getAcceptedProposalRows(projectId)
  if (proposals.length === 0) return

  await prisma.$transaction(async (tx) => {
    for (const proposal of proposals) {
      const platformFeeAmount = Math.floor(proposal.price * feeRate)
      const payoutAmount = proposal.price - platformFeeAmount

      await tx.$executeRaw`
        INSERT INTO settlements
          (
            id,
            project_id,
            proposal_id,
            freelancer_id,
            user_id,
            payment_id,
            amount,
            platform_fee_rate,
            platform_fee_amount,
            payout_amount,
            status,
            requested_at,
            created_at,
            updated_at
          )
        VALUES
          (
            UUID(),
            ${proposal.projectId},
            ${proposal.proposalId},
            ${proposal.freelancerId},
            ${proposal.userId},
            ${payment.id},
            ${proposal.price},
            ${feeRate},
            ${platformFeeAmount},
            ${payoutAmount},
            'AVAILABLE',
            NOW(3),
            NOW(3)
          )
        ON DUPLICATE KEY UPDATE
          payment_id = VALUES(payment_id),
          amount = VALUES(amount),
          platform_fee_rate = VALUES(platform_fee_rate),
          platform_fee_amount = VALUES(platform_fee_amount),
          payout_amount = VALUES(payout_amount),
          status = CASE WHEN status = 'PAID' THEN status ELSE 'AVAILABLE' END,
          requested_at = COALESCE(requested_at, VALUES(requested_at)),
          paid_at = CASE WHEN status = 'PAID' THEN paid_at ELSE NULL END,
          updated_at = NOW(3)
      `
    }

    await tx.project.update({
      where: { id: projectId },
      data: { status: 'DONE' },
    })
  })

  await createUserNotifications({
    userIds: proposals.map(proposal => proposal.userId),
    type: 'PROJECT_SETTLEMENT_AVAILABLE',
    title: '프로젝트 수익금이 적립되었습니다.',
    message: '수락된 프로젝트의 정산 가능 금액이 마이페이지에 적립되었습니다.',
    link: 'mypage-proposals',
  })
}

export async function prepareProjectDepositPayment(req: Request, res: Response): Promise<void> {
  try {
    const projectId = String(req.body.projectId ?? '')
    if (!projectId) {
      fail(res, '?꾨줈?앺듃瑜??좏깮?댁＜?몄슂.')
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
      res.status(404).json({ success: false, message: '?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }
    if (project.authorId !== req.user!.userId) {
      res.status(403).json({ success: false, message: '???꾨줈?앺듃留?寃곗젣?????덉뒿?덈떎.' })
      return
    }
    if (!project.budget || project.budget <= 0) {
      fail(res, '?꾨줈?앺듃 ?덉궛???꾩슂?⑸땲??')
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
      SET status = '寃곗젣?湲?
      WHERE id = ${project.id} AND status = '紐⑥쭛以?
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

export async function getProjectSettlementSummary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { projectId } = req.params

    const projectRows = await prisma.$queryRaw<Array<ProjectSettlementRow>>`
      SELECT
        p.id,
        p.title,
        p.budget,
        p.status,
        p.author_id AS authorId,
        u.name AS buyerName,
        u.email AS buyerEmail
      FROM projects p
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ${projectId}
      LIMIT 1
    `

    const project = projectRows[0]
    if (!project) {
      res.status(404).json({ success: false, message: '?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }

    const memberRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT pm.freelancer_id AS id
      FROM project_members pm
      JOIN freelancers f ON f.id = pm.freelancer_id
      WHERE pm.project_id = ${projectId}
        AND f.user_id = ${userId}
      LIMIT 1
    `
    const isAuthor = project.authorId === userId
    const isMember = memberRows.length > 0
    if (!isAuthor && !isMember) {
      res.status(403).json({ success: false, message: '?뺤궛 ?뺣낫瑜??뺤씤??沅뚰븳???놁뒿?덈떎.' })
      return
    }

    const [depositPaid, balanceRows, settlements] = await Promise.all([
      getPaidProjectDepositAmount(projectId),
      prisma.$queryRaw<Array<{ total: number | null }>>`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM payments
        WHERE project_id = ${projectId}
          AND purpose = 'PROJECT_BALANCE'
          AND status = 'PAID'
      `,
      getAcceptedProposalRows(projectId),
    ])

    const budget = Number(project.budget ?? 0)
    const balancePaid = Number(balanceRows[0]?.total ?? 0)
    const balanceAmount = Math.max(0, budget - depositPaid - balancePaid)
    const feeRate = getPlatformFeeRate()
    const normalizedSettlements = settlements
      .filter(item => isAuthor || item.userId === userId)
      .map(item => {
        const platformFeeAmount = item.platformFeeAmount ?? Math.floor(item.price * feeRate)
        return {
          proposalId: item.proposalId,
          freelancerId: item.freelancerId,
          userId: item.userId,
          freelancerName: item.freelancerName,
          role: item.role,
          amount: item.price,
          platformFeeAmount,
          payoutAmount: item.payoutAmount ?? item.price - platformFeeAmount,
          status: item.settlementStatus ?? 'READY',
          paidAt: item.paidAt,
        }
      })

    ok(res, {
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        budget,
      },
      isAuthor,
      depositPaid,
      balancePaid,
      balanceAmount,
      platformFeeRate: feeRate,
      canSettle: isAuthor && settlements.length > 0 && balanceAmount > 0,
      settlements: normalizedSettlements,
    })
  } catch (err) {
    console.error('[getProjectSettlementSummary]', err)
    serverError(res)
  }
}

export async function prepareProjectBalancePayment(req: Request, res: Response): Promise<void> {
  try {
    const projectId = String(req.body.projectId ?? '')
    if (!projectId) {
      fail(res, '?꾨줈?앺듃瑜??좏깮?댁＜?몄슂.')
      return
    }

    const rows = await prisma.$queryRaw<Array<ProjectSettlementRow>>`
      SELECT
        p.id,
        p.title,
        p.budget,
        p.status,
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
      res.status(404).json({ success: false, message: '?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }
    if (project.authorId !== req.user!.userId) {
      res.status(403).json({ success: false, message: '?꾨줈?앺듃 ?섎ː?먮쭔 ?뺤궛??吏꾪뻾?????덉뒿?덈떎.' })
      return
    }
    if (!project.budget || project.budget <= 0) {
      fail(res, '?꾨줈?앺듃 ?덉궛???꾩슂?⑸땲??')
      return
    }

    const acceptedProposals = await getAcceptedProposalRows(projectId)
    if (acceptedProposals.length === 0) {
      fail(res, '?섎씫???꾨━?쒖꽌媛 ?덉뼱???뺤궛??吏꾪뻾?????덉뒿?덈떎.')
      return
    }

    const [depositPaid, paidBalanceRows] = await Promise.all([
      getPaidProjectDepositAmount(projectId),
      prisma.$queryRaw<Array<{ total: number | null }>>`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM payments
        WHERE project_id = ${projectId}
          AND purpose = 'PROJECT_BALANCE'
          AND status = 'PAID'
      `,
    ])
    const paidBalance = Number(paidBalanceRows[0]?.total ?? 0)
    const amount = Math.max(0, Number(project.budget) - depositPaid - paidBalance)
    if (amount <= 0) {
      fail(res, '?대? ?붽툑 寃곗젣媛 ?꾨즺???꾨줈?앺듃?낅땲??')
      return
    }

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
        AND purpose = 'PROJECT_BALANCE'
        AND status IN ('READY', 'REQUESTED')
      ORDER BY created_at DESC
      LIMIT 1
    `

    const payment = existingRows[0] ?? await createProjectBalancePayment(project, amount)

    ok(res, {
      payment: {
        id: payment.id,
        purpose: payment.purpose,
        status: payment.status,
        moid: payment.moid,
        amount: payment.amount,
        platformFeeRate: getPlatformFeeRate(),
      },
      nicepay: buildNicepayRequest(payment, project.buyerName, project.buyerEmail),
    })
  } catch (err) {
    console.error('[prepareProjectBalancePayment]', err)
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
      if (payment.purpose === 'PROJECT_BALANCE') {
        await markProjectBalancePaid(payment)
      }
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
          SET status = '紐⑥쭛以?
          WHERE id = ${payment.projectId}
        `
      }
    })

    if (payment.purpose === 'PROJECT_BALANCE') {
      await markProjectBalancePaid(payment)
    }

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
