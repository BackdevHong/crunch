import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import {
  getMyProfile,
  updateMyProfile,
  updateFreelancerProfile,
  getMyOrders,
  getMySales,
  getMyProjects,
} from '../controllers/mypage.controller'

const router = Router()

router.use(authenticate)

router.get('/profile', getMyProfile)
router.patch('/profile', updateMyProfile)
router.patch('/profile/freelancer', updateFreelancerProfile)
router.get('/orders', getMyOrders)
router.get('/sales', getMySales)
router.get('/projects', getMyProjects)

export default router