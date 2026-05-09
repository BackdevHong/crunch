import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const ACTION_LABEL = {
  ALL: '전체',
  USER_ROLE_UPDATED: '역할 변경',
  SERVICE_APPROVED: '서비스 승인',
  SERVICE_REJECTED: '서비스 반려',
  SERVICE_ACTIVATED: '서비스 활성화',
  SERVICE_DEACTIVATED: '서비스 비활성화',
  FREELANCER_APPLICATION_APPROVED: '프리랜서 승인',
  FREELANCER_APPLICATION_REJECTED: '프리랜서 거절',
}

const TARGET_LABEL = {
  ALL: '대상 전체',
  USER: '유저',
  SERVICE: '서비스',
  FREELANCER_APPLICATION: '프리랜서 신청',
}

const TARGET_TONE = {
  USER: ['var(--color-hero-blue)', 'var(--color-info)'],
  SERVICE: ['var(--color-success-bg)', 'var(--color-success)'],
  FREELANCER_APPLICATION: ['var(--color-warning-bg)', 'var(--color-warning)'],
}

export default function AdminAuditLogs({ activePage, onNavigate }) {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [targetFilter, setTargetFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const actions = useMemo(() => Object.keys(ACTION_LABEL), [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/admin/audit-logs', {
        params: {
          q: query || undefined,
          action: actionFilter === 'ALL' ? undefined : actionFilter,
          targetType: targetFilter === 'ALL' ? undefined : targetFilter,
          page,
          limit: 20,
        },
      })
      setLogs(data.data.logs)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [actionFilter, targetFilter, query, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>운영 로그</h1>
          <span className={styles.badge}>{total}건</span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {actions.map(action => (
              <button
                key={action}
                className={`${styles.tab} ${actionFilter === action ? styles.tabActive : ''}`}
                onClick={() => { setActionFilter(action); setPage(1) }}
              >
                {ACTION_LABEL[action]}
              </button>
            ))}
          </div>
          <div className={styles.toolbarRight}>
            <select
              className={styles.roleSelect}
              value={targetFilter}
              onChange={e => { setTargetFilter(e.target.value); setPage(1) }}
            >
              {Object.entries(TARGET_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              className={styles.searchInput}
              placeholder="메시지 또는 관리자 검색"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        {loading ? <div className={styles.empty}>불러오는 중...</div>
        : logs.length === 0 ? <div className={styles.empty}>운영 로그가 없습니다.</div>
        : (
          <div className={styles.table}>
            <div className={styles.thead} style={{ gridTemplateColumns: '1fr 1fr 3fr 1fr 1fr' }}>
              <span>액션</span><span>대상</span><span>내용</span><span>관리자</span><span>처리일</span>
            </div>
            {logs.map(log => {
              const [bg, color] = TARGET_TONE[log.targetType] ?? ['var(--color-bg-secondary)', 'var(--color-text-secondary)']
              return (
                <div key={log.id} className={styles.trow} style={{ gridTemplateColumns: '1fr 1fr 3fr 1fr 1fr' }}>
                  <span className={styles.sub}>{ACTION_LABEL[log.action] ?? log.action}</span>
                  <span>
                    <span className={styles.statusBadge} style={{ background: bg, color }}>
                      {TARGET_LABEL[log.targetType] ?? log.targetType}
                    </span>
                  </span>
                  <span>
                    <div className={styles.name}>{log.message}</div>
                    <div className={styles.sub}>{log.targetId}</div>
                  </span>
                  <span className={styles.sub}>{log.admin?.name ?? '관리자'}</span>
                  <span className={styles.sub}>{new Date(log.createdAt).toLocaleString('ko-KR')}</span>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
