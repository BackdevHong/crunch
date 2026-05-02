import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import { verifyAccessToken } from './lib/jwt'
import { prisma } from './lib/prisma'

type RTCSessionDescriptionInit = { type: string; sdp?: string }
type RTCIceCandidateInit = { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null }

type CallParticipant = {
  socketId: string
  userName: string
  screenSharing: boolean
}

type CallSettings = {
  annotationPermission: 'all' | 'host' | 'screen'
  screenSharePermission: 'all' | 'host'
  recordingPermission: 'all' | 'host'
  hostId?: string
}

export let io: Server

const activeCalls = new Map<string, Map<string, CallParticipant>>()
const callSettings = new Map<string, CallSettings>()

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
}

function getCallSettings(channelId: string): CallSettings {
  if (!callSettings.has(channelId)) {
    callSettings.set(channelId, {
      annotationPermission: 'all',
      screenSharePermission: 'all',
      recordingPermission: 'host',
    })
  }
  return callSettings.get(channelId)!
}

function callParticipantList(channelId: string) {
  const participants = activeCalls.get(channelId)
  return participants
    ? [...participants.entries()].map(([userId, info]) => ({
        userId,
        userName: info.userName,
        screenSharing: info.screenSharing,
      }))
    : []
}

function emitCallStatus(channelId: string) {
  io.to(`channel:${channelId}`).emit('call-status', {
    channelId,
    participants: callParticipantList(channelId),
    settings: getCallSettings(channelId),
  })
}

function emitToCallParticipant(channelId: string, userId: string, event: string, payload: Record<string, unknown>) {
  const participant = activeCalls.get(channelId)?.get(userId)
  if (participant) {
    io.to(participant.socketId).emit(event, payload)
    return
  }

  io.to(`user:${userId}`).emit(event, payload)
}

function leaveCall(userId: string, channelId: string) {
  const participants = activeCalls.get(channelId)
  if (!participants?.has(userId)) return

  participants.delete(userId)
  if (participants.size === 0) {
    activeCalls.delete(channelId)
    callSettings.delete(channelId)
  }

  io.to(`channel:${channelId}`).emit('call-user-left', { channelId, userId })
  emitCallStatus(channelId)
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('인증이 필요합니다.'))

    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error('토큰이 유효하지 않습니다.'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const userId: string = socket.data.userId
    socket.join(`user:${userId}`)

    socket.on('join-channel', async (channelId: string) => {
      try {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
        })
        if (!member) return

        socket.join(`channel:${channelId}`)
        if (activeCalls.has(channelId)) {
          socket.emit('call-status', {
            channelId,
            participants: callParticipantList(channelId),
            settings: getCallSettings(channelId),
          })
        }
      } catch (err) {
        console.error('[join-channel]', err)
      }
    })

    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`)
    })

    socket.on('channel-read', async ({ channelId }: { channelId: string }) => {
      try {
        const readAt = new Date()
        const member = await prisma.channelMember.updateMany({
          where: { channelId, userId },
          data: { lastReadAt: readAt },
        })
        if (member.count === 0) return

        io.to(`channel:${channelId}`).emit('channel-read-updated', {
          channelId,
          userId,
          lastReadAt: readAt.toISOString(),
        })
      } catch (err) {
        console.error('[channel-read]', err)
      }
    })

    socket.on('send-message', async ({ channelId, content, replyToId }: { channelId: string; content: string | null; replyToId?: string | null }) => {
      if (!content?.trim()) return

      try {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
        })
        if (!member) return

        if (replyToId) {
          const replyTarget = await prisma.channelMessage.findFirst({
            where: { id: replyToId, channelId },
            select: { id: true },
          })
          if (!replyTarget) return
        }

        const message = await prisma.channelMessage.create({
          data: { channelId, senderId: userId, content: content.trim(), replyToId: replyToId || null },
          include: MESSAGE_INCLUDE,
        })

        io.to(`channel:${channelId}`).emit('new-message', message)
      } catch (err) {
        console.error('[send-message]', err)
      }
    })

    socket.on('call-join', async ({ channelId, hostId }: { channelId: string; hostId?: string }) => {
      try {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
          include: { user: { select: { name: true } } },
        })
        if (!member) return

        const userName = member.user.name
        if (!activeCalls.has(channelId)) activeCalls.set(channelId, new Map())
        socket.join(`channel:${channelId}`)
        const settings = getCallSettings(channelId)
        if (!settings.hostId) settings.hostId = hostId ?? userId

        const participants = activeCalls.get(channelId)!
        const existing = [...participants.entries()]
          .filter(([participantId]) => participantId !== userId)
          .map(([participantId, info]) => ({ userId: participantId, userName: info.userName }))

        const previous = participants.get(userId)
        participants.set(userId, {
          socketId: socket.id,
          userName,
          screenSharing: previous?.screenSharing ?? false,
        })

        socket.emit('call-peers', {
          channelId,
          peers: existing,
          settings,
        })

        for (const peer of existing) {
          emitToCallParticipant(channelId, peer.userId, 'call-peer-joined', {
            channelId,
            userId,
            userName,
          })
        }

        emitCallStatus(channelId)
      } catch (err) {
        console.error('[call-join]', err)
      }
    })

    socket.on('call-leave', ({ channelId }: { channelId: string }) => {
      leaveCall(userId, channelId)
    })

    socket.on('call-signal', ({
      to,
      channelId,
      description,
      candidate,
    }: {
      to: string
      channelId: string
      description?: RTCSessionDescriptionInit
      candidate?: RTCIceCandidateInit
    }) => {
      const sender = activeCalls.get(channelId)?.get(userId)
      emitToCallParticipant(channelId, to, 'call-signal', {
        channelId,
        from: userId,
        userName: sender?.userName,
        description,
        candidate,
      })
    })

    socket.on('screen-share-toggle', ({ channelId, active }: { channelId: string; active: boolean }) => {
      const participant = activeCalls.get(channelId)?.get(userId)
      if (participant) participant.screenSharing = active

      socket.to(`channel:${channelId}`).emit('screen-share-toggled', {
        channelId,
        from: userId,
        active,
      })
      emitCallStatus(channelId)
    })

    socket.on('call-media-state', ({
      channelId,
      muted,
      cameraOff,
    }: {
      channelId: string
      muted?: boolean
      cameraOff?: boolean
    }) => {
      const participants = activeCalls.get(channelId)
      if (!participants?.has(userId)) return

      for (const [participantId, participant] of participants.entries()) {
        if (participantId === userId) continue
        io.to(participant.socketId).emit('call-media-state', {
          channelId,
          from: userId,
          muted,
          cameraOff,
        })
      }
    })

    socket.on('call-mute-request', ({ channelId, to }: { channelId: string; to: string }) => {
      const participants = activeCalls.get(channelId)
      const sender = participants?.get(userId)
      if (!participants?.has(userId) || !participants.has(to)) return

      emitToCallParticipant(channelId, to, 'call-mute-request', {
        channelId,
        from: userId,
        fromName: sender?.userName,
      })
    })

    socket.on('call-settings-update', ({
      channelId,
      annotationPermission,
      screenSharePermission,
      recordingPermission,
      hostId,
    }: {
      channelId: string
      annotationPermission?: 'all' | 'host' | 'screen'
      screenSharePermission?: 'all' | 'host'
      recordingPermission?: 'all' | 'host'
      hostId?: string
    }) => {
      const participants = activeCalls.get(channelId)
      if (!participants?.has(userId)) return

      const current = getCallSettings(channelId)
      if (current.hostId && current.hostId !== userId) return
      const next = {
        ...current,
        ...(annotationPermission ? { annotationPermission } : {}),
        ...(screenSharePermission ? { screenSharePermission } : {}),
        ...(recordingPermission ? { recordingPermission } : {}),
        ...(hostId && participants.has(hostId) ? { hostId } : {}),
      }
      callSettings.set(channelId, next)
      io.to(`channel:${channelId}`).emit('call-settings-updated', {
        channelId,
        settings: next,
      })
    })

    socket.on('call-annotation', ({
      channelId,
      annotation,
      clear,
    }: {
      channelId: string
      annotation?: Record<string, unknown>
      clear?: boolean
    }) => {
      const participants = activeCalls.get(channelId)
      if (!participants?.has(userId)) return

      for (const [participantId, participant] of participants.entries()) {
        if (participantId === userId) continue
        io.to(participant.socketId).emit('call-annotation', {
          channelId,
          from: userId,
          annotation,
          clear,
        })
      }
    })

    socket.on('disconnect', () => {
      activeCalls.forEach((_participants, channelId) => {
        leaveCall(userId, channelId)
      })
    })
  })

  return io
}
