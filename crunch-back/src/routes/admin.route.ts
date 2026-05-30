import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import { requireAdmin } from '../middlewares/requireAdmin'
import {
  getSummary,
  getAuditLogs,
  getUsers,
  getUserDetail,
  updateUserRole,
  getAdminServices,
  getAdminProjects,
  getAdminProjectDetail,
  getServiceDetail,
  toggleServiceActive,
  updateServiceApproval,
  updateProjectStatus,
  deleteAdminProject,
} from '../controllers/admin.controller'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/summary', getSummary)
router.get('/audit-logs', getAuditLogs)
router.get('/users', getUsers)
router.get('/users/:id', getUserDetail)
router.patch('/users/:id/role', updateUserRole)
router.get('/services', getAdminServices)
router.get('/services/:id', getServiceDetail)
router.patch('/services/:id/approval', updateServiceApproval)
router.patch('/services/:id/active', toggleServiceActive)
router.get('/projects', getAdminProjects)
router.get('/projects/:id', getAdminProjectDetail)
router.patch('/projects/:id/status', updateProjectStatus)
router.delete('/projects/:id', deleteAdminProject)

export default router
