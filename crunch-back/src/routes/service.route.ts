import { Router } from 'express'
import { getServices, getServiceById, createService } from '../controllers/service.controller'
import { authenticate, requireRole } from '../middlewares/authenticate'

const router = Router()

router.get('/', getServices)
router.get('/:id', getServiceById)
router.post('/', authenticate, requireRole('freelancer'), createService)

export default router