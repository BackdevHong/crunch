import { Router } from 'express'
import { authenticate, requireRole } from '../middlewares/authenticate'
import {
  createProposal,
  getProjectProposals,
  updateProposalStatus,
} from '../controllers/proposal.controller'

const router = Router()

// 제안 등록 - 프리랜서만
router.post('/', authenticate, requireRole('freelancer'), createProposal)

// 프로젝트별 제안 목록 - 프로젝트 작성자만 (컨트롤러 내 검증)
router.get('/project/:projectId', authenticate, getProjectProposals)

// 제안 수락/거절 - 프로젝트 작성자만 (컨트롤러 내 검증)
router.patch('/:id/status', authenticate, updateProposalStatus)

export default router
