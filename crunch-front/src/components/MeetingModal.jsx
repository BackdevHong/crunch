import { useState } from 'react'
import styles from './MeetingModal.module.css'

export default function MeetingModal({ onClose, onSubmit }) {
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('10:00')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !date || !time) return
    setLoading(true)
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      await onSubmit({ title: title.trim(), scheduledAt })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>📅</span>
          <h2 className={styles.title}>회의 일정 제안</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>회의 제목</label>
            <input
              className={styles.input}
              type="text"
              placeholder="예: 주간 진행상황 공유 회의"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>날짜</label>
              <input
                className={styles.input}
                type="date"
                value={date}
                min={today}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>시간</label>
              <input
                className={styles.input}
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.preview}>
            <span className={styles.previewLabel}>예정 일시</span>
            <span className={styles.previewValue}>
              {date && time
                ? new Date(`${date}T${time}:00`).toLocaleString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    weekday: 'short', hour: '2-digit', minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>취소</button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!title.trim() || loading}
            >
              {loading ? '전송 중...' : '일정 제안하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
