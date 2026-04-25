import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/useApp'
import socket from '../lib/socket'
import styles from './CallModal.module.css'

const PC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

/**
 * callInfo: { channelId, channelName }
 * Full-mesh WebRTC group call
 */
export default function CallModal({ callInfo, onClose }) {
  const { currentUser } = useApp()
  const { channelId, channelName } = callInfo

  const [peerStreams, setPeerStreams] = useState([]) // [{ id, name, stream }]
  const [isMuted, setIsMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const pcsRef = useRef(new Map())              // peerId → RTCPeerConnection
  const peerNamesRef = useRef(new Map())        // peerId → name
  const peerMediaStreamsRef = useRef(new Map()) // peerId → MediaStream (track 누적용)
  const iceBufRef = useRef(new Map())           // peerId → RTCIceCandidateInit[] (버퍼)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const toggleScreenShareRef = useRef(null)
  const localVideoRef = useRef(null)

  // ── 로컬 미디어 ──────────────────────────────────────────
  const getLocalMedia = useCallback(async () => {
    let stream = null
    try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }) }
    catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }) }
      catch { stream = new MediaStream() }
    }
    localStreamRef.current = stream
    if (localVideoRef.current && stream.getVideoTracks().length > 0) {
      localVideoRef.current.srcObject = stream
    }
    return stream
  }, [])

  // ── Peer 관리 ─────────────────────────────────────────────
  const updatePeerStream = useCallback((peerId, name, stream) => {
    setPeerStreams(prev => {
      const filtered = prev.filter(p => p.id !== peerId)
      return [...filtered, { id: peerId, name, stream }]
    })
  }, [])

  const removePeer = useCallback((peerId) => {
    const pc = pcsRef.current.get(peerId)
    if (pc) { pc.close(); pcsRef.current.delete(peerId) }
    peerNamesRef.current.delete(peerId)
    peerMediaStreamsRef.current.delete(peerId)
    iceBufRef.current.delete(peerId)
    setPeerStreams(prev => prev.filter(p => p.id !== peerId))
  }, [])

  // remote description 설정 후 버퍼된 ICE candidate 처리
  const flushIce = useCallback(async (peerId, pc) => {
    const queue = iceBufRef.current.get(peerId) ?? []
    iceBufRef.current.delete(peerId)
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) }
      catch (e) { console.warn('[ice flush]', e) }
    }
  }, [])

  const createPc = useCallback((peerId, peerName) => {
    const pc = new RTCPeerConnection(PC_CONFIG)

    // peer별 전용 MediaStream — track 여러 개를 하나의 stream으로 누적
    const peerStream = new MediaStream()
    peerMediaStreamsRef.current.set(peerId, peerStream)

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', { to: peerId, candidate })
    }

    pc.ontrack = (event) => {
      // event.streams[0] 이 없는 브라우저 대응 — 전용 stream에 track 추가
      const stream = peerMediaStreamsRef.current.get(peerId) ?? peerStream
      if (!stream.getTrackById(event.track.id)) {
        stream.addTrack(event.track)
      }
      updatePeerStream(peerId, peerName, stream)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removePeer(peerId)
      }
    }

    pcsRef.current.set(peerId, pc)
    return pc
  }, [updatePeerStream, removePeer])

  // ── 통화 참가 / 정리 ──────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const init = async () => {
      await getLocalMedia()
      if (mounted) socket.emit('call-join', { channelId })
    }
    init()

    // 소켓 재연결 시 자동으로 통화 재참여 (activeCalls에서 제거된 경우 복구)
    const handleReconnect = () => {
      socket.emit('call-join', { channelId })
    }
    socket.io.on('reconnect', handleReconnect)

    return () => {
      mounted = false
      socket.io.off('reconnect', handleReconnect)
      socket.emit('call-leave', { channelId })
      const pcs = pcsRef.current
      const peerNames = peerNamesRef.current
      const peerMediaStreams = peerMediaStreamsRef.current
      const iceBuf = iceBufRef.current
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      pcs.forEach(pc => pc.close())
      pcs.clear()
      peerNames.clear()
      peerMediaStreams.clear()
      iceBuf.clear()
    }
  }, [channelId, getLocalMedia])

  // ── 소켓 이벤트 ──────────────────────────────────────────
  useEffect(() => {
    // 새 참여자 → 기존 참여자 목록 수신 → 각각에게 offer 전송
    const onCallParticipants = async ({ channelId: cid, participants }) => {
      if (cid !== channelId) return
      for (const { userId: peerId, userName: peerName } of participants) {
        if (peerId === currentUser?.id) continue
        // 재연결 등으로 기존 PC가 남아 있으면 먼저 정리
        const oldPc = pcsRef.current.get(peerId)
        if (oldPc) { oldPc.close(); pcsRef.current.delete(peerId) }
        peerNamesRef.current.set(peerId, peerName)
        const pc = createPc(peerId, peerName)
        localStreamRef.current?.getTracks().forEach(t => {
          if (localStreamRef.current) pc.addTrack(t, localStreamRef.current)
        })
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('call-offer', { to: peerId, channelId, offer })
      }
    }

    // 기존 참여자 → 새 참여자 이름 저장 (offer가 곧 도착)
    const onUserJoined = ({ channelId: cid, userId: peerId, userName: peerName }) => {
      if (cid !== channelId || peerId === currentUser?.id) return
      peerNamesRef.current.set(peerId, peerName)
    }

    // offer 수신 → answer 전송
    const onOffer = async ({ from: peerId, channelId: cid, offer }) => {
      if (cid !== channelId || peerId === currentUser?.id) return
      const oldPc = pcsRef.current.get(peerId)
      if (oldPc) { oldPc.close(); pcsRef.current.delete(peerId) }

      const peerName = peerNamesRef.current.get(peerId) ?? '참여자'
      const pc = createPc(peerId, peerName)
      localStreamRef.current?.getTracks().forEach(t => {
        if (localStreamRef.current) pc.addTrack(t, localStreamRef.current)
      })
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      await flushIce(peerId, pc) // remote description 설정 후 버퍼 flush
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('call-answer', { to: peerId, answer })
    }

    // answer 수신 → remote description 설정
    const onAnswer = async ({ from: peerId, answer }) => {
      const pc = pcsRef.current.get(peerId)
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await flushIce(peerId, pc) // remote description 설정 후 버퍼 flush
      }
    }

    // ICE candidate — PC가 없거나 remote description이 아직 없으면 버퍼에 저장
    // (ICE candidate가 offer보다 먼저 도착할 수 있으므로 !pc일 때도 버퍼링 필수)
    const onIceCandidate = async ({ from: peerId, candidate }) => {
      const pc = pcsRef.current.get(peerId)
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
        catch (e) { console.warn('[ice]', e) }
      } else {
        const q = iceBufRef.current.get(peerId) ?? []
        q.push(candidate)
        iceBufRef.current.set(peerId, q)
      }
    }

    const onUserLeft = ({ channelId: cid, userId: peerId }) => {
      if (cid !== channelId) return
      removePeer(peerId)
    }

    socket.on('call-participants', onCallParticipants)
    socket.on('call-user-joined', onUserJoined)
    socket.on('call-offer', onOffer)
    socket.on('call-answer', onAnswer)
    socket.on('ice-candidate', onIceCandidate)
    socket.on('call-user-left', onUserLeft)

    return () => {
      socket.off('call-participants', onCallParticipants)
      socket.off('call-user-joined', onUserJoined)
      socket.off('call-offer', onOffer)
      socket.off('call-answer', onAnswer)
      socket.off('ice-candidate', onIceCandidate)
      socket.off('call-user-left', onUserLeft)
    }
  }, [channelId, currentUser, createPc, removePeer, flushIce])

  // ── 컨트롤 ───────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }, [])

  const toggleScreenShare = useCallback(async () => {
    const pcs = [...pcsRef.current.values()]
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]
        for (const pc of pcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(screenTrack)
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream
        screenTrack.onended = () => toggleScreenShareRef.current?.()
        socket.emit('screen-share-toggle', { channelId, active: true })
        setIsScreenSharing(true)
      } catch (err) {
        console.error('[screenShare]', err)
      }
    } else {
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      const camTrack = localStreamRef.current?.getVideoTracks()[0]
      for (const pc of pcs) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender && camTrack) await sender.replaceTrack(camTrack)
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      socket.emit('screen-share-toggle', { channelId, active: false })
      setIsScreenSharing(false)
    }
  }, [isScreenSharing, channelId])
  toggleScreenShareRef.current = toggleScreenShare

  const totalCount = peerStreams.length + 1
  const gridCount = Math.min(totalCount, 6)

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.statusText}>
            {channelName} · 통화 중 {totalCount}명
          </div>
          {isScreenSharing && <div className={styles.screenBadge}>📺 화면 공유 중</div>}
        </div>

        <div className={styles.videoGrid} data-count={String(gridCount)}>
          {/* 내 화면 */}
          <div className={styles.videoCell}>
            <video ref={localVideoRef} className={styles.cellVideo} autoPlay playsInline muted />
            <div className={styles.cellName}>{currentUser?.name} (나)</div>
          </div>
          {/* 참여자 화면 */}
          {peerStreams.map(peer => (
            <PeerVideo key={peer.id} peer={peer} />
          ))}
        </div>

        <div className={styles.controls}>
          <button
            className={`${styles.ctrlBtn} ${isMuted ? styles.ctrlOn : ''}`}
            onClick={toggleMute}
            title={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button
            className={`${styles.ctrlBtn} ${isScreenSharing ? styles.ctrlOn : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? '화면 공유 중지' : '화면 공유'}
          >
            {isScreenSharing ? '🖥️' : '📺'}
          </button>
          <button className={styles.btnEnd} onClick={onClose} title="통화 종료">
            📵
          </button>
        </div>
      </div>
    </div>
  )
}

function PeerVideo({ peer }) {
  const videoRef = useRef(null)
  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream
    }
  }, [peer.stream])
  return (
    <div className={styles.videoCell}>
      <video ref={videoRef} className={styles.cellVideo} autoPlay playsInline />
      <div className={styles.cellName}>{peer.name}</div>
    </div>
  )
}
