import { Router, type Router as ExpressRouter } from 'express'
import { authenticate } from '../middlewares/authenticate'
import {
  getPaymentPolicy,
  getProjectSettlementSummary,
  nicepayReturn,
  prepareProjectBalancePayment,
  prepareProjectDepositPayment,
} from '../controllers/payment.controller'

const router: ExpressRouter = Router()

router.get('/policy', getPaymentPolicy)
router.get('/projects/:projectId/settlement', authenticate, getProjectSettlementSummary)
router.post('/project-deposit', authenticate, prepareProjectDepositPayment)
router.post('/project-balance', authenticate, prepareProjectBalancePayment)
router.post('/nicepay/return', nicepayReturn)

export default router
