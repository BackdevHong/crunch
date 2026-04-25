import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import { verifyAccessToken } from './lib/jwt'
import { prisma } from './lib/prisma'

// WebRTC 시그널링용 타입 (브라우저 DOM 타입 없이 최소 정의)
type RTCSessionDescriptionInit = { type: string; sdp?: string }
type RTCIceCandidateInit = { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null }

export let io: Server

// 채널별 통화 참여자 관리: channelId → Map<userId, { socketId, userName }>
const activeCalls = new Map<string, Map<string, { socketId: string; userName: string }>>()

function emitCallStatus(channelId: string) {
  const participants = activeCalls.get(channelId)
  const list = participants
    ? [...participants.entries()].map(([uid, info]) => ({ userId: uid, userName: info.userName }))
    : []
  io.to(`channel:${channelId}`).emit('call-status', { channelId, participants: list })
}

function leaveCall(userId: string, channelId: string) {
  const participants = activeCalls.get(channelId)
  if (!participants || !participants.has(userId)) return
  participants.delete(userId)
  if (participants.size === 0) activeCalls.delete(channelId)
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

  // ── 인증 미들웨어 ─────────────────────────────────────────
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

  io.on('connection', async (socket: Socket) => {
    const userId: string = socket.data.userId

    // 개인 룸
    socket.join(`user:${userId}`)

    // ── 채널 참가 ────────────────────────────────────────────
    socket.on('join-channel', async (channelId: string) => {
      try {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
        })
        if (member) {
          socket.join(`channel:${channelId}`)
          // 현재 통화 상태 전송
          const participants = activeCalls.get(channelId)
          if (participants && participants.size > 0) {
            socket.emit('call-status', {
              channelId,
              participants: [...participants.entries()].map(([uid, info]) => ({
                userId: uid, userName: info.userName,
              })),
            })
          }
        }
      } catch (err) {
        console.error('[join-channel]', err)
      }
    })

    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`)
    })

    // ── 메시지 전송 ──────────────────────────────────────────
    socket.on('send-message', async ({ channelId, content }: { channelId: string; content: string | null }) => {
      if (!content?.trim()) return
      try {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
        })
        if (!member) return

        const message = await prisma.channelMessage.create({
          data: { channelId, senderId: userId, content: content.trim() },
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
        })

        io.to(`channel:${channelId}`).emit('new-message', message)
      } catch (err) {
        console.error('[send-message]', err)
      }
    })

    // ── 그룹 통화 참가 ───────────────────────────────────────
    socket.on('call-join', async ({ channelId }: { channelId: string }) => {
      try {
        const member = await prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
          include: { user: { select: { name: true } } },
        })
        if (!member) return

        const userName: string = member.user.name

        if (!activeCalls.has(channelId)) {
          activeCalls.set(channelId, new Map())
        }
        const participants = activeCalls.get(channelId)!

        // 현재 참여자 목록 (자신 제외) — 새 참여자에게 전달
        const existing = [...participants.entries()]
          .filter(([uid]) => uid !== userId)
          .map(([uid, info]) => ({ userId: uid, userName: info.userName }))

        // 자신 추가
        participants.set(userId, { socketId: socket.id, userName })

        // 새 참여자에게 기존 참여자 목록 전송 (offer 보내야 할 대상)
        socket.emit('call-participants', { channelId, participants: existing })

        // 기존 참여자들에게 새 참여자 알림 (채널 룸 + 개인 룸 양쪽으로)
        socket.to(`channel:${channelId}`).emit('call-user-joined', { channelId, userId, userName })
        for (const { userId: pid } of existing) {
          io.to(`user:${pid}`).emit('call-user-joined', { channelId, userId, userName })
        }

        // 채널 전체에 통화 상태 업데이트
        emitCallStatus(channelId)
      } catch (err) {
        console.error('[call-join]', err)
      }
    })

    // ── 그룹 통화 퇴장 ───────────────────────────────────────
    socket.on('call-leave', ({ channelId }: { channelId: string }) => {
      leaveCall(userId, channelId)
    })

    // ── WebRTC 시그널링 (1:1 — 그룹 mesh용) ─────────────────
    socket.on('call-offer', ({
      to, channelId, offer,
    }: { to: string; channelId: string; offer: RTCSessionDescriptionInit }) => {
      io.to(`user:${to}`).emit('call-offer', { from: userId, channelId, offer })
    })

    socket.on('call-answer', ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
      io.to(`user:${to}`).emit('call-answer', { from: userId, answer })
    })

    socket.on('ice-candidate', ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(`user:${to}`).emit('ice-candidate', { from: userId, candidate })
    })

    // 화면 공유 알림 — 채널 전체 브로드캐스트
    socket.on('screen-share-toggle', ({ channelId, active }: { channelId: string; active: boolean }) => {
      socket.to(`channel:${channelId}`).emit('screen-share-toggled', { from: userId, active })
    })

    // ── 연결 해제 ────────────────────────────────────────────
    socket.on('disconnect', () => {
      // 참여 중인 모든 통화에서 자동 퇴장
      activeCalls.forEach((_p, channelId) => {
        leaveCall(userId, channelId)
      })
    })
  })

  return io
}
