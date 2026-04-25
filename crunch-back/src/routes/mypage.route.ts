import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import {
  getMyProfile,
  updateMyProfile,
  updateFreelancerProfile,
  getMyOrders,
  getMySales,
  getMyProjects,
  getMyProposals,
} from '../controllers/mypage.controller'

const router = Router()

router.use(authenticate)

router.get('/profile', getMyProfile)
router.patch('/profile', updateMyProfile)
router.patch('/profile/freelancer', updateFreelancerProfile)
router.get('/orders', getMyOrders)
router.get('/sales', getMySales)
router.get('/projects', getMyProjects)
router.get('/proposals', getMyProposals)

export default router