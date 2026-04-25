import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { ok, fail, forbidden, notFound, serverError } from '../lib/response'
import { io } from '../socket'

const MEETING_INCLUDE = {
  responses: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'asc' as const },
  },
  proposer: { select: { id: true, name: true } },
}

// 회의 일정 생성 (채널 멤버 누구나)
export async function createMeeting(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { channelId } = req.params
    const { title, scheduledAt } = req.body

    if (!title?.trim() || !scheduledAt) {
      fail(res, '제목과 일정을 입력해주세요.')
      return
    }

    const scheduledDate = new Date(scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      fail(res, '유효하지 않은 날짜입니다.')
      return
    }

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    })
    if (!member) { forbidden(res); return }

    const message = await prisma.channelMessage.create({
      data: {
        channelId,
        senderId: userId,
        messageType: 'MEETING',
        meeting: {
          create: {
            channelId,
            proposerId: userId,
            title: title.trim(),
            scheduledAt: scheduledDate,
          },
        },
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        meeting: { include: MEETING_INCLUDE },
      },
    })

    io.to(`channel:${channelId}`).emit('new-message', message)
    ok(res, message)
  } catch (err) {
    console.error('[createMeeting]', err)
    serverError(res)
  }
}

// 회의 응답 (승인 / 거부)
export async function respondToMeeting(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const { meetingId } = req.params
    const { response } = req.body

    if (response !== 'ACCEPTED' && response !== 'REJECTED') {
      fail(res, '잘못된 응답입니다.')
      return
    }

    const meeting = await prisma.meetingProposal.findUnique({
      where: { id: meetingId },
    })
    if (!meeting) { notFound(res); return }

    if (meeting.proposerId === userId) {
      fail(res, '자신이 제안한 일정에는 응답할 수 없습니다.')
      return
    }

    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: meeting.channelId, userId } },
    })
    if (!member) { forbidden(res); return }

    await prisma.meetingResponse.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, response },
      update: { response },
    })

    const updated = await prisma.meetingProposal.findUnique({
      where: { id: meetingId },
      include: MEETING_INCLUDE,
    })

    io.to(`channel:${meeting.channelId}`).emit('meeting-updated', {
      meetingId,
      messageId: meeting.messageId,
      meeting: updated,
    })

    ok(res, updated)
  } catch (err) {
    console.error('[respondToMeeting]', err)
    serverError(res)
  }
}
