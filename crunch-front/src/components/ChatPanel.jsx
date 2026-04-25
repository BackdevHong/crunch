import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import socket from '../lib/socket'
import styles from './ChatPanel.module.css'
import MeetingModal from './MeetingModal'

const AVATAR_COLORS = [
  ['#FFF0E8', '#C04A1A'], ['#E6F1FB', '#185FA5'], ['#EAF3DE', '#3B6D11'],
  ['#FAEEDA', '#854F0B'], ['#FBEAF0', '#993556'], ['#E1F5EE', '#0F6E56'],
]
function getAvatarColor(name = '') {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function Avatar({ user, size = 36 }) {
  const [bg, color] = getAvatarColor(user?.name)
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '0.5px solid var(--color-border)',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 500,
    }}>
      {user?.name?.[0] ?? '?'}
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileAttachment({ msg }) {
  const { fileUrl, fileName, fileType, fileSize, content } = msg
  if (!fileUrl) return null

  const backendBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
  const src = `${backendBase}${fileUrl}`

  if (fileType?.startsWith('image/')) {
    return (
      <div className={styles.fileAttachment}>
        <a href={src} target="_blank" rel="noopener noreferrer">
          <img src={src} alt={fileName} className={styles.attachedImage} />
        </a>
        {content && <div className={`${styles.msgBubble} ${styles.fileCaption}`}>{content}</div>}
        <div className={styles.fileMeta}>{fileName} · {formatBytes(fileSize)}</div>
      </div>
    )
  }

  if (fileType?.startsWith('video/')) {
    return (
      <div className={styles.fileAttachment}>
        <video src={src} controls className={styles.attachedVideo} />
        {content && <div className={`${styles.msgBubble} ${styles.fileCaption}`}>{content}</div>}
        <div className={styles.fileMeta}>{fileName} · {formatBytes(fileSize)}</div>
      </div>
    )
  }

  return (
    <div className={`${styles.fileAttachment} ${styles.fileDoc}`}>
      <a href={src} download={fileName} target="_blank" rel="noopener noreferrer" className={styles.fileDocLink}>
        <span className={styles.fileDocIcon}>📎</span>
        <span className={styles.fileDocName}>{fileName}</span>
        <span className={styles.fileDocSize}>{formatBytes(fileSize)}</span>
      </a>
      {content && <div className={`${styles.msgBubble} ${styles.fileCaption}`}>{content}</div>}
    </div>
  )
}

function MeetingCard({ msg, currentUserId, onRespond }) {
  const { meeting } = msg
  if (!meeting) return null

  const isProposer = meeting.proposerId === currentUserId
  const myResponse = meeting.responses.find(r => r.userId === currentUserId)
  const accepted = meeting.responses.filter(r => r.response === 'ACCEPTED')
  const rejected = meeting.responses.filter(r => r.response === 'REJECTED')

  const scheduledAt = new Date(meeting.scheduledAt)
  const dateStr = scheduledAt.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
  const timeStr = scheduledAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={styles.meetingCard}>
      <div className={styles.meetingCardHeader}>
        <span className={styles.meetingCardBadge}>📅 회의 일정 제안</span>
      </div>
      <div className={styles.meetingTitle}>{meeting.title}</div>
      <div className={styles.meetingTime}>
        <span className={styles.meetingTimeDate}>{dateStr}</span>
        <span className={styles.meetingTimeHour}>{timeStr}</span>
      </div>

      {!isProposer && (
        <div className={styles.meetingActions}>
          <button
            className={`${styles.meetingBtn} ${styles.meetingBtnAccept} ${myResponse?.response === 'ACCEPTED' ? styles.meetingBtnActive : ''}`}
            onClick={() => onRespond(meeting.id, 'ACCEPTED')}
          >
            ✓ 승인
          </button>
          <button
            className={`${styles.meetingBtn} ${styles.meetingBtnReject} ${myResponse?.response === 'REJECTED' ? styles.meetingBtnActive : ''}`}
            onClick={() => onRespond(meeting.id, 'REJECTED')}
          >
            ✕ 거부
          </button>
        </div>
      )}

      <div className={styles.meetingStats}>
        <span className={styles.meetingStatAccept}>✓ {accepted.length}명 승인</span>
        <span className={styles.meetingStatReject}>✕ {rejected.length}명 거부</span>
        {meeting.responses.length === 0 && (
          <span className={styles.meetingStatPending}>아직 응답 없음</span>
        )}
      </div>

      {meeting.responses.length > 0 && (
        <div className={styles.meetingResponseList}>
          {meeting.responses.map(r => (
            <span
              key={r.userId}
              className={`${styles.meetingResponseChip} ${r.response === 'ACCEPTED' ? styles.chipAccepted : styles.chipRejected}`}
            >
              {r.user.name} {r.response === 'ACCEPTED' ? '✓' : '✕'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatPanel({ onStartCall, activeCallChannelId }) {
  const { currentUser } = useApp()
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [callStatuses, setCallStatuses] = useState({})
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const prevChannelRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragCounterRef = useRef(0)
  const plusMenuRef = useRef(null)

  useEffect(() => {
    api.get('/api/channels')
      .then(({ data }) => {
        setChannels(data.data)
        if (data.data.length > 0 && !activeChannel) {
          setActiveChannel(data.data[0])
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!activeChannel) return

    if (prevChannelRef.current) {
      socket.emit('leave-channel', prevChannelRef.current.id)
    }
    prevChannelRef.current = activeChannel
    socket.emit('join-channel', activeChannel.id)

    setLoadingMsg(true)
    api.get(`/api/channels/${activeChannel.id}/messages`)
      .then(({ data }) => setMessages(data.data))
      .catch(console.error)
      .finally(() => setLoadingMsg(false))
  }, [activeChannel?.id])

  useEffect(() => {
    const handler = (msg) => {
      if (msg.channelId === activeChannel?.id) {
        setMessages(prev => [...prev, msg])
      } else {
        setChannels(prev => prev.map(ch =>
          ch.id === msg.channelId ? { ...ch, messages: [msg] } : ch
        ))
      }
    }
    socket.on('new-message', handler)
    return () => socket.off('new-message', handler)
  }, [activeChannel?.id])

  useEffect(() => {
    const onCallStatus = ({ channelId, participants }) => {
      setCallStatuses(prev => ({ ...prev, [channelId]: participants }))
    }
    socket.on('call-status', onCallStatus)
    return () => socket.off('call-status', onCallStatus)
  }, [])

  // 회의 응답 실시간 업데이트
  useEffect(() => {
    const handler = ({ messageId, meeting }) => {
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, meeting } : msg
      ))
    }
    socket.on('meeting-updated', handler)
    return () => socket.off('meeting-updated', handler)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !activeChannel) return
    socket.emit('send-message', { channelId: activeChannel.id, content: input.trim() })
    setInput('')
  }, [input, activeChannel])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const uploadFile = useCallback(async (file) => {
    if (!activeChannel || !file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (input.trim()) {
        formData.append('content', input.trim())
        setInput('')
      }
      await api.post(`/api/channels/${activeChannel.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    } catch (err) {
      console.error('[uploadFile]', err)
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }, [activeChannel, input])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const submitMeeting = useCallback(async ({ title, scheduledAt }) => {
    if (!activeChannel) return
    await api.post(`/api/channels/${activeChannel.id}/meetings`, { title, scheduledAt })
  }, [activeChannel])

  const respondToMeeting = useCallback(async (meetingId, response) => {
    try {
      await api.post(`/api/meetings/${meetingId}/respond`, { response })
    } catch (err) {
      console.error('[respondToMeeting]', err)
    }
  }, [])

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!plusMenuOpen) return
    const handler = (e) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plusMenuOpen])

  // + 메뉴 항목 배열 — 항목 추가 시 여기에만 추가
  const plusMenuItems = [
    {
      id: 'file',
      icon: '📎',
      label: '파일 첨부',
      description: '사진, 동영상, 문서 등',
      action: () => {
        setPlusMenuOpen(false)
        fileInputRef.current?.click()
      },
    },
    {
      id: 'meeting',
      icon: '📅',
      label: '회의 일정 제안',
      description: '날짜와 시간을 정해 멤버에게 제안',
      action: () => {
        setPlusMenuOpen(false)
        setMeetingModalOpen(true)
      },
    },
    // 추후 추가 예정
    // { id: 'settlement', icon: '💰', label: '정산', description: '비용 정산 요청', action: () => {} },
  ]

  const handleDragEnter = (e) => {
    e.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  if (!currentUser) return null

  return (
    <>
    {meetingModalOpen && (
      <MeetingModal
        onClose={() => setMeetingModalOpen(false)}
        onSubmit={submitMeeting}
      />
    )}
    <div className={styles.panel}>
      {/* 채널 사이드바 */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>채널</div>
        {channels.length === 0 ? (
          <div className={styles.noChannels}>수락된 프로젝트가<br />없습니다</div>
        ) : (
          channels.map(ch => (
            <div
              key={ch.id}
              className={`${styles.channelItem} ${activeChannel?.id === ch.id ? styles.channelActive : ''}`}
              onClick={() => setActiveChannel(ch)}
            >
              <div className={styles.channelName}>{ch.project?.title ?? ch.name}</div>
              {ch.messages?.[0] && (
                <div className={styles.channelPreview}>
                  {ch.messages[0].sender?.name}: {ch.messages[0].content ?? (ch.messages[0].fileName ? `📎 ${ch.messages[0].fileName}` : '')}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 메시지 영역 */}
      <div
        className={`${styles.main} ${isDragging ? styles.dragging : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className={styles.dropOverlay}>
            <div className={styles.dropOverlayInner}>
              <span className={styles.dropIcon}>📂</span>
              <span>파일을 여기에 놓으세요</span>
            </div>
          </div>
        )}

        {!activeChannel ? (
          <div className={styles.empty}>채널을 선택하세요</div>
        ) : (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.chatTitle}>{activeChannel.project?.title ?? activeChannel.name}</div>
              <div className={styles.chatActions}>
                {(() => {
                  const channelName = activeChannel.project?.title ?? activeChannel.name
                  const participants = callStatuses[activeChannel.id] ?? []
                  const isCallActive = participants.length > 0
                  const isInThisCall = activeCallChannelId === activeChannel.id
                  if (isInThisCall) {
                    return <div className={styles.callActiveBadge}>📞 통화 중</div>
                  }
                  if (isCallActive) {
                    return (
                      <button
                        className={styles.callJoinBtn}
                        onClick={() => onStartCall({ channelId: activeChannel.id, channelName })}
                      >
                        📞 통화 참여 · {participants.length}명
                      </button>
                    )
                  }
                  return (
                    <button
                      className={styles.callBtn}
                      onClick={() => onStartCall({ channelId: activeChannel.id, channelName })}
                    >
                      📞 통화 시작
                    </button>
                  )
                })()}
              </div>
            </div>

            <div className={styles.messages}>
              {loadingMsg ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : messages.length === 0 ? (
                <div className={styles.empty}>아직 메시지가 없습니다.</div>
              ) : (
                messages.map((msg, index) => {
                  const isMine = msg.senderId === currentUser.id
                  const getMinuteKey = (d) => {
                    const t = new Date(d)
                    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}-${t.getMinutes()}`
                  }
                  const nextMsg = messages[index + 1]
                  const isLastInGroup = !nextMsg
                    || nextMsg.senderId !== msg.senderId
                    || getMinuteKey(nextMsg.createdAt) !== getMinuteKey(msg.createdAt)
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                  const hasFile = !!msg.fileUrl
                  const isMeeting = msg.messageType === 'MEETING'

                  const renderContent = () => {
                    if (isMeeting) {
                      return <MeetingCard msg={msg} currentUserId={currentUser.id} onRespond={respondToMeeting} />
                    }
                    if (hasFile) {
                      return <FileAttachment msg={msg} />
                    }
                    return <div className={styles.msgBubble}>{msg.content}</div>
                  }

                  return (
                    <div key={msg.id} className={`${styles.msgRow} ${isMine ? styles.msgMine : styles.msgOther}`}>
                      {!isMine && (
                        <div className={styles.msgWithAvatar}>
                          <Avatar user={msg.sender} size={32} />
                          <div>
                            <div className={styles.msgSender}>{msg.sender?.name}</div>
                            {renderContent()}
                            {isLastInGroup && <div className={styles.msgTime}>{timeStr}</div>}
                          </div>
                        </div>
                      )}
                      {isMine && (
                        <>
                          {renderContent()}
                          {isLastInGroup && <div className={styles.msgTime}>{timeStr}</div>}
                        </>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputRow}>
              <input
                type="file"
                ref={fileInputRef}
                className={styles.hiddenFileInput}
                onChange={handleFileChange}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
              />

              {/* + 드롭다운 */}
              <div className={styles.plusWrap} ref={plusMenuRef}>
                <button
                  className={`${styles.attachBtn} ${plusMenuOpen ? styles.attachBtnActive : ''}`}
                  onClick={() => setPlusMenuOpen(prev => !prev)}
                  disabled={uploading}
                  title="추가 기능"
                >
                  {uploading ? '⏳' : '+'}
                </button>
                {plusMenuOpen && (
                  <div className={styles.plusMenu}>
                    {plusMenuItems.map(item => (
                      <button
                        key={item.id}
                        className={styles.plusMenuItem}
                        onClick={item.action}
                      >
                        <span className={styles.plusMenuIcon}>{item.icon}</span>
                        <span className={styles.plusMenuText}>
                          <span className={styles.plusMenuLabel}>{item.label}</span>
                          <span className={styles.plusMenuDesc}>{item.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                className={styles.input}
                placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button className={styles.sendBtn} onClick={sendMessage}>전송</button>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}
