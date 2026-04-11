import { Router } from 'express'
import { body } from 'express-validator'
import {
  createProject,
  getProjects,
  getProjectById,
  getMyProjects,
} from '../controllers/project.controller'
import { authenticate } from '../middlewares/authenticate'

const router = Router()

router.get('/', getProjects)
router.get('/me', authenticate, getMyProjects)
router.get('/:id', getProjectById)
router.post('/', authenticate, [
  body('title').trim().notEmpty().withMessage('제목을 입력해주세요.')
    .isLength({ max: 200 }).withMessage('제목은 200자 이하여야 합니다.'),
  body('category').notEmpty().withMessage('카테고리를 선택해주세요.'),
], createProject)

export default router