import { useState } from 'react'
import styles from './TodoModal.module.css'

export default function TodoModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([''])
  const [loading, setLoading] = useState(false)

  const updateItem = (idx, value) => {
    setItems(prev => prev.map((v, i) => (i === idx ? value : v)))
  }

  const addItem = () => setItems(prev => [...prev, ''])

  const removeItem = (idx) => {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (idx === items.length - 1) addItem()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validItems = items.map(t => t.trim()).filter(Boolean)
    if (!title.trim() || validItems.length === 0) return
    setLoading(true)
    try {
      await onSubmit({ title: title.trim(), items: validItems })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>📋</span>
          <h2 className={styles.title}>투두 리스트 만들기</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>리스트 제목</label>
            <input
              className={styles.input}
              type="text"
              placeholder="예: 1차 스프린트 할 일"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>할 일 항목 (Enter로 추가)</label>
            <div className={styles.itemList}>
              {items.map((item, idx) => (
                <div key={idx} className={styles.itemRow}>
                  <span className={styles.itemDot} />
                  <input
                    className={styles.itemInput}
                    type="text"
                    placeholder={`항목 ${idx + 1}`}
                    value={item}
                    onChange={e => updateItem(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx)}
                  />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className={styles.addItemBtn} onClick={addItem}>
                + 항목 추가
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>취소</button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!title.trim() || items.every(i => !i.trim()) || loading}
            >
              {loading ? '생성 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
