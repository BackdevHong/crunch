import { Router } from 'express'
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

const router = Router()

// 일반 유저
router.post('/', authenticate, [
  body('role').notEmpty().withMessage('직책을 입력해주세요.'),
  body('category').notEmpty().withMessage('카테고리를 선택해주세요.'),
  body('experience').notEmpty().withMessage('경력을 선택해주세요.'),
  body('hourlyRate').isInt({ min: 0 }).withMessage('시간당 단가를 입력해주세요.'),
], applyFreelancer)

router.get('/me', authenticate, getMyApplication)

// 어드민 전용
router.get('/', authenticate, requireAdmin, getApplications)
router.patch('/:id/approve', authenticate, requireAdmin, approveApplication)
router.patch('/:id/reject', authenticate, requireAdmin, rejectApplication)

export default router