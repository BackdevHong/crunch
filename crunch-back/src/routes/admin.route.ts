import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/requireAdmin'
import {
  getSummary,
  getUsers,
  getUserDetail,
  updateUserRole,
  getAdminServices,
  getServiceDetail,
  toggleServiceActive,
  updateServiceApproval,
} from '../controllers/admin.controller'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/summary', getSummary)
router.get('/users', getUsers)
router.get('/users/:id', getUserDetail)
router.patch('/users/:id/role', updateUserRole)
router.get('/services', getAdminServices)
router.get('/services/:id', getServiceDetail)
router.patch('/services/:id/approval', updateServiceApproval)
router.patch('/services/:id/active', toggleServiceActive)

export default router
