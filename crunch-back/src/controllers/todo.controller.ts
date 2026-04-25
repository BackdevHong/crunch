import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, fail, forbidden, notFound, serverError } from '../lib/response'
import { io } from '../socket'

const TODO_ITEM_INCLUDE = {
  completedBy: { select: { id: true, name: true } },
}

const TODO_LIST_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  items: {
    include: TODO_ITEM_INCLUDE,
    orderBy: { createdAt: 'asc' as const },
  },
}

// 채널의 투두 리스트 목록 조회
export async function getTodoLists(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId } = req.params

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) { forbidden(res); return }

    const lists = await prisma.todoList.findMany({
      where: { channelId },
      include: TODO_LIST_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })

    ok(res, lists)
  } catch (err) {
    console.error('[getTodoLists]', err)
    serverError(res)
  }
}

// 투두 리스트 생성
export async function createTodoList(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId } = req.params
    const { title, items } = req.body as { title: string; items: string[] }

    if (!title?.trim()) {
      fail(res, '제목을 입력해주세요.')
      return
    }
    const validItems = (items ?? []).map((t: string) => t.trim()).filter(Boolean)
    if (validItems.length === 0) {
      fail(res, '항목을 하나 이상 입력해주세요.')
      return
    }

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) { forbidden(res); return }

    const todoList = await prisma.todoList.create({
      data: {
        channelId,
        createdById: userId,
        title: title.trim(),
        items: {
          create: validItems.map(text => ({ text })),
        },
      },
      include: TODO_LIST_INCLUDE,
    })

    io.to(`channel:${channelId}`).emit('todo-created', todoList)
    ok(res, todoList)
  } catch (err) {
    console.error('[createTodoList]', err)
    serverError(res)
  }
}

// 투두 리스트 삭제 (의뢰자만)
export async function deleteTodoList(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { todoListId } = req.params

    const todoList = await prisma.todoList.findUnique({
      where: { id: todoListId },
      include: {
        channel: { include: { project: { select: { authorId: true } } } },
      },
    })
    if (!todoList) { notFound(res); return }

    const authorId = todoList.channel.project?.authorId
    if (authorId !== userId) {
      forbidden(res, '의뢰자만 삭제할 수 있습니다.')
      return
    }

    await prisma.todoList.delete({ where: { id: todoListId } })

    io.to(`channel:${todoList.channelId}`).emit('todo-deleted', { todoListId, channelId: todoList.channelId })
    ok(res, { todoListId })
  } catch (err) {
    console.error('[deleteTodoList]', err)
    serverError(res)
  }
}

// 투두 아이템 체크/해제
export async function toggleTodoItem(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { itemId } = req.params

    const item = await prisma.todoItem.findUnique({
      where: { id: itemId },
      include: {
        todoList: true,
        completedBy: { select: { id: true, name: true } },
      },
    })
    if (!item) { notFound(res); return }

    const { channelId } = item.todoList

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) { forbidden(res); return }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const isCompleting = !item.completedAt
    const now = new Date()

    const updated = await prisma.todoItem.update({
      where: { id: itemId },
      data: {
        completedAt: isCompleting ? now : null,
        completedById: isCompleting ? userId : null,
      },
      include: TODO_ITEM_INCLUDE,
    })

    // 시스템 채팅 메시지
    const content = isCompleting
      ? `✅ ${user?.name}이(가) '${item.text}'을(를) 완료했습니다.`
      : `🔄 ${user?.name}이(가) '${item.text}'을(를) 미완료로 변경했습니다.`

    const sysMsg = await prisma.channelMessage.create({
      data: { channelId, senderId: userId, content, messageType: 'SYSTEM' },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        meeting: { include: { responses: { include: { user: { select: { id: true, name: true } } } }, proposer: { select: { id: true, name: true } } } },
      },
    })

    io.to(`channel:${channelId}`).emit('new-message', sysMsg)
    io.to(`channel:${channelId}`).emit('todo-item-toggled', {
      todoListId: item.todoListId,
      item: updated,
    })

    ok(res, updated)
  } catch (err) {
    console.error('[toggleTodoItem]', err)
    serverError(res)
  }
}
