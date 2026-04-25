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
  meeting: { include: MEETING_INCLUDE },
}

// 내 채널 목록
export async function getMyChannels(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId

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

    const channels = memberships.map(m => m.channel)
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

    const messages = await prisma.channelMessage.findMany({
      where: {
        channelId,
        ...(cursor ? { createdAt: { lt: new Date(cursor as string) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      include: MESSAGE_INCLUDE,
    })

    ok(res, messages.reverse())
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

    const fileUrl = `/uploads/${file.filename}`
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const fileType = file.mimetype
    const fileSize = file.size

    const message = await prisma.channelMessage.create({
      data: { channelId, senderId: userId, content, fileUrl, fileName, fileType, fileSize, messageType: 'FILE' },
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
