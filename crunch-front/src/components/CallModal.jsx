import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import socket from '../lib/socket'
import styles from './CallModal.module.css'

const PC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const splitMemoLines = (value) =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

const formatCallDuration = (startedAt) => {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  if (minutes === 0) return `${restSeconds}초`
  return `${minutes}분 ${restSeconds}초`
}

const createAnnotationId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const connectionLabel = {
  new: '연결 준비',
  connecting: '연결 중',
  connected: '연결됨',
  disconnected: '재연결 중',
  failed: '연결 실패',
  closed: '종료됨',
}

export default function CallModal({ callInfo, onClose }) {
  const { currentUser } = useApp()
  const { channelId, channelName, channelAuthorId } = callInfo

  const [peers, setPeers] = useState([])
  const [callHostId, setCallHostId] = useState(channelAuthorId ?? currentUser?.id)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [remoteScreenShares, setRemoteScreenShares] = useState({})
  const [statusMessage, setStatusMessage] = useState('통화 준비 중')
  const [isWorkPanelOpen, setIsWorkPanelOpen] = useState(false)
  const [isParticipantPanelOpen, setIsParticipantPanelOpen] = useState(false)
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const [annotationPermission, setAnnotationPermission] = useState('all')
  const [screenSharePermission, setScreenSharePermission] = useState('all')
  const [recordingPermission, setRecordingPermission] = useState('host')
  const [isEndReviewOpen, setIsEndReviewOpen] = useState(false)
  const [meetingMemo, setMeetingMemo] = useState('')
  const [decisionMemo, setDecisionMemo] = useState('')
  const [actionMemo, setActionMemo] = useState('')
  const [isSavingSummary, setIsSavingSummary] = useState(false)
  const [summarySaved, setSummarySaved] = useState(false)
  const [annotationTool, setAnnotationTool] = useState('pen')
  const [annotations, setAnnotations] = useState([])
  const [draftAnnotation, setDraftAnnotation] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState('')
  const [pendingRecording, setPendingRecording] = useState(null)
  const [isUploadingRecording, setIsUploadingRecording] = useState(false)
  const [muteRequest, setMuteRequest] = useState(null)
  const isCallHost = String(currentUser?.id) === String(callHostId)

  const localVideoRef = useRef(null)
  const screenPreviewRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const peersRef = useRef(new Map())
  const joinedRef = useRef(false)
  const screenSharingRef = useRef(false)
  const mutedRef = useRef(false)
  const cameraOffRef = useRef(false)
  const callStartedAtRef = useRef(new Date())
  const annotationStartRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingChunksRef = useRef([])

  const setLocalPreview = useCallback((stream) => {
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = stream
  }, [])

  useEffect(() => {
    if (screenPreviewRef.current && isScreenSharing && screenStreamRef.current) {
      screenPreviewRef.current.srcObject = screenStreamRef.current
    }
  }, [isScreenSharing])

  const upsertPeerView = useCallback((peerId, name, stream) => {
    setPeers(prev => {
      const existing = prev.find(peer => peer.id === peerId)
      const rest = prev.filter(peer => peer.id !== peerId)
      return [...rest, { ...existing, id: peerId, name, stream }]
    })
  }, [])

  const updatePeerMediaState = useCallback((peerId, mediaState) => {
    setPeers(prev => prev.map(peer =>
      peer.id === peerId
        ? { ...peer, mediaState: { ...(peer.mediaState ?? {}), ...mediaState } }
        : peer
    ))
  }, [])

  const updatePeerConnectionState = useCallback((peerId, connectionState) => {
    setPeers(prev => prev.map(peer =>
      peer.id === peerId
        ? { ...peer, connectionState }
        : peer
    ))
  }, [])

  const removePeer = useCallback((peerId) => {
    const peer = peersRef.current.get(peerId)
    if (peer) {
      peer.pc.ontrack = null
      peer.pc.onicecandidate = null
      peer.pc.onnegotiationneeded = null
      peer.pc.close()
    }
    peersRef.current.delete(peerId)
    setPeers(prev => prev.filter(peer => peer.id !== peerId))
    setRemoteScreenShares(prev => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }, [])

  const addLocalTracks = useCallback((pc) => {
    const localStream = localStreamRef.current
    if (!localStream) return

    localStream.getAudioTracks().forEach(track => {
      if (!pc.getSenders().some(sender => sender.track === track)) {
        pc.addTrack(track, localStream)
      }
    })

    const videoTrack = screenSharingRef.current
      ? screenStreamRef.current?.getVideoTracks()[0]
      : localStream.getVideoTracks()[0]

    if (videoTrack && !pc.getSenders().some(sender => sender.track?.kind === 'video')) {
      pc.addTrack(videoTrack, screenSharingRef.current ? screenStreamRef.current : localStream)
    }
  }, [])

  const ensurePeer = useCallback((peerId, peerName = '참여자') => {
    const current = peersRef.current.get(peerId)
    if (current) {
      current.name = peerName
      return current
    }

    const pc = new RTCPeerConnection(PC_CONFIG)
    const remoteStream = new MediaStream()
    const peerState = {
      id: peerId,
      name: peerName,
      pc,
      stream: remoteStream,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      polite: String(currentUser?.id ?? '') > String(peerId),
    }

    peersRef.current.set(peerId, peerState)
    upsertPeerView(peerId, peerName, remoteStream)

    pc.ontrack = (event) => {
      if (!remoteStream.getTrackById(event.track.id)) {
        remoteStream.addTrack(event.track)
      }
      upsertPeerView(peerId, peerState.name, remoteStream)
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('call-signal', { channelId, to: peerId, candidate })
    }

    pc.onnegotiationneeded = async () => {
      try {
        peerState.makingOffer = true
        await pc.setLocalDescription()
        socket.emit('call-signal', {
          channelId,
          to: peerId,
          description: pc.localDescription,
        })
      } catch (err) {
        console.warn('[통화] 연결 협상 실패', err)
      } finally {
        peerState.makingOffer = false
      }
    }

    pc.onconnectionstatechange = () => {
      updatePeerConnectionState(peerId, pc.connectionState)
      if (pc.connectionState === 'connected') setStatusMessage('통화 연결됨')
    }

    addLocalTracks(pc)
    return peerState
  }, [addLocalTracks, channelId, currentUser?.id, updatePeerConnectionState, upsertPeerView])

  const replaceOutgoingVideo = useCallback(async (track) => {
    await Promise.all([...peersRef.current.values()].map(async ({ pc }) => {
      const sender = pc.getSenders().find(item => item.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(track)
      } else if (track) {
        pc.addTrack(track, screenSharingRef.current ? screenStreamRef.current : localStreamRef.current)
      }
    }))
  }, [])

  const getLocalMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusMessage('이 브라우저는 실시간 통화를 지원하지 않습니다.')
      localStreamRef.current = new MediaStream()
      peersRef.current.forEach(({ pc }) => addLocalTracks(pc))
      return localStreamRef.current
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      localStreamRef.current = stream
      setLocalPreview(stream)
      peersRef.current.forEach(({ pc }) => addLocalTracks(pc))
      setStatusMessage('참여자 대기 중')
      return stream
    } catch (videoError) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        localStreamRef.current = audioOnly
        peersRef.current.forEach(({ pc }) => addLocalTracks(pc))
        cameraOffRef.current = true
        setIsCameraOff(true)
        setStatusMessage('카메라 없이 통화에 참여했습니다.')
        return audioOnly
      } catch (audioError) {
        console.error('[통화] 미디어 권한 요청 실패', videoError, audioError)
        localStreamRef.current = new MediaStream()
        peersRef.current.forEach(({ pc }) => addLocalTracks(pc))
        mutedRef.current = true
        cameraOffRef.current = true
        setIsMuted(true)
        setIsCameraOff(true)
        setStatusMessage('보기 모드로 참여했습니다.')
        return localStreamRef.current
      }
    }
  }, [addLocalTracks, setLocalPreview])

  useEffect(() => {
    const onPeers = ({ channelId: eventChannelId, peers: existingPeers, settings }) => {
      if (eventChannelId !== channelId) return
      if (settings?.annotationPermission) setAnnotationPermission(settings.annotationPermission)
      if (settings?.screenSharePermission) setScreenSharePermission(settings.screenSharePermission)
      if (settings?.recordingPermission) setRecordingPermission(settings.recordingPermission)
      if (settings?.hostId) setCallHostId(settings.hostId)
      const screenShares = {}
      existingPeers.forEach(peer => {
        ensurePeer(peer.userId, peer.userName)
        if (peer.screenSharing) screenShares[peer.userId] = true
      })
      if (Object.keys(screenShares).length > 0) {
        setRemoteScreenShares(prev => ({ ...prev, ...screenShares }))
      }
      socket.emit('call-media-state', { channelId, muted: mutedRef.current, cameraOff: cameraOffRef.current })
    }

    const onCallStatus = ({ channelId: eventChannelId, participants, settings }) => {
      if (eventChannelId !== channelId) return
      if (settings?.annotationPermission) setAnnotationPermission(settings.annotationPermission)
      if (settings?.screenSharePermission) setScreenSharePermission(settings.screenSharePermission)
      if (settings?.recordingPermission) setRecordingPermission(settings.recordingPermission)
      if (settings?.hostId) setCallHostId(settings.hostId)
      const nextScreenShares = {}
      participants
        .filter(participant => String(participant.userId) !== String(currentUser?.id))
        .forEach(participant => {
          ensurePeer(participant.userId, participant.userName)
          if (participant.screenSharing) nextScreenShares[participant.userId] = true
        })
      setRemoteScreenShares(nextScreenShares)
    }

    const onPeerJoined = ({ channelId: eventChannelId, userId, userName }) => {
      if (eventChannelId !== channelId || String(userId) === String(currentUser?.id)) return
      ensurePeer(userId, userName)
      socket.emit('call-media-state', { channelId, muted: mutedRef.current, cameraOff: cameraOffRef.current })
    }

    const onSignal = async ({ channelId: eventChannelId, from, userName, description, candidate }) => {
      if (eventChannelId !== channelId || String(from) === String(currentUser?.id)) return

      const peer = ensurePeer(from, userName)
      const pc = peer.pc

      try {
        if (description) {
          const readyForOffer = !peer.makingOffer && (pc.signalingState === 'stable' || peer.polite)
          const offerCollision = description.type === 'offer' && !readyForOffer

          peer.ignoreOffer = !peer.polite && offerCollision
          if (peer.ignoreOffer) return

          await pc.setRemoteDescription(description)
          while (peer.pendingCandidates.length > 0) {
            try {
              await pc.addIceCandidate(peer.pendingCandidates.shift())
            } catch (err) {
              if (!peer.ignoreOffer) throw err
            }
          }

          if (description.type === 'offer') {
            await pc.setLocalDescription()
            socket.emit('call-signal', {
              channelId,
              to: from,
              description: pc.localDescription,
            })
          }
          return
        }

        if (candidate) {
          if (!pc.remoteDescription) {
            peer.pendingCandidates.push(candidate)
            return
          }

          try {
            await pc.addIceCandidate(candidate)
          } catch (err) {
            if (!peer.ignoreOffer) throw err
          }
        }
      } catch (err) {
        console.warn('[통화] 시그널 처리 실패', err)
      }
    }

    const onPeerLeft = ({ channelId: eventChannelId, userId }) => {
      if (eventChannelId === channelId) removePeer(userId)
    }

    const onScreenShareToggled = ({ channelId: eventChannelId, from, active }) => {
      if (eventChannelId !== channelId) return
      setRemoteScreenShares(prev => ({ ...prev, [from]: active }))
    }

    const onMediaState = ({ channelId: eventChannelId, from, muted, cameraOff }) => {
      if (eventChannelId !== channelId || from === currentUser?.id) return
      updatePeerMediaState(from, {
        ...(muted !== undefined ? { muted } : {}),
        ...(cameraOff !== undefined ? { cameraOff } : {}),
      })
    }

    const onAnnotation = ({ channelId: eventChannelId, annotation, clear }) => {
      if (eventChannelId !== channelId) return
      if (clear) {
        setAnnotations([])
        setDraftAnnotation(null)
        return
      }
      if (annotation) setAnnotations(prev => [...prev, annotation])
    }

    const onMuteRequest = ({ channelId: eventChannelId, fromName }) => {
      if (eventChannelId !== channelId) return
      setMuteRequest({ fromName: fromName ?? '방장' })
      setStatusMessage('음소거 요청을 받았습니다.')
    }

    const onSettingsUpdated = ({ channelId: eventChannelId, settings }) => {
      if (eventChannelId !== channelId) return
      if (settings?.annotationPermission) {
        setAnnotationPermission(settings.annotationPermission)
      }
      if (settings?.screenSharePermission) setScreenSharePermission(settings.screenSharePermission)
      if (settings?.recordingPermission) setRecordingPermission(settings.recordingPermission)
      if (settings?.hostId) setCallHostId(settings.hostId)
      setStatusMessage('통화 설정이 변경되었습니다.')
    }

    socket.on('call-peers', onPeers)
    socket.on('call-status', onCallStatus)
    socket.on('call-peer-joined', onPeerJoined)
    socket.on('call-signal', onSignal)
    socket.on('call-user-left', onPeerLeft)
    socket.on('screen-share-toggled', onScreenShareToggled)
    socket.on('call-media-state', onMediaState)
    socket.on('call-annotation', onAnnotation)
    socket.on('call-mute-request', onMuteRequest)
    socket.on('call-settings-updated', onSettingsUpdated)

    return () => {
      socket.off('call-peers', onPeers)
      socket.off('call-status', onCallStatus)
      socket.off('call-peer-joined', onPeerJoined)
      socket.off('call-signal', onSignal)
      socket.off('call-user-left', onPeerLeft)
      socket.off('screen-share-toggled', onScreenShareToggled)
      socket.off('call-media-state', onMediaState)
      socket.off('call-annotation', onAnnotation)
      socket.off('call-mute-request', onMuteRequest)
      socket.off('call-settings-updated', onSettingsUpdated)
    }
  }, [channelId, currentUser?.id, ensurePeer, removePeer, updatePeerMediaState])

  useEffect(() => {
    let active = true

    const join = async () => {
      await getLocalMedia()
      if (!active) return
      socket.emit('call-join', { channelId, hostId: channelAuthorId })
      socket.emit('call-media-state', { channelId, muted: mutedRef.current, cameraOff: cameraOffRef.current })
      joinedRef.current = true
    }

    join()

    const onReconnect = () => {
      if (joinedRef.current) socket.emit('call-join', { channelId, hostId: channelAuthorId })
    }
    socket.io.on('reconnect', onReconnect)

    return () => {
      active = false
      joinedRef.current = false
      socket.io.off('reconnect', onReconnect)
      socket.emit('call-leave', { channelId })
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      localStreamRef.current?.getTracks().forEach(track => track.stop())
      screenStreamRef.current?.getTracks().forEach(track => track.stop())
      peersRef.current.forEach(({ pc }) => pc.close())
      peersRef.current.clear()
    }
  }, [channelAuthorId, channelId, getLocalMedia])

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted
    })
    mutedRef.current = nextMuted
    setIsMuted(nextMuted)
    socket.emit('call-media-state', { channelId, muted: nextMuted })
  }, [channelId, isMuted])

  const acceptMuteRequest = useCallback(() => {
    if (!isMuted) {
      localStreamRef.current?.getAudioTracks().forEach(track => {
        track.enabled = false
      })
      mutedRef.current = true
      setIsMuted(true)
      socket.emit('call-media-state', { channelId, muted: true })
    }
    setMuteRequest(null)
    setStatusMessage('마이크를 음소거했습니다.')
  }, [channelId, isMuted])

  const dismissMuteRequest = useCallback(() => {
    setMuteRequest(null)
    setStatusMessage('음소거 요청을 닫았습니다.')
  }, [])

  const requestPeerMute = useCallback((peer) => {
    if (!isCallHost) {
      setStatusMessage('방장만 음소거를 요청할 수 있습니다.')
      return
    }
    socket.emit('call-mute-request', { channelId, to: peer.id })
    setStatusMessage(`${peer.name}님에게 음소거를 요청했습니다.`)
  }, [channelId, isCallHost])

  const reconnectPeer = useCallback((peerId, peerName = '참여자') => {
    removePeer(peerId)
    setTimeout(() => {
      ensurePeer(peerId, peerName)
      setStatusMessage(`${peerName}님과 다시 연결을 시도합니다.`)
    }, 0)
  }, [ensurePeer, removePeer])

  const toggleCamera = useCallback(() => {
    if (isScreenSharing) return
    const nextCameraOff = !isCameraOff
    localStreamRef.current?.getVideoTracks().forEach(track => {
      track.enabled = !nextCameraOff
    })
    cameraOffRef.current = nextCameraOff
    setIsCameraOff(nextCameraOff)
    socket.emit('call-media-state', { channelId, cameraOff: nextCameraOff })
  }, [channelId, isCameraOff, isScreenSharing])

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(track => track.stop())
    screenStreamRef.current = null
    screenSharingRef.current = false
    setIsScreenSharing(false)

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null
    await replaceOutgoingVideo(cameraTrack)
    if (localStreamRef.current) setLocalPreview(localStreamRef.current)
    socket.emit('screen-share-toggle', { channelId, active: false })
  }, [channelId, replaceOutgoingVideo, setLocalPreview])

  const startScreenShare = useCallback(async () => {
    if (screenSharePermission === 'host' && !isCallHost) {
      setStatusMessage('방장만 화면 공유를 시작할 수 있습니다.')
      return
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatusMessage('이 브라우저는 화면 공유를 지원하지 않습니다.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = stream.getVideoTracks()[0]
      if (!screenTrack) return

      screenStreamRef.current = stream
      screenSharingRef.current = true
      setIsScreenSharing(true)
      setLocalPreview(stream)
      await replaceOutgoingVideo(screenTrack)
      socket.emit('screen-share-toggle', { channelId, active: true })
      screenTrack.onended = () => stopScreenShare()
    } catch (err) {
      if (err?.name !== 'NotAllowedError') console.error('[통화] 화면 공유 시작 실패', err)
      setStatusMessage('화면 공유를 시작하지 못했습니다.')
    }
  }, [channelId, isCallHost, replaceOutgoingVideo, screenSharePermission, setLocalPreview, stopScreenShare])

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) stopScreenShare()
    else startScreenShare()
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  const getAnnotationPoint = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }, [])

  const startAnnotation = useCallback((event) => {
    if (!annotationTool) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const point = getAnnotationPoint(event)
    annotationStartRef.current = point
    setDraftAnnotation({
      id: createAnnotationId(),
      type: annotationTool,
      color: '#ff4d4d',
      points: [point],
    })
  }, [annotationTool, getAnnotationPoint])

  const moveAnnotation = useCallback((event) => {
    if (!draftAnnotation || !annotationStartRef.current) return
    const point = getAnnotationPoint(event)

    setDraftAnnotation(prev => {
      if (!prev) return prev
      if (prev.type === 'pen') {
        return { ...prev, points: [...prev.points, point] }
      }
      return { ...prev, points: [annotationStartRef.current, point] }
    })
  }, [draftAnnotation, getAnnotationPoint])

  const finishAnnotation = useCallback((event) => {
    if (!draftAnnotation) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)

    const nextAnnotation = draftAnnotation.type === 'pen' && draftAnnotation.points.length < 2
      ? { ...draftAnnotation, points: [...draftAnnotation.points, getAnnotationPoint(event)] }
      : draftAnnotation

    setAnnotations(prev => [...prev, nextAnnotation])
    setDraftAnnotation(null)
    annotationStartRef.current = null
    socket.emit('call-annotation', { channelId, annotation: nextAnnotation })
  }, [channelId, draftAnnotation, getAnnotationPoint])

  const clearAnnotations = useCallback(() => {
    setAnnotations([])
    setDraftAnnotation(null)
    socket.emit('call-annotation', { channelId, clear: true })
  }, [channelId])

  const updateCallSettings = useCallback((patch) => {
    if (!isCallHost) {
      setStatusMessage('방장만 통화 설정을 변경할 수 있습니다.')
      return
    }
    socket.emit('call-settings-update', {
      channelId,
      ...patch,
    })
  }, [channelId, isCallHost])

  const updateAnnotationPermission = useCallback((nextPermission) => {
    if (!isCallHost) {
      updateCallSettings({ annotationPermission: nextPermission })
      return
    }
    setAnnotationPermission(nextPermission)
    updateCallSettings({ annotationPermission: nextPermission })
  }, [isCallHost, updateCallSettings])

  const updateScreenSharePermission = useCallback((nextPermission) => {
    if (!isCallHost) {
      updateCallSettings({ screenSharePermission: nextPermission })
      return
    }
    setScreenSharePermission(nextPermission)
    updateCallSettings({ screenSharePermission: nextPermission })
  }, [isCallHost, updateCallSettings])

  const updateRecordingPermission = useCallback((nextPermission) => {
    if (!isCallHost) {
      updateCallSettings({ recordingPermission: nextPermission })
      return
    }
    setRecordingPermission(nextPermission)
    updateCallSettings({ recordingPermission: nextPermission })
  }, [isCallHost, updateCallSettings])

  const delegateHost = useCallback((nextHostId) => {
    if (!isCallHost) {
      updateCallSettings({ hostId: nextHostId })
      return
    }
    setCallHostId(nextHostId)
    updateCallSettings({ hostId: nextHostId })
  }, [isCallHost, updateCallSettings])

  const getRecordingStream = useCallback(async () => {
    const stream = new MediaStream()
    const currentRemoteScreenSharer = peers.find(peer => remoteScreenShares[peer.id])
    const videoSource = screenSharingRef.current
      ? screenStreamRef.current
      : currentRemoteScreenSharer?.stream ?? localStreamRef.current

    const videoTrack = videoSource?.getVideoTracks().find(track => track.readyState === 'live')
    if (videoTrack) stream.addTrack(videoTrack)

    if (!videoTrack) {
      const fallbackVideo = await navigator.mediaDevices?.getDisplayMedia?.({ video: true, audio: false })
      const fallbackTrack = fallbackVideo?.getVideoTracks()[0]
      if (fallbackTrack) stream.addTrack(fallbackTrack)
    }

    const audioTracks = [
      ...(localStreamRef.current?.getAudioTracks() ?? []),
      ...peers.flatMap(peer => peer.stream?.getAudioTracks?.() ?? []),
    ]
    audioTracks
      .filter(track => track.readyState === 'live')
      .forEach(track => stream.addTrack(track))

    return stream
  }, [peers, remoteScreenShares])

  const uploadRecording = useCallback(async (blob) => {
    const fileName = `통화녹화-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`
    const file = new File([blob], fileName, { type: 'video/webm' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('content', '통화 녹화 파일입니다.')

    await api.post(`/api/channels/${channelId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }, [channelId])

  const confirmUploadRecording = useCallback(async () => {
    if (!pendingRecording || isUploadingRecording) return

    setIsUploadingRecording(true)
    setRecordingStatus('녹화 업로드 중')
    try {
      await uploadRecording(pendingRecording.blob)
      setPendingRecording(null)
      setRecordingStatus('녹화 파일을 채팅방에 올렸습니다.')
    } catch (err) {
      console.error('[통화] 녹화 업로드 실패', err)
      setRecordingStatus('녹화 업로드에 실패했습니다.')
    } finally {
      setIsUploadingRecording(false)
    }
  }, [isUploadingRecording, pendingRecording, uploadRecording])

  const discardRecording = useCallback(() => {
    setPendingRecording(null)
    setRecordingStatus('녹화 파일을 버렸습니다.')
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }, [])

  const startRecording = useCallback(async () => {
    if (recordingPermission === 'host' && !isCallHost) {
      setRecordingStatus('방장만 녹화할 수 있습니다.')
      return
    }

    if (!window.MediaRecorder) {
      setRecordingStatus('이 브라우저는 녹화를 지원하지 않습니다.')
      return
    }

    let stream
    try {
      stream = await getRecordingStream()
    } catch (err) {
      if (err?.name !== 'NotAllowedError') console.error('[통화] 녹화 화면 선택 실패', err)
      setRecordingStatus('녹화할 화면을 선택하지 않았습니다.')
      return
    }

    if (stream.getTracks().length === 0) {
      setRecordingStatus('녹화할 미디어가 없습니다.')
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    let recorder
    try {
      recorder = new MediaRecorder(stream, { mimeType })
    } catch {
      recorder = new MediaRecorder(stream)
    }

    recordingChunksRef.current = []
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data)
    }

    recorder.onstop = async () => {
      setIsRecording(false)
      const ownedTracks = [
        ...(localStreamRef.current?.getTracks() ?? []),
        ...(screenStreamRef.current?.getTracks() ?? []),
        ...peers.flatMap(peer => peer.stream?.getTracks?.() ?? []),
      ]
      stream.getTracks().forEach(track => {
        if (!ownedTracks.includes(track)) {
          track.stop()
        }
      })

      const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' })
      recordingChunksRef.current = []
      mediaRecorderRef.current = null

      if (blob.size === 0) {
        setRecordingStatus('녹화 파일이 비어 있습니다.')
        return
      }

      setPendingRecording({ blob, size: blob.size })
      setRecordingStatus('녹화가 완료되었습니다.')
    }

    recorder.start(1000)
    setIsRecording(true)
    setPendingRecording(null)
    setRecordingStatus('녹화 중')
  }, [getRecordingStream, isCallHost, recordingPermission])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  const participantCount = peers.length + 1
  const gridCount = Math.min(participantCount, 6)
  const remoteScreenSharer = useMemo(
    () => peers.find(peer => remoteScreenShares[peer.id]),
    [peers, remoteScreenShares]
  )
  const hasActiveScreenShare = Boolean(remoteScreenSharer || isScreenSharing)
  const canAnnotate = annotationPermission === 'all' ||
    (annotationPermission === 'host' && isCallHost) ||
    (annotationPermission === 'screen' && isScreenSharing)
  const canScreenShare = screenSharePermission === 'all' || isCallHost
  const canRecord = recordingPermission === 'all' || isCallHost
  const annotationPermissionLabel = {
    all: '모두 가능',
    host: '방장만',
    screen: '화면 공유자만',
  }[annotationPermission] ?? '모두 가능'
  const screenSharePermissionLabel = {
    all: '모두 가능',
    host: '방장만',
  }[screenSharePermission] ?? '모두 가능'
  const recordingPermissionLabel = {
    all: '모두 가능',
    host: '방장만',
  }[recordingPermission] ?? '방장만'
  const participantNames = useMemo(
    () => [currentUser?.name ?? '나', ...peers.map(peer => peer.name)].filter(Boolean),
    [currentUser?.name, peers]
  )
  const participantRows = useMemo(() => ([
    {
      id: currentUser?.id ?? 'me',
      name: currentUser?.name ?? '나',
      isMe: true,
      isHost: isCallHost,
      muted: isMuted,
      cameraOff: isCameraOff,
      screenSharing: isScreenSharing,
    },
    ...peers.map(peer => ({
      id: peer.id,
      name: peer.name,
      isMe: false,
      isHost: String(peer.id) === String(callHostId),
      muted: Boolean(peer.mediaState?.muted),
      cameraOff: Boolean(peer.mediaState?.cameraOff),
      screenSharing: Boolean(remoteScreenShares[peer.id]),
      connectionState: peer.connectionState ?? 'new',
      peer,
    })),
  ]), [callHostId, currentUser?.id, currentUser?.name, isCallHost, isCameraOff, isMuted, isScreenSharing, peers, remoteScreenShares])
  const actionItems = useMemo(() => splitMemoLines(actionMemo), [actionMemo])
  const hasMeetingWork = Boolean(meetingMemo.trim() || decisionMemo.trim() || actionItems.length)

  const buildMeetingSummary = useCallback(() => {
    const notes = splitMemoLines(meetingMemo)
    const decisions = splitMemoLines(decisionMemo)
    const lines = [
      '📌 통화 요약',
      `채널: ${channelName}`,
      `참여자: ${participantNames.join(', ')}`,
      `통화 시간: ${formatCallDuration(callStartedAtRef.current)}`,
    ]

    if (notes.length) {
      lines.push('', '메모')
      notes.forEach(item => lines.push(`- ${item}`))
    }

    if (decisions.length) {
      lines.push('', '결정사항')
      decisions.forEach(item => lines.push(`- ${item}`))
    }

    if (actionItems.length) {
      lines.push('', '후속 작업')
      actionItems.forEach(item => lines.push(`- ${item}`))
    }

    return lines.join('\n')
  }, [actionItems, channelName, decisionMemo, meetingMemo, participantNames])

  const saveMeetingSummary = useCallback(async () => {
    if (!hasMeetingWork || isSavingSummary) return

    setIsSavingSummary(true)
    try {
      socket.emit('send-message', {
        channelId,
        content: buildMeetingSummary(),
      })

      if (actionItems.length > 0) {
        await api.post(`/api/channels/${channelId}/todos`, {
          title: `통화 후속 작업 - ${new Date().toLocaleDateString('ko-KR')}`,
          items: actionItems,
        })
      }

      setSummarySaved(true)
      setStatusMessage('통화 요약을 저장했습니다.')
    } catch (err) {
      console.error('[통화] 요약 저장 실패', err)
      setStatusMessage('통화 요약 저장에 실패했습니다.')
    } finally {
      setIsSavingSummary(false)
    }
  }, [actionItems, buildMeetingSummary, channelId, hasMeetingWork, isSavingSummary])

  const finalizeLeave = useCallback(async () => {
    if (hasMeetingWork && !summarySaved) {
      await saveMeetingSummary()
    }
    onClose()
  }, [hasMeetingWork, onClose, saveMeetingSummary, summarySaved])

  const handleLeave = useCallback(() => {
    setIsEndReviewOpen(true)
  }, [])

  return (
    <div className={styles.overlay}>
      <section className={styles.modal} aria-label="실시간 통화">
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <strong>{channelName}</strong>
            <span>{participantCount}명 참여 중 · {statusMessage}</span>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${isCallHost ? styles.hostBadge : ''}`}>
              {isCallHost ? '방장' : '참여자'}
            </span>
            {remoteScreenSharer && <span className={styles.badge}>{remoteScreenSharer.name} 화면 공유 중</span>}
            {isScreenSharing && <span className={styles.badge}>내 화면 공유 중</span>}
            {isRecording && <span className={`${styles.badge} ${styles.recordingBadge}`}>녹화 중</span>}
            {!isRecording && recordingStatus && <span className={styles.badge}>{recordingStatus}</span>}
          </div>
        </header>

        <div className={styles.callBody}>
          <div className={styles.stage}>
            {muteRequest && (
              <div className={styles.muteRequestPrompt}>
                <div>
                  <strong>{muteRequest.fromName}님이 음소거를 요청했습니다.</strong>
                  <span>마이크를 끄면 배경 소음이 줄어듭니다.</span>
                </div>
                <div className={styles.muteRequestActions}>
                  <button type="button" onClick={dismissMuteRequest}>나중에</button>
                  <button type="button" onClick={acceptMuteRequest}>음소거</button>
                </div>
              </div>
            )}

            {pendingRecording && (
              <div className={styles.recordingPrompt}>
                <div>
                  <strong>녹화가 완료되었습니다.</strong>
                  <span>채팅창에 녹화본을 업로드할까요?</span>
                </div>
                <div className={styles.recordingPromptActions}>
                  <button type="button" onClick={discardRecording} disabled={isUploadingRecording}>
                    버리기
                  </button>
                  <button type="button" onClick={confirmUploadRecording} disabled={isUploadingRecording}>
                    {isUploadingRecording ? '업로드 중' : '업로드'}
                  </button>
                </div>
              </div>
            )}

            {hasActiveScreenShare && (
              <div className={styles.screenStage}>
                {remoteScreenSharer ? (
                  <PeerVideo
                    peer={remoteScreenSharer}
                    mediaState={remoteScreenSharer.mediaState}
                    isScreenSharing
                    onReconnect={reconnectPeer}
                  />
                ) : (
                  <div className={`${styles.videoCell} ${styles.screenCell}`}>
                    <video ref={screenPreviewRef} className={styles.cellVideo} autoPlay playsInline muted />
                    <MediaBadges muted={isMuted} cameraOff={isCameraOff} screenSharing={isScreenSharing} />
                    <div className={styles.cellName}>{currentUser?.name ?? '나'}</div>
                  </div>
                )}
                <AnnotationLayer
                  tool={annotationTool}
                  readOnly={!canAnnotate}
                  annotations={annotations}
                  draftAnnotation={draftAnnotation}
                  onPointerDown={canAnnotate ? startAnnotation : undefined}
                  onPointerMove={canAnnotate ? moveAnnotation : undefined}
                  onPointerUp={canAnnotate ? finishAnnotation : undefined}
                  onPointerCancel={() => {
                    setDraftAnnotation(null)
                    annotationStartRef.current = null
                  }}
                />
                {canAnnotate ? (
                  <AnnotationToolbar
                    activeTool={annotationTool}
                    onChangeTool={setAnnotationTool}
                    onClear={clearAnnotations}
                  />
                ) : (
                  <div className={styles.annotationLock}>
                    주석 권한: {annotationPermissionLabel}
                  </div>
                )}
              </div>
            )}

            <div className={styles.videoGrid} data-count={String(gridCount)} data-has-screen={hasActiveScreenShare ? 'true' : 'false'}>
              <div className={styles.videoCell}>
                <video ref={localVideoRef} className={styles.cellVideo} autoPlay playsInline muted />
                {(isCameraOff && !isScreenSharing) && (
                  <div className={styles.placeholder}>{currentUser?.name?.[0] ?? '나'}</div>
                )}
                <MediaBadges muted={isMuted} cameraOff={isCameraOff} screenSharing={isScreenSharing} />
                <div className={styles.cellName}>
                  {currentUser?.name ?? '나'}
                </div>
              </div>

              {peers
                .filter(peer => peer.id !== remoteScreenSharer?.id)
                .map(peer => (
                  <PeerVideo
                    key={peer.id}
                    peer={peer}
                    mediaState={peer.mediaState}
                    isScreenSharing={Boolean(remoteScreenShares[peer.id])}
                    onReconnect={reconnectPeer}
                  />
                ))}
            </div>
          </div>

          {isWorkPanelOpen && (
            <aside className={styles.workPanel}>
              <div className={styles.workPanelHeader}>
                <strong>회의 기록</strong>
                <span>{summarySaved ? '저장됨' : '저장 전'}</span>
              </div>

              <label className={styles.workField}>
                <span>메모</span>
                <textarea
                  value={meetingMemo}
                  onChange={e => {
                    setMeetingMemo(e.target.value)
                    setSummarySaved(false)
                  }}
                  placeholder="논의한 내용을 줄 단위로 적어주세요."
                />
              </label>

              <label className={styles.workField}>
                <span>결정사항</span>
                <textarea
                  value={decisionMemo}
                  onChange={e => {
                    setDecisionMemo(e.target.value)
                    setSummarySaved(false)
                  }}
                  placeholder="확정된 범위, 일정, 금액 등을 적어주세요."
                />
              </label>

              <label className={styles.workField}>
                <span>후속 작업</span>
                <textarea
                  value={actionMemo}
                  onChange={e => {
                    setActionMemo(e.target.value)
                    setSummarySaved(false)
                  }}
                  placeholder="할 일로 만들 항목을 줄 단위로 적어주세요."
                />
              </label>

              <button
                type="button"
                className={styles.saveSummaryBtn}
                onClick={saveMeetingSummary}
                disabled={!hasMeetingWork || isSavingSummary}
              >
                {isSavingSummary ? '저장 중' : '요약 저장'}
              </button>
            </aside>
          )}

          {isParticipantPanelOpen && (
            <aside className={styles.participantPanel}>
              <div className={styles.workPanelHeader}>
                <strong>참여자</strong>
                <span>{participantRows.length}명</span>
              </div>

              <div className={styles.participantList}>
                {participantRows.map(participant => (
                  <div key={participant.id} className={styles.participantItem}>
                    <div className={styles.participantMeta}>
                      <strong>{participant.name}</strong>
                      <span>
                        {participant.isHost ? '방장' : '참여자'}
                        {participant.isMe ? ' · 나' : ''}
                      </span>
                    </div>
                    <div className={styles.participantStates}>
                      {participant.muted && <span title="음소거">🔇</span>}
                      {participant.cameraOff && <span title="카메라 꺼짐">📷</span>}
                      {participant.screenSharing && <span title="화면 공유 중">🖥️</span>}
                      {!participant.isMe && <span>{connectionLabel[participant.connectionState] ?? participant.connectionState}</span>}
                      {!participant.muted && !participant.cameraOff && !participant.screenSharing && <span>정상</span>}
                    </div>
                    {isCallHost && !participant.isMe && (
                      <button
                        type="button"
                        className={styles.muteRequestBtn}
                        onClick={() => requestPeerMute(participant.peer)}
                        disabled={participant.muted}
                      >
                        음소거 요청
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          )}

          {isSettingsPanelOpen && (
            <aside className={styles.settingsPanel}>
              <div className={styles.workPanelHeader}>
                <strong>통화 설정</strong>
                <span>{isCallHost ? '방장 권한' : '읽기 전용'}</span>
              </div>

              <div className={styles.settingGroup}>
                <div className={styles.settingTitle}>
                  <strong>화면 주석 권한</strong>
                  <span>{annotationPermissionLabel}</span>
                </div>
                <div className={styles.segmented}>
                  {[
                    { id: 'all', label: '모두' },
                    { id: 'host', label: '방장만' },
                    { id: 'screen', label: '공유자만' },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      className={annotationPermission === option.id ? styles.segmentedActive : ''}
                      onClick={() => updateAnnotationPermission(option.id)}
                      disabled={!isCallHost}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.settingGroup}>
                <div className={styles.settingTitle}>
                  <strong>화면 공유 권한</strong>
                  <span>{screenSharePermissionLabel}</span>
                </div>
                <div className={styles.segmented} data-count="2">
                  {[
                    { id: 'all', label: '모두' },
                    { id: 'host', label: '방장만' },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      className={screenSharePermission === option.id ? styles.segmentedActive : ''}
                      onClick={() => updateScreenSharePermission(option.id)}
                      disabled={!isCallHost}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.settingGroup}>
                <div className={styles.settingTitle}>
                  <strong>녹화 권한</strong>
                  <span>{recordingPermissionLabel}</span>
                </div>
                <div className={styles.segmented} data-count="2">
                  {[
                    { id: 'host', label: '방장만' },
                    { id: 'all', label: '모두' },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      className={recordingPermission === option.id ? styles.segmentedActive : ''}
                      onClick={() => updateRecordingPermission(option.id)}
                      disabled={!isCallHost}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.settingGroup}>
                <div className={styles.settingTitle}>
                  <strong>방장 위임</strong>
                  <span>{participantRows.find(participant => participant.isHost)?.name ?? '방장'}</span>
                </div>
                <div className={styles.hostDelegateList}>
                  {participantRows.map(participant => (
                    <button
                      key={participant.id}
                      type="button"
                      className={participant.isHost ? styles.hostDelegateActive : ''}
                      onClick={() => delegateHost(participant.id)}
                      disabled={!isCallHost || participant.isHost}
                    >
                      {participant.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.settingHint}>
                권한 변경은 현재 통화 참여자에게 실시간으로 반영됩니다.
              </div>
            </aside>
          )}
        </div>

        {isEndReviewOpen && (
          <div className={styles.endReview}>
            <div className={styles.endReviewPanel}>
              <div className={styles.endReviewHeader}>
                <strong>통화 종료 전 확인</strong>
                <span>{formatCallDuration(callStartedAtRef.current)}</span>
              </div>

              <div className={styles.endReviewGrid}>
                <div>
                  <span>참여자</span>
                  <strong>{participantRows.length}명</strong>
                </div>
                <div>
                  <span>회의 기록</span>
                  <strong>{hasMeetingWork ? (summarySaved ? '저장됨' : '저장 전') : '없음'}</strong>
                </div>
                <div>
                  <span>후속 작업</span>
                  <strong>{actionItems.length}개</strong>
                </div>
                <div>
                  <span>녹화본</span>
                  <strong>{pendingRecording ? '업로드 대기' : '없음'}</strong>
                </div>
              </div>

              <div className={styles.endReviewActions}>
                {hasMeetingWork && !summarySaved && (
                  <button type="button" onClick={saveMeetingSummary} disabled={isSavingSummary}>
                    {isSavingSummary ? '저장 중' : '요약 저장'}
                  </button>
                )}
                {pendingRecording && (
                  <>
                    <button type="button" onClick={discardRecording} disabled={isUploadingRecording}>
                      녹화 버리기
                    </button>
                    <button type="button" onClick={confirmUploadRecording} disabled={isUploadingRecording}>
                      {isUploadingRecording ? '업로드 중' : '녹화 업로드'}
                    </button>
                  </>
                )}
              </div>

              <div className={styles.endReviewFooter}>
                <button type="button" onClick={() => setIsEndReviewOpen(false)}>계속 통화</button>
                <button type="button" onClick={finalizeLeave}>종료</button>
              </div>
            </div>
          </div>
        )}

        <footer className={styles.controls}>
          <button type="button" className={`${styles.controlBtn} ${isMuted ? styles.controlActive : ''}`} onClick={toggleMute}>
            {isMuted ? '마이크 꺼짐' : '마이크'}
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${isCameraOff ? styles.controlActive : ''}`}
            onClick={toggleCamera}
            disabled={isScreenSharing}
          >
            {isCameraOff ? '카메라 꺼짐' : '카메라'}
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${isScreenSharing ? styles.controlActive : ''}`}
            onClick={toggleScreenShare}
            disabled={!canScreenShare && !isScreenSharing}
            title={canScreenShare ? '화면 공유' : '방장만 화면 공유를 시작할 수 있습니다.'}
          >
            {isScreenSharing ? '공유 중지' : '화면 공유'}
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${isRecording ? styles.recordingActive : ''}`}
            onClick={toggleRecording}
            disabled={!canRecord && !isRecording}
            title={canRecord ? '녹화' : '방장만 녹화할 수 있습니다.'}
          >
            {isRecording ? '녹화 중지' : '녹화'}
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${isParticipantPanelOpen ? styles.controlActive : ''}`}
            onClick={() => {
              setIsParticipantPanelOpen(prev => !prev)
              setIsWorkPanelOpen(false)
              setIsSettingsPanelOpen(false)
            }}
          >
            참여자
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${isSettingsPanelOpen ? styles.controlActive : ''}`}
            onClick={() => {
              setIsSettingsPanelOpen(prev => !prev)
              setIsParticipantPanelOpen(false)
              setIsWorkPanelOpen(false)
            }}
          >
            설정
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${isWorkPanelOpen ? styles.controlActive : ''}`}
            onClick={() => {
              setIsWorkPanelOpen(prev => !prev)
              setIsParticipantPanelOpen(false)
              setIsSettingsPanelOpen(false)
            }}
          >
            회의 기록
          </button>
          <button type="button" className={styles.endBtn} onClick={handleLeave}>
            나가기
          </button>
        </footer>
      </section>
    </div>
  )
}

function PeerVideo({ peer, mediaState, isScreenSharing = false, onReconnect }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = peer.stream
  }, [peer.stream])

  const hasVideo = peer.stream?.getVideoTracks().some(track => track.readyState === 'live')
  const connectionState = peer.connectionState ?? 'new'
  const needsReconnect = ['failed', 'disconnected', 'closed'].includes(connectionState)

  return (
    <div className={`${styles.videoCell} ${isScreenSharing ? styles.screenCell : ''}`}>
      <video ref={videoRef} className={styles.cellVideo} autoPlay playsInline />
      {!hasVideo && <div className={styles.placeholder}>{peer.name?.[0] ?? '?'}</div>}
      <MediaBadges
        muted={mediaState?.muted}
        cameraOff={mediaState?.cameraOff}
        screenSharing={isScreenSharing}
      />
      <div className={styles.cellName}>
        {peer.name}
      </div>
      <div className={`${styles.connectionBadge} ${needsReconnect ? styles.connectionWarning : ''}`}>
        {connectionLabel[connectionState] ?? connectionState}
      </div>
      {needsReconnect && (
        <button
          type="button"
          className={styles.reconnectBtn}
          onClick={() => onReconnect?.(peer.id, peer.name)}
        >
          다시 연결
        </button>
      )}
    </div>
  )
}

function MediaBadges({ muted, cameraOff, screenSharing }) {
  if (!muted && !cameraOff && !screenSharing) return null

  return (
    <div className={styles.mediaBadges}>
      {muted && <span className={styles.mediaBadge} title="음소거">🔇</span>}
      {cameraOff && <span className={styles.mediaBadge} title="카메라 꺼짐">📷</span>}
      {screenSharing && <span className={styles.mediaBadge} title="화면 공유 중">🖥️</span>}
    </div>
  )
}

function AnnotationToolbar({ activeTool, onChangeTool, onClear }) {
  const tools = [
    { id: 'pen', label: '펜' },
    { id: 'box', label: '박스' },
    { id: 'arrow', label: '화살표' },
  ]

  return (
    <div className={styles.annotationToolbar}>
      {tools.map(tool => (
        <button
          key={tool.id}
          type="button"
          className={`${styles.annotationBtn} ${activeTool === tool.id ? styles.annotationBtnActive : ''}`}
          onClick={() => onChangeTool(tool.id)}
        >
          {tool.label}
        </button>
      ))}
      <button type="button" className={styles.annotationBtn} onClick={onClear}>
        지우기
      </button>
    </div>
  )
}

function AnnotationLayer({
  tool,
  readOnly = false,
  annotations,
  draftAnnotation,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  const visibleAnnotations = draftAnnotation ? [...annotations, draftAnnotation] : annotations

  return (
    <svg
      className={styles.annotationLayer}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      data-tool={tool}
      data-readonly={readOnly ? 'true' : 'false'}
    >
      <defs>
        <marker id="annotationArrow" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 14 7 L 0 14 z" fill="#ff4d4d" />
        </marker>
      </defs>
      {visibleAnnotations.map(annotation => (
        <AnnotationShape key={annotation.id} annotation={annotation} />
      ))}
    </svg>
  )
}

function AnnotationShape({ annotation }) {
  const points = annotation.points ?? []
  const color = annotation.color ?? '#ff4d4d'
  if (points.length === 0) return null
  const toSvgPoint = (point) => ({ x: point.x * 1000, y: point.y * 1000 })

  if (annotation.type === 'pen') {
    const d = points
      .map((point, index) => {
        const svgPoint = toSvgPoint(point)
        return `${index === 0 ? 'M' : 'L'} ${svgPoint.x} ${svgPoint.y}`
      })
      .join(' ')
    return <path d={d} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  }

  const [rawStart, rawEnd = rawStart] = points
  const start = toSvgPoint(rawStart)
  const end = toSvgPoint(rawEnd)
  if (annotation.type === 'box') {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    return <rect x={x} y={y} width={width} height={height} fill="none" stroke={color} strokeWidth="5" />
  }

  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      markerEnd="url(#annotationArrow)"
    />
  )
}
