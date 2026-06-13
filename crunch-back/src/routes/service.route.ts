import { Router, type Router as ExpressRouter } from 'express'
import { getServices, getServiceById, createService, updateMyService } from '../controllers/service.controller'
import { authenticate, requireRole } from '../middlewares/authenticate'

const router: ExpressRouter = Router()

router.get('/', getServices)
router.get('/:id', getServiceById)
router.post('/', authenticate, requireRole('freelancer'), createService)
router.patch('/:id', authenticate, requireRole('freelancer'), updateMyService)

export default router
