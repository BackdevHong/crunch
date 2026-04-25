import { useState } from 'react'
import api from '../lib/api'
import styles from './TodoPanel.module.css'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function TodoPanel({ todoLists, currentUserId, channelAuthorId, onToggleItem, onDelete }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedLists, setExpandedLists] = useState({})

  if (todoLists.length === 0) return null

  const totalItems = todoLists.reduce((s, l) => s + l.items.length, 0)
  const doneItems = todoLists.reduce((s, l) => s + l.items.filter(i => i.completedAt).length, 0)

  const toggleList = (id) =>
    setExpandedLists(prev => ({ ...prev, [id]: !prev[id] }))

  const isAuthor = currentUserId === channelAuthorId

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <button className={styles.header} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.headerIcon}>📋</span>
        <span className={styles.headerTitle}>할 일 목록</span>
        <span className={styles.headerProgress}>{doneItems}/{totalItems}</span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: totalItems ? `${(doneItems / totalItems) * 100}%` : '0%' }}
          />
        </div>
        <span className={styles.collapseIcon}>{collapsed ? '▼' : '▲'}</span>
      </button>

      {/* 투두 리스트 목록 */}
      {!collapsed && (
        <div className={styles.body}>
          {todoLists.map(list => {
            const listDone = list.items.filter(i => i.completedAt).length
            const isExpanded = expandedLists[list.id] !== false // 기본 펼침

            return (
              <div key={list.id} className={styles.todoList}>
                {/* 리스트 헤더 */}
                <div className={styles.listHeader}>
                  <button className={styles.listToggle} onClick={() => toggleList(list.id)}>
                    <span className={styles.listChevron}>{isExpanded ? '▾' : '▸'}</span>
                    <span className={styles.listTitle}>{list.title}</span>
                    <span className={styles.listCount}>{listDone}/{list.items.length}</span>
                  </button>
                  {isAuthor && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => onDelete(list.id)}
                      title="삭제"
                    >
                      🗑
                    </button>
                  )}
                </div>

                {/* 아이템 목록 */}
                {isExpanded && (
                  <ul className={styles.itemList}>
                    {list.items.map(item => (
                      <li key={item.id} className={`${styles.item} ${item.completedAt ? styles.itemDone : ''}`}>
                        <label className={styles.checkLabel}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={!!item.completedAt}
                            onChange={() => onToggleItem(item.id)}
                          />
                          <span className={styles.itemText}>{item.text}</span>
                        </label>
                        {item.completedAt && (
                          <span className={styles.completedMeta}>
                            {item.completedBy?.name} · {formatDate(item.completedAt)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
