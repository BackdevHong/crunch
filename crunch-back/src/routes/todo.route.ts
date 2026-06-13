import { Router, type Router as ExpressRouter } from 'express'
import { authenticate } from '../middlewares/authenticate'
import { deleteTodoList, toggleTodoItem } from '../controllers/todo.controller'

const router: ExpressRouter = Router()

router.use(authenticate)

router.delete('/:todoListId', deleteTodoList)
router.patch('/items/:itemId/toggle', toggleTodoItem)

export default router
