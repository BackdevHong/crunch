import { Router } from 'express'
import { getHomeSummary } from '../controllers/home.controller'

const router = Router()

router.get('/', getHomeSummary)

export default router
