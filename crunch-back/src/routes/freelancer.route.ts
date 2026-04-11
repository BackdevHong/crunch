import { Router } from 'express'
import { getFreelancers, getFreelancerById } from '../controllers/freelancer.controller'

const router = Router()

router.get('/', getFreelancers)
router.get('/:id', getFreelancerById)

export default router