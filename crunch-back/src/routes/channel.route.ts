import { Router } from 'express'
import { authenticate } from '../middlewares/authenticate'
import { getMyChannels, getChannelMessages, getChannelMembers, uploadChannelFile } from '../controllers/channel.controller'
import { createMeeting } from '../controllers/meeting.controller'
import { getTodoLists, createTodoList } from '../controllers/todo.controller'
import { upload } from '../lib/upload'

const router = Router()

router.use(authenticate)

router.get('/', getMyChannels)
router.get('/:channelId/messages', getChannelMessages)
router.get('/:channelId/members', getChannelMembers)
router.post('/:channelId/upload', upload.single('file'), uploadChannelFile)
router.post('/:channelId/meetings', createMeeting)
router.get('/:channelId/todos', getTodoLists)
router.post('/:channelId/todos', createTodoList)

export default router
