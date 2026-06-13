import { Router, type Router as ExpressRouter } from 'express'
import { authenticate } from '../middlewares/authenticate'
import {
  getMyProfile,
  getMyAccountSettings,
  getMyNotifications,
  markMyNotificationsRead,
  updateMyProfile,
  updateFreelancerProfile,
  getMyOrders,
  getMySales,
  getMyServices,
  getMyProjects,
  getMyProposals,
} from '../controllers/mypage.controller'

const router: ExpressRouter = Router()

router.use(authenticate)

router.get('/profile', getMyProfile)
router.get('/account', getMyAccountSettings)
router.get('/notifications', getMyNotifications)
router.patch('/notifications/read', markMyNotificationsRead)
router.patch('/profile', updateMyProfile)
router.patch('/profile/freelancer', updateFreelancerProfile)
router.get('/orders', getMyOrders)
router.get('/sales', getMySales)
router.get('/services', getMyServices)
router.get('/projects', getMyProjects)
router.get('/proposals', getMyProposals)

export default router
