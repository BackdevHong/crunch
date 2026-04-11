import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/requireAdmin'
import {
  getUsers,
  updateUserRole,
  getAdminServices,
  toggleServiceActive,
} from '../controllers/admin.controller'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/users', getUsers)
router.patch('/users/:id/role', updateUserRole)
router.get('/services', getAdminServices)
router.patch('/services/:id/active', toggleServiceActive)

export default router