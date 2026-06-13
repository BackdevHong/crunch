import { Router, type Router as ExpressRouter } from 'express'
import { body } from 'express-validator'
import {
  applyFreelancer,
  getMyApplication,
  getApplications,
  approveApplication,
  rejectApplication,
} from '../controllers/application.controller'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/requireAdmin'

const router: ExpressRouter = Router()

// ?쇰컲 ?좎?
router.post('/', authenticate, [
  body('role').notEmpty().withMessage('吏곸콉???낅젰?댁＜?몄슂.'),
  body('category').notEmpty().withMessage('移댄뀒怨좊━瑜??좏깮?댁＜?몄슂.'),
  body('experience').notEmpty().withMessage('寃쎈젰???좏깮?댁＜?몄슂.'),
], applyFreelancer)

router.get('/me', authenticate, getMyApplication)

// ?대뱶誘??꾩슜
router.get('/', authenticate, requireAdmin, getApplications)
router.patch('/:id/approve', authenticate, requireAdmin, approveApplication)
router.patch('/:id/reject', authenticate, requireAdmin, rejectApplication)

export default router
