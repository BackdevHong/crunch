import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import socket from '../lib/socket'
import styles from './ChatPanel.module.css'
import MeetingModal from './MeetingModal'
import TodoModal from './TodoModal'
import TodoPanel from './TodoPanel'

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

function getMessageSearchText(msg) {
  return [
    msg.deletedAt ? null : msg.content,
    msg.fileName,
    msg.sender?.name,
    msg.replyTo?.content,
    msg.replyTo?.fileName,
    msg.replyTo?.sender?.name,
    msg.meeting?.title,
    msg.messageType,
  ].filter(Boolean).join(' ').toLowerCase()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getMessageFilterType(msg) {
  if (msg.deletedAt) return 'system'
  if (msg.fileUrl) return 'file'
  if (msg.messageType === 'MEETING') return 'meeting'
  if (msg.messageType === 'SYSTEM') return 'system'
  if (msg.content?.includes('통화 요약') || msg.content?.includes('후속 작업')) return 'work'
  return 'text'
}

function getMemberUser(member) {
  return member?.user ?? member
}

function mentionsUser(content, userName) {
  if (!content || !userName) return false
  return new RegExp(`(^|\\s)@${escapeRegExp(userName)}(?=\\s|$|[,.!?])`).test(content)
}

function getMessagePreview(msg) {
  if (msg.deletedAt) return '삭제된 메시지'
  if (msg.content) return msg.content
  if (msg.meeting?.title) return `회의: ${msg.meeting.title}`
  if (msg.fileName) return `파일: ${msg.fileName}`
  return '메시지'
}

function getReplyPreview(msg) {
  const preview = getMessagePreview(msg)
  return preview.length > 80 ? `${preview.slice(0, 80)}...` : preview
}

const REACTION_EMOJIS = ['👍', '✅', '👀', '❤️', '🙏', '🔧']

function getFileUrl(fileUrl) {
  const backendBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
  return `${backendBase}${fileUrl}`
}

function FileAttachment({ msg, onOpenImage }) {
  const { fileUrl, fileName, fileType, fileSize, content } = msg
  if (!fileUrl) return null

  const src = getFileUrl(fileUrl)

  if (fileType?.startsWith('image/')) {
    return (
      <div className={styles.fileAttachment}>
        <button type="button" className={styles.imagePreviewButton} onClick={() => onOpenImage(msg.id)}>
          <img src={src} alt={fileName} className={styles.attachedImage} />
        </button>
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

  if (fileType === 'application/pdf') {
    return (
      <div className={`${styles.fileAttachment} ${styles.filePreviewCard}`}>
        <object data={src} type="application/pdf" className={styles.pdfPreview}>
          <a href={src} target="_blank" rel="noopener noreferrer">PDF 열기</a>
        </object>
        {content && <div className={`${styles.msgBubble} ${styles.fileCaption}`}>{content}</div>}
        <div className={styles.filePreviewFooter}>
          <span>{fileName}</span>
          <a href={src} target="_blank" rel="noopener noreferrer">새 창</a>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.fileAttachment} ${styles.fileDoc}`}>
      <a href={src} download={fileName} target="_blank" rel="noopener noreferrer" className={styles.fileDocLink}>
        <span className={styles.fileDocIcon}>📎</span>
        <span className={styles.fileDocBody}>
          <span className={styles.fileDocName}>{fileName}</span>
          <span className={styles.fileDocHint}>클릭해서 열기</span>
        </span>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [messageFilter, setMessageFilter] = useState('all')
  const [replyTarget, setReplyTarget] = useState(null)
  const [readStates, setReadStates] = useState([])
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionStart, setMentionStart] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editInput, setEditInput] = useState('')
  const [imageViewerMessageId, setImageViewerMessageId] = useState(null)
  const [meetingModalOpen, setMeetingModalOpen] = useState(false)
  const [todoModalOpen, setTodoModalOpen] = useState(false)
  const [todoLists, setTodoLists] = useState([])
  const messagesEndRef = useRef(null)
  const prevChannelRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageInputRef = useRef(null)
  const dragCounterRef = useRef(0)
  const plusMenuRef = useRef(null)

  const channelMembers = useMemo(
    () => (activeChannel?.members ?? []).map(getMemberUser).filter(Boolean),
    [activeChannel?.members]
  )

  const imageMessages = useMemo(
    () => messages.filter(msg => !msg.deletedAt && msg.fileUrl && msg.fileType?.startsWith('image/')),
    [messages]
  )

  const imageViewerIndex = imageMessages.findIndex(msg => msg.id === imageViewerMessageId)
  const imageViewerMessage = imageViewerIndex >= 0 ? imageMessages[imageViewerIndex] : null

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
    setTodoLists([])
    setReplyTarget(null)
    setEditingMessage(null)
    setEditInput('')
    Promise.all([
      api.get(`/api/channels/${activeChannel.id}/messages`),
      api.get(`/api/channels/${activeChannel.id}/todos`),
    ])
      .then(([msgRes, todoRes]) => {
        const messagePayload = msgRes.data.data
        setMessages(Array.isArray(messagePayload) ? messagePayload : messagePayload.messages)
        setReadStates(Array.isArray(messagePayload) ? [] : messagePayload.readStates ?? [])
        setChannels(prev => prev.map(ch =>
          ch.id === activeChannel.id ? { ...ch, unreadCount: 0, mentionUnreadCount: 0 } : ch
        ))
        setTodoLists(todoRes.data.data)
      })
      .catch(console.error)
      .finally(() => setLoadingMsg(false))
  }, [activeChannel?.id])

  useEffect(() => {
    const handler = (msg) => {
      if (msg.channelId === activeChannel?.id) {
        setMessages(prev => [...prev, msg])
        socket.emit('channel-read', { channelId: msg.channelId })
      } else {
        setChannels(prev => prev.map(ch =>
          ch.id === msg.channelId
            ? {
                ...ch,
                messages: [msg],
                unreadCount: (ch.unreadCount ?? 0) + 1,
                mentionUnreadCount: mentionsUser(msg.content, currentUser?.name)
                  ? (ch.mentionUnreadCount ?? 0) + 1
                  : (ch.mentionUnreadCount ?? 0),
              }
            : ch
        ))
      }
    }
    socket.on('new-message', handler)
    return () => socket.off('new-message', handler)
  }, [activeChannel?.id, currentUser?.name])

  useEffect(() => {
    const handler = ({ channelId, message }) => {
      if (channelId === activeChannel?.id) {
        setMessages(prev => prev.map(msg => msg.id === message.id ? message : msg))
      }
      setChannels(prev => prev.map(ch =>
        ch.id === channelId
          ? { ...ch, messages: ch.messages?.[0]?.id === message.id ? [message] : ch.messages }
          : ch
      ))
    }
    socket.on('message-pin-updated', handler)
    return () => socket.off('message-pin-updated', handler)
  }, [activeChannel?.id])

  useEffect(() => {
    const handler = ({ channelId, message }) => {
      if (channelId === activeChannel?.id) {
        setMessages(prev => prev.map(msg => msg.id === message.id ? message : msg))
      }
      setChannels(prev => prev.map(ch =>
        ch.id === channelId
          ? { ...ch, messages: ch.messages?.[0]?.id === message.id ? [message] : ch.messages }
          : ch
      ))
    }
    socket.on('message-updated', handler)
    socket.on('message-deleted', handler)
    socket.on('message-reaction-updated', handler)
    return () => {
      socket.off('message-updated', handler)
      socket.off('message-deleted', handler)
      socket.off('message-reaction-updated', handler)
    }
  }, [activeChannel?.id])

  useEffect(() => {
    const handler = ({ channelId, userId, lastReadAt }) => {
      if (channelId === activeChannel?.id) {
        setReadStates(prev => {
          const exists = prev.some(item => item.userId === userId)
          if (exists) {
            return prev.map(item => item.userId === userId ? { ...item, lastReadAt } : item)
          }
          return [...prev, { userId, lastReadAt }]
        })
      }

      if (userId === currentUser?.id) {
        setChannels(prev => prev.map(ch =>
          ch.id === channelId ? { ...ch, unreadCount: 0, mentionUnreadCount: 0, lastReadAt } : ch
        ))
      }
    }
    socket.on('channel-read-updated', handler)
    return () => socket.off('channel-read-updated', handler)
  }, [activeChannel?.id, currentUser?.id])

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

  // 투두 실시간 업데이트
  useEffect(() => {
    const onCreated = (list) => setTodoLists(prev => [...prev, list])
    const onDeleted = ({ todoListId }) =>
      setTodoLists(prev => prev.filter(l => l.id !== todoListId))
    const onItemToggled = ({ todoListId, item }) =>
      setTodoLists(prev => prev.map(l =>
        l.id !== todoListId ? l
          : { ...l, items: l.items.map(i => i.id === item.id ? item : i) }
      ))

    socket.on('todo-created', onCreated)
    socket.on('todo-deleted', onDeleted)
    socket.on('todo-item-toggled', onItemToggled)
    return () => {
      socket.off('todo-created', onCreated)
      socket.off('todo-deleted', onDeleted)
      socket.off('todo-item-toggled', onItemToggled)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, messageFilter, searchQuery])

  useEffect(() => {
    if (!activeChannel || messages.length === 0) return
    socket.emit('channel-read', { channelId: activeChannel.id })
  }, [activeChannel?.id, messages.length])

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return messages.filter(msg => {
      const type = getMessageFilterType(msg)
      const matchesFilter = messageFilter === 'all'
        || type === messageFilter
        || (messageFilter === 'mention' && mentionsUser(msg.content, currentUser?.name))
      const matchesSearch = !query || getMessageSearchText(msg).includes(query)
      return matchesFilter && matchesSearch
    })
  }, [currentUser?.name, messageFilter, messages, searchQuery])

  const filterCounts = useMemo(() => {
    const base = { all: messages.length, file: 0, meeting: 0, work: 0, system: 0, mention: 0 }
    messages.forEach(msg => {
      const type = getMessageFilterType(msg)
      if (base[type] !== undefined) base[type] += 1
      if (mentionsUser(msg.content, currentUser?.name)) base.mention += 1
    })
    return base
  }, [currentUser?.name, messages])

  const pinnedMessages = useMemo(
    () => messages
      .filter(msg => msg.isPinned)
      .sort((a, b) => new Date(b.pinnedAt ?? b.createdAt) - new Date(a.pinnedAt ?? a.createdAt)),
    [messages]
  )

  const channelMemberCount = activeChannel?.members?.length ?? 1

  const getReadCount = useCallback((msg) => {
    if (!msg?.createdAt) return 0
    const createdAt = new Date(msg.createdAt).getTime()
    return readStates.filter(state =>
      state.userId !== currentUser?.id
      && state.lastReadAt
      && new Date(state.lastReadAt).getTime() >= createdAt
    ).length
  }, [currentUser?.id, readStates])

  const renderMessageText = useCallback((content) => {
    if (!content) return null
    const mentionNames = channelMembers.map(user => user.name).filter(Boolean)
    if (mentionNames.length === 0) return content

    const mentionPattern = new RegExp(`@(${mentionNames.map(escapeRegExp).join('|')})(?=\\s|$|[,.!?])`, 'g')
    const parts = []
    let lastIndex = 0
    let match
    while ((match = mentionPattern.exec(content)) !== null) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index))
      const isMe = match[1] === currentUser?.name
      parts.push(
        <span key={`${match.index}-${match[0]}`} className={`${styles.mentionText} ${isMe ? styles.mentionMe : ''}`}>
          {match[0]}
        </span>
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex))
    return parts
  }, [channelMembers, currentUser?.name])

  const togglePinMessage = useCallback(async (msg) => {
    if (!activeChannel) return
    try {
      const { data } = await api.patch(`/api/channels/${activeChannel.id}/messages/${msg.id}/pin`, {
        pinned: !msg.isPinned,
      })
      setMessages(prev => prev.map(item => item.id === msg.id ? data.data : item))
    } catch (err) {
      console.error('[togglePinMessage]', err)
      alert('메시지 고정 상태를 변경하지 못했습니다.')
    }
  }, [activeChannel])

  const startEditMessage = useCallback((msg) => {
    setEditingMessage(msg)
    setEditInput(msg.content ?? '')
  }, [])

  const cancelEditMessage = useCallback(() => {
    setEditingMessage(null)
    setEditInput('')
  }, [])

  const submitEditMessage = useCallback(async () => {
    if (!activeChannel || !editingMessage || !editInput.trim()) return
    try {
      const { data } = await api.patch(`/api/channels/${activeChannel.id}/messages/${editingMessage.id}`, {
        content: editInput.trim(),
      })
      setMessages(prev => prev.map(msg => msg.id === editingMessage.id ? data.data : msg))
      cancelEditMessage()
    } catch (err) {
      console.error('[submitEditMessage]', err)
      alert('메시지를 수정하지 못했습니다.')
    }
  }, [activeChannel, cancelEditMessage, editInput, editingMessage])

  const deleteMessage = useCallback(async (msg) => {
    if (!activeChannel) return
    if (!window.confirm('메시지를 삭제할까요?')) return
    try {
      const { data } = await api.delete(`/api/channels/${activeChannel.id}/messages/${msg.id}`)
      setMessages(prev => prev.map(item => item.id === msg.id ? data.data : item))
    } catch (err) {
      console.error('[deleteMessage]', err)
      alert('메시지를 삭제하지 못했습니다.')
    }
  }, [activeChannel])

  const toggleReaction = useCallback(async (msg, emoji) => {
    if (!activeChannel || msg.deletedAt) return
    try {
      const { data } = await api.post(`/api/channels/${activeChannel.id}/messages/${msg.id}/reactions`, { emoji })
      setMessages(prev => prev.map(item => item.id === msg.id ? data.data : item))
    } catch (err) {
      console.error('[toggleReaction]', err)
      alert('반응을 처리하지 못했습니다.')
    }
  }, [activeChannel])

  const scrollToMessage = useCallback((messageId) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const startReply = useCallback((msg) => {
    setReplyTarget(msg)
    requestAnimationFrame(() => messageInputRef.current?.focus())
  }, [])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const query = mentionQuery.toLowerCase()
    return channelMembers
      .filter(user => user.id !== currentUser?.id && user.name?.toLowerCase().includes(query))
      .slice(0, 5)
  }, [channelMembers, currentUser?.id, mentionQuery])

  const updateMentionQuery = useCallback((value, cursor) => {
    const beforeCursor = value.slice(0, cursor)
    const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/)
    if (!match) {
      setMentionQuery(null)
      setMentionStart(null)
      return
    }
    setMentionQuery(match[2])
    setMentionStart(cursor - match[2].length - 1)
  }, [])

  const handleInputChange = useCallback((e) => {
    const value = e.target.value
    setInput(value)
    updateMentionQuery(value, e.target.selectionStart ?? value.length)
  }, [updateMentionQuery])

  const insertMention = useCallback((user) => {
    if (mentionStart === null) return
    const inputEl = messageInputRef.current
    const cursor = inputEl?.selectionStart ?? input.length
    const nextInput = `${input.slice(0, mentionStart)}@${user.name} ${input.slice(cursor)}`
    const nextCursor = mentionStart + user.name.length + 2
    setInput(nextInput)
    setMentionQuery(null)
    setMentionStart(null)
    requestAnimationFrame(() => {
      messageInputRef.current?.focus()
      messageInputRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }, [input, mentionStart])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !activeChannel) return
    socket.emit('send-message', {
      channelId: activeChannel.id,
      content: input.trim(),
      replyToId: replyTarget?.id ?? null,
    })
    setInput('')
    setReplyTarget(null)
    setMentionQuery(null)
    setMentionStart(null)
  }, [input, activeChannel, replyTarget])

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditMessage()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitEditMessage()
    }
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Tab' || e.key === 'Enter') && mentionSuggestions.length > 0) {
      e.preventDefault()
      insertMention(mentionSuggestions[0])
      return
    }
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
      if (replyTarget?.id) {
        formData.append('replyToId', replyTarget.id)
      }
      await api.post(`/api/channels/${activeChannel.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReplyTarget(null)
    } catch (err) {
      console.error('[uploadFile]', err)
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }, [activeChannel, input, replyTarget])

  const uploadFiles = useCallback(async (files) => {
    const fileList = Array.from(files ?? [])
    if (!activeChannel || fileList.length === 0) return
    setUploading(true)
    try {
      for (const [index, file] of fileList.entries()) {
        const formData = new FormData()
        formData.append('file', file)
        if (index === 0 && input.trim()) formData.append('content', input.trim())
        if (index === 0 && replyTarget?.id) formData.append('replyToId', replyTarget.id)
        await api.post(`/api/channels/${activeChannel.id}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      setInput('')
      setReplyTarget(null)
    } catch (err) {
      console.error('[uploadFiles]', err)
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }, [activeChannel, input, replyTarget])

  const handleFileChange = (e) => {
    if (e.target.files?.length) uploadFiles(e.target.files)
    e.target.value = ''
  }

  const submitTodo = useCallback(async ({ title, items }) => {
    if (!activeChannel) return
    await api.post(`/api/channels/${activeChannel.id}/todos`, { title, items })
  }, [activeChannel])

  const deleteTodo = useCallback(async (todoListId) => {
    if (!window.confirm('투두 리스트를 삭제할까요?')) return
    try {
      await api.delete(`/api/todos/${todoListId}`)
    } catch (err) {
      console.error('[deleteTodo]', err)
    }
  }, [])

  const toggleTodoItem = useCallback(async (itemId) => {
    try {
      await api.patch(`/api/todos/items/${itemId}/toggle`)
    } catch (err) {
      console.error('[toggleTodoItem]', err)
    }
  }, [])

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
    {
      id: 'todo',
      icon: '📋',
      label: '투두 리스트',
      description: '할 일 목록을 만들어 채팅방에 고정',
      action: () => {
        setPlusMenuOpen(false)
        setTodoModalOpen(true)
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
    const files = e.dataTransfer.files
    if (files?.length) uploadFiles(files)
  }

  const moveImageViewer = useCallback((direction) => {
    if (imageViewerIndex < 0 || imageMessages.length === 0) return
    const nextIndex = (imageViewerIndex + direction + imageMessages.length) % imageMessages.length
    setImageViewerMessageId(imageMessages[nextIndex].id)
  }, [imageMessages, imageViewerIndex])

  if (!currentUser) return null

  return (
    <>
    {imageViewerMessage && (
      <div className={styles.imageViewerBackdrop} onClick={() => setImageViewerMessageId(null)}>
        <div className={styles.imageViewer} onClick={e => e.stopPropagation()}>
          <div className={styles.imageViewerHeader}>
            <div>
              <strong>{imageViewerMessage.fileName}</strong>
              <span>{imageViewerIndex + 1} / {imageMessages.length}</span>
            </div>
            <div className={styles.imageViewerActions}>
              <a href={getFileUrl(imageViewerMessage.fileUrl)} download={imageViewerMessage.fileName} target="_blank" rel="noopener noreferrer">다운로드</a>
              <button type="button" onClick={() => setImageViewerMessageId(null)}>닫기</button>
            </div>
          </div>
          <div className={styles.imageViewerBody}>
            <button type="button" className={styles.imageViewerNav} onClick={() => moveImageViewer(-1)} disabled={imageMessages.length <= 1}>‹</button>
            <img src={getFileUrl(imageViewerMessage.fileUrl)} alt={imageViewerMessage.fileName} />
            <button type="button" className={styles.imageViewerNav} onClick={() => moveImageViewer(1)} disabled={imageMessages.length <= 1}>›</button>
          </div>
        </div>
      </div>
    )}
    {meetingModalOpen && (
      <MeetingModal
        onClose={() => setMeetingModalOpen(false)}
        onSubmit={submitMeeting}
      />
    )}
    {todoModalOpen && (
      <TodoModal
        onClose={() => setTodoModalOpen(false)}
        onSubmit={submitTodo}
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
              <div className={styles.channelTopLine}>
                <div className={styles.channelName}>{ch.project?.title ?? ch.name}</div>
                {(ch.mentionUnreadCount ?? 0) > 0 && (
                  <span className={styles.mentionBadge}>@</span>
                )}
                {(ch.unreadCount ?? 0) > 0 && (
                  <span className={styles.unreadBadge}>{ch.unreadCount > 99 ? '99+' : ch.unreadCount}</span>
                )}
              </div>
              {ch.messages?.[0] && (
                <div className={styles.channelPreview}>
                  {ch.messages[0].sender?.name}: {getMessagePreview(ch.messages[0])}
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
                  const channelAuthorId = activeChannel.project?.authorId
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
                        onClick={() => onStartCall({ channelId: activeChannel.id, channelName, channelAuthorId })}
                      >
                        📞 통화 참여 · {participants.length}명
                      </button>
                    )
                  }
                  return (
                    <button
                      className={styles.callBtn}
                      onClick={() => onStartCall({ channelId: activeChannel.id, channelName, channelAuthorId })}
                    >
                      📞 통화 시작
                    </button>
                  )
                })()}
              </div>
            </div>

            <TodoPanel
              todoLists={todoLists}
              currentUserId={currentUser.id}
              channelAuthorId={activeChannel.project?.authorId}
              onToggleItem={toggleTodoItem}
              onDelete={deleteTodo}
            />

            {pinnedMessages.length > 0 && (
              <div className={styles.pinnedBar}>
                <div className={styles.pinnedHeader}>
                  <strong>고정 메시지</strong>
                  <span>{pinnedMessages.length}개</span>
                </div>
                <div className={styles.pinnedList}>
                  {pinnedMessages.slice(0, 3).map(msg => (
                    <button
                      key={msg.id}
                      type="button"
                      className={styles.pinnedItem}
                      onClick={() => scrollToMessage(msg.id)}
                    >
                      <span>{msg.sender?.name}</span>
                      <strong>{getMessagePreview(msg)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.messageTools}>
              <div className={styles.searchBox}>
                <span>검색</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="대화, 파일명, 회의 제목 검색"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')}>지우기</button>
                )}
              </div>
              <div className={styles.filterTabs}>
                {[
                  { id: 'all', label: '전체' },
                  { id: 'file', label: '파일' },
                  { id: 'meeting', label: '회의' },
                  { id: 'work', label: '업무' },
                  { id: 'mention', label: '멘션' },
                  { id: 'system', label: '시스템' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={messageFilter === item.id ? styles.filterTabActive : ''}
                    onClick={() => setMessageFilter(item.id)}
                  >
                    {item.label}
                    <span>{filterCounts[item.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.messages}>
              {loadingMsg ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : messages.length === 0 ? (
                <div className={styles.empty}>아직 메시지가 없습니다.</div>
              ) : filteredMessages.length === 0 ? (
                <div className={styles.empty}>조건에 맞는 메시지가 없습니다.</div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isMine = msg.senderId === currentUser.id
                  const getMinuteKey = (d) => {
                    const t = new Date(d)
                    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}-${t.getMinutes()}`
                  }
                  const nextMsg = filteredMessages[index + 1]
                  const isLastInGroup = !nextMsg
                    || nextMsg.senderId !== msg.senderId
                    || getMinuteKey(nextMsg.createdAt) !== getMinuteKey(msg.createdAt)
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                  const hasFile = !!msg.fileUrl
                  const isMeeting = msg.messageType === 'MEETING'
                  const isSystem = msg.messageType === 'SYSTEM'
                  const isDeleted = !!msg.deletedAt
                  const canEdit = isMine && !isDeleted && msg.messageType === 'TEXT' && !msg.fileUrl
                  const readCount = isMine ? getReadCount(msg) : 0
                  const readLabel = readCount > 0
                    ? (readCount >= Math.max(channelMemberCount - 1, 1) ? '읽음' : `${readCount}명 읽음`)
                    : ''

                  const reactionGroups = REACTION_EMOJIS
                    .map(emoji => {
                      const reactions = msg.reactions?.filter(reaction => reaction.emoji === emoji) ?? []
                      return { emoji, reactions, mine: reactions.some(reaction => reaction.userId === currentUser.id) }
                    })
                    .filter(group => group.reactions.length > 0)

                  if (isSystem) {
                    return (
                      <div key={msg.id} className={styles.systemMsg}>
                        <span className={styles.systemMsgText}>{msg.content}</span>
                      </div>
                    )
                  }

                  const renderContent = () => {
                    if (isDeleted) {
                      return <div className={`${styles.msgBubble} ${styles.deletedBubble}`}>삭제된 메시지입니다.</div>
                    }

                    const replyPreview = msg.replyTo ? (
                      <button
                        type="button"
                        className={styles.replyPreview}
                        onClick={() => scrollToMessage(msg.replyTo.id)}
                      >
                        <span>{msg.replyTo.sender?.name ?? '알 수 없음'}</span>
                        <strong>{getReplyPreview(msg.replyTo)}</strong>
                      </button>
                    ) : null

                    if (isMeeting) {
                      return (
                        <>
                          {replyPreview}
                          <MeetingCard msg={msg} currentUserId={currentUser.id} onRespond={respondToMeeting} />
                        </>
                      )
                    }
                    if (hasFile) {
                      return (
                        <>
                          {replyPreview}
                          <FileAttachment msg={msg} onOpenImage={setImageViewerMessageId} />
                        </>
                      )
                    }
                    if (editingMessage?.id === msg.id) {
                      return (
                        <div className={styles.editBox}>
                          <textarea
                            value={editInput}
                            onChange={e => setEditInput(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            rows={2}
                            autoFocus
                          />
                          <div className={styles.editActions}>
                            <button type="button" onClick={cancelEditMessage}>취소</button>
                            <button type="button" onClick={submitEditMessage} disabled={!editInput.trim()}>저장</button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <>
                        {replyPreview}
                        <div className={`${styles.msgBubble} ${mentionsUser(msg.content, currentUser?.name) ? styles.mentionedBubble : ''}`}>
                          {renderMessageText(msg.content)}
                        </div>
                      </>
                    )
                  }

                  return (
                    <div id={`msg-${msg.id}`} key={msg.id} className={`${styles.msgRow} ${isMine ? styles.msgMine : styles.msgOther}`}>
                      {!isMine && (
                        <div className={styles.msgWithAvatar}>
                          <Avatar user={msg.sender} size={32} />
                          <div>
                            <div className={styles.msgSender}>{msg.sender?.name}</div>
                            {renderContent()}
                            {isLastInGroup && <div className={styles.msgTime}>{timeStr}</div>}
                            {!isDeleted && reactionGroups.length > 0 && (
                              <div className={styles.reactionList}>
                                {reactionGroups.map(group => (
                                  <button
                                    key={group.emoji}
                                    type="button"
                                    className={group.mine ? styles.reactionMine : ''}
                                    onClick={() => toggleReaction(msg, group.emoji)}
                                    title={group.reactions.map(reaction => reaction.user?.name).filter(Boolean).join(', ')}
                                  >
                                    {group.emoji} <span>{group.reactions.length}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {!isDeleted && (
                              <div className={styles.msgActions}>
                                {msg.isPinned && <span>고정됨</span>}
                                <button type="button" onClick={() => startReply(msg)}>답장</button>
                                {REACTION_EMOJIS.map(emoji => (
                                  <button key={emoji} type="button" onClick={() => toggleReaction(msg, emoji)}>{emoji}</button>
                                ))}
                                <button type="button" onClick={() => togglePinMessage(msg)}>
                                  {msg.isPinned ? '고정 해제' : '고정'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {isMine && (
                        <>
                          {renderContent()}
                          {isLastInGroup && (
                            <div className={styles.msgMeta}>
                              {readLabel && <span className={styles.readReceipt}>{readLabel}</span>}
                              {msg.editedAt && !isDeleted && <span>수정됨</span>}
                              <span>{timeStr}</span>
                            </div>
                          )}
                          {!isDeleted && reactionGroups.length > 0 && (
                            <div className={styles.reactionList}>
                              {reactionGroups.map(group => (
                                <button
                                  key={group.emoji}
                                  type="button"
                                  className={group.mine ? styles.reactionMine : ''}
                                  onClick={() => toggleReaction(msg, group.emoji)}
                                  title={group.reactions.map(reaction => reaction.user?.name).filter(Boolean).join(', ')}
                                >
                                  {group.emoji} <span>{group.reactions.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {!isDeleted && (
                            <div className={styles.msgActions}>
                              {msg.isPinned && <span>고정됨</span>}
                              <button type="button" onClick={() => startReply(msg)}>답장</button>
                              {REACTION_EMOJIS.map(emoji => (
                                <button key={emoji} type="button" onClick={() => toggleReaction(msg, emoji)}>{emoji}</button>
                              ))}
                              {canEdit && <button type="button" onClick={() => startEditMessage(msg)}>수정</button>}
                              <button type="button" onClick={() => deleteMessage(msg)}>삭제</button>
                              <button type="button" onClick={() => togglePinMessage(msg)}>
                                {msg.isPinned ? '고정 해제' : '고정'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.composerArea}>
              {replyTarget && (
                <div className={styles.replyComposer}>
                  <button
                    type="button"
                    className={styles.replyComposerBody}
                    onClick={() => scrollToMessage(replyTarget.id)}
                  >
                    <span>{replyTarget.sender?.name ?? '알 수 없음'}에게 답장</span>
                    <strong>{getReplyPreview(replyTarget)}</strong>
                  </button>
                  <button
                    type="button"
                    className={styles.replyCancelBtn}
                    onClick={() => setReplyTarget(null)}
                    aria-label="답장 취소"
                  >
                    x
                  </button>
                </div>
              )}

              {mentionSuggestions.length > 0 && (
                <div className={styles.mentionMenu}>
                  {mentionSuggestions.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => insertMention(user)}
                    >
                      <Avatar user={user} size={24} />
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              )}

            <div className={styles.inputRow}>
              <input
                type="file"
                ref={fileInputRef}
                className={styles.hiddenFileInput}
                onChange={handleFileChange}
                multiple
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
                ref={messageInputRef}
                className={styles.input}
                placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
                value={input}
                onChange={handleInputChange}
                onClick={e => updateMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                onKeyUp={e => updateMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button className={styles.sendBtn} onClick={sendMessage}>전송</button>
            </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}
