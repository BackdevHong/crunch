import { Router, type Router as ExpressRouter } from 'express'
import { authenticate } from '../middlewares/authenticate'
import { respondToMeeting } from '../controllers/meeting.controller'

const router: ExpressRouter = Router()

router.use(authenticate)

router.post('/:meetingId/respond', respondToMeeting)

export default router
