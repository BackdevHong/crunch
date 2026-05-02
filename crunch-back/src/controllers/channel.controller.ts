import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, serverError, forbidden } from '../lib/response'
import { io } from '../socket'
import path from 'path'

const MEETING_INCLUDE = {
  responses: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'asc' as const },
  },
  proposer: { select: { id: true, name: true } },
}

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, avatarUrl: true } },
  reactions: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      fileName: true,
      messageType: true,
      editedAt: true,
      deletedAt: true,
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  meeting: { include: MEETING_INCLUDE },
}

// 내 채널 목록
export async function getMyChannels(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const memberships = await prisma.channelMember.findMany({
      where: { userId },
      include: {
        channel: {
          include: {
            project: { select: { id: true, title: true, authorId: true } },
            members: {
              include: { user: { select: { id: true, name: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    const channels = await Promise.all(memberships.map(async m => {
      const unreadWhere = {
        channelId: m.channelId,
        senderId: { not: userId },
        ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
      }
      const [unreadCount, mentionUnreadCount] = await Promise.all([
        prisma.channelMessage.count({ where: unreadWhere }),
        currentUser?.name
          ? prisma.channelMessage.count({
              where: {
                ...unreadWhere,
                content: { contains: `@${currentUser.name}` },
              },
            })
          : Promise.resolve(0),
      ])
      return {
        ...m.channel,
        lastReadAt: m.lastReadAt,
        unreadCount,
        mentionUnreadCount,
      }
    }))
    ok(res, channels)
  } catch (err) {
    console.error('[getMyChannels]', err)
    serverError(res)
  }
}

// 채널 메시지 조회
export async function getChannelMessages(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId } = req.params
    const { cursor, limit = '40' } = req.query

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) {
      forbidden(res)
      return
    }

    const [messages, members] = await Promise.all([
      prisma.channelMessage.findMany({
      where: {
        channelId,
        ...(cursor ? { createdAt: { lt: new Date(cursor as string) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      include: MESSAGE_INCLUDE,
      }),
      prisma.channelMember.findMany({
        where: { channelId },
        select: { userId: true, lastReadAt: true },
      }),
    ])

    ok(res, {
      messages: messages.reverse(),
      readStates: members,
    })
  } catch (err) {
    console.error('[getChannelMessages]', err)
    serverError(res)
  }
}

// 파일 업로드 후 채널 메시지 생성
export async function uploadChannelFile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId } = req.params
    const content = (req.body.content as string | undefined)?.trim() || null
    const replyToId = (req.body.replyToId as string | undefined) || null

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) {
      forbidden(res)
      return
    }

    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, message: '파일이 없습니다.' })
      return
    }

    if (replyToId) {
      const replyTarget = await prisma.channelMessage.findFirst({
        where: { id: replyToId, channelId },
        select: { id: true },
      })
      if (!replyTarget) {
        res.status(400).json({ success: false, message: '답장할 메시지를 찾을 수 없습니다.' })
        return
      }
    }

    const fileUrl = `/uploads/${file.filename}`
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const fileType = file.mimetype
    const fileSize = file.size

    const message = await prisma.channelMessage.create({
      data: { channelId, senderId: userId, content, replyToId, fileUrl, fileName, fileType, fileSize, messageType: 'FILE' },
      include: MESSAGE_INCLUDE,
    })

    io.to(`channel:${channelId}`).emit('new-message', message)
    ok(res, message)
  } catch (err) {
    console.error('[uploadChannelFile]', err)
    serverError(res)
  }
}

// 채널 멤버 조회 (통화 상대 선택용)
export async function getChannelMembers(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId } = req.params

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) {
      forbidden(res)
      return
    }

    const members = await prisma.channelMember.findMany({
      where: { channelId },
      include: { user: { select: { id: true, name: true } } },
    })

    ok(res, members.map(m => m.user))
  } catch (err) {
    console.error('[getChannelMembers]', err)
    serverError(res)
  }
}

export async function togglePinnedMessage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId, messageId } = req.params
    const { pinned } = req.body as { pinned?: boolean }

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) {
      forbidden(res)
      return
    }

    const target = await prisma.channelMessage.findFirst({
      where: { id: messageId, channelId },
    })
    if (!target) {
      res.status(404).json({ success: false, message: '메시지를 찾을 수 없습니다.' })
      return
    }

    const nextPinned = Boolean(pinned)
    const message = await prisma.channelMessage.update({
      where: { id: messageId },
      data: {
        isPinned: nextPinned,
        pinnedAt: nextPinned ? new Date() : null,
        pinnedById: nextPinned ? userId : null,
      },
      include: MESSAGE_INCLUDE,
    })

    io.to(`channel:${channelId}`).emit('message-pin-updated', {
      channelId,
      message,
    })
    ok(res, message)
  } catch (err) {
    console.error('[togglePinnedMessage]', err)
    serverError(res)
  }
}

export async function updateChannelMessage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId, messageId } = req.params
    const content = (req.body.content as string | undefined)?.trim()

    if (!content) {
      res.status(400).json({ success: false, message: '메시지 내용을 입력해주세요.' })
      return
    }

    const target = await prisma.channelMessage.findFirst({
      where: { id: messageId, channelId },
    })
    if (!target) {
      res.status(404).json({ success: false, message: '메시지를 찾을 수 없습니다.' })
      return
    }
    if (target.senderId !== userId) {
      forbidden(res)
      return
    }
    if (target.deletedAt) {
      res.status(400).json({ success: false, message: '삭제된 메시지는 수정할 수 없습니다.' })
      return
    }
    if (target.messageType !== 'TEXT' || target.fileUrl) {
      res.status(400).json({ success: false, message: '일반 텍스트 메시지만 수정할 수 있습니다.' })
      return
    }

    const message = await prisma.channelMessage.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    })

    io.to(`channel:${channelId}`).emit('message-updated', {
      channelId,
      message,
    })
    ok(res, message)
  } catch (err) {
    console.error('[updateChannelMessage]', err)
    serverError(res)
  }
}

export async function deleteChannelMessage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId, messageId } = req.params

    const target = await prisma.channelMessage.findFirst({
      where: { id: messageId, channelId },
    })
    if (!target) {
      res.status(404).json({ success: false, message: '메시지를 찾을 수 없습니다.' })
      return
    }
    if (target.senderId !== userId) {
      forbidden(res)
      return
    }

    const message = await prisma.channelMessage.update({
      where: { id: messageId },
      data: {
        content: null,
        fileUrl: null,
        fileName: null,
        fileType: null,
        fileSize: null,
        isPinned: false,
        pinnedAt: null,
        pinnedById: null,
        deletedAt: new Date(),
      },
      include: MESSAGE_INCLUDE,
    })

    io.to(`channel:${channelId}`).emit('message-deleted', {
      channelId,
      message,
    })
    ok(res, message)
  } catch (err) {
    console.error('[deleteChannelMessage]', err)
    serverError(res)
  }
}

export async function toggleMessageReaction(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId, messageId } = req.params
    const emoji = (req.body.emoji as string | undefined)?.trim()

    const allowed = ['👍', '✅', '👀', '❤️', '🙏', '🔧']
    if (!emoji || !allowed.includes(emoji)) {
      res.status(400).json({ success: false, message: '사용할 수 없는 반응입니다.' })
      return
    }

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) {
      forbidden(res)
      return
    }

    const target = await prisma.channelMessage.findFirst({
      where: { id: messageId, channelId },
      select: { id: true, deletedAt: true },
    })
    if (!target) {
      res.status(404).json({ success: false, message: '메시지를 찾을 수 없습니다.' })
      return
    }
    if (target.deletedAt) {
      res.status(400).json({ success: false, message: '삭제된 메시지에는 반응할 수 없습니다.' })
      return
    }

    const existing = await prisma.channelMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    })

    if (existing) {
      await prisma.channelMessageReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      })
    } else {
      await prisma.channelMessageReaction.create({
        data: { messageId, userId, emoji },
      })
    }

    const message = await prisma.channelMessage.findUnique({
      where: { id: messageId },
      include: MESSAGE_INCLUDE,
    })

    io.to(`channel:${channelId}`).emit('message-reaction-updated', {
      channelId,
      message,
    })
    ok(res, message)
  } catch (err) {
    console.error('[toggleMessageReaction]', err)
    serverError(res)
  }
}
