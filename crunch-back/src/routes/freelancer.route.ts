import { Router, type Router as ExpressRouter } from 'express'
import { getFreelancers, getFreelancerById } from '../controllers/freelancer.controller'

const router: ExpressRouter = Router()

router.get('/', getFreelancers)
router.get('/:id', getFreelancerById)

export default router