import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import {
  getPaymentPolicy,
  nicepayReturn,
  prepareProjectDepositPayment,
} from '../controllers/payment.controller'

const router = Router()

router.get('/policy', getPaymentPolicy)
router.post('/project-deposit', authenticate, prepareProjectDepositPayment)
router.post('/nicepay/return', nicepayReturn)

export default router
