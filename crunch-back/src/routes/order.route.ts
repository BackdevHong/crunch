import { Router } from 'express'
import { body } from 'express-validator'
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} from '../controllers/order.controller'
import { authenticate } from '../middlewares/authenticate'

const router = Router()

// 모든 주문 API는 로그인 필요
router.use(authenticate)

router.post('/', [
  body('serviceId').notEmpty().withMessage('serviceId가 필요합니다.'),
], createOrder)

router.get('/', getMyOrders)
router.get('/:id', getOrderById)
router.patch('/:id/status', [
  body('status')
    .notEmpty()
    .isIn(['IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'])
    .withMessage('유효하지 않은 상태값입니다.'),
], updateOrderStatus)

export default router