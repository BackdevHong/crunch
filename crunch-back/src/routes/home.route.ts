import { Router, type Router as ExpressRouter } from 'express'
import { getHomeSummary } from '../controllers/home.controller'

const router: ExpressRouter = Router()

router.get('/', getHomeSummary)

export default router
