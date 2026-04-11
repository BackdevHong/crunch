import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const ROLE_LABEL = { client: '의뢰인', freelancer: '프리랜서', admin: '어드민' }
const ROLE_COLOR = { client: '#185FA5', freelancer: '#3B6D11', admin: '#854F0B' }
const ROLE_BG    = { client: '#E6F1FB', freelancer: '#EAF3DE', admin: '#FAEEDA' }

export default function AdminUsers({ activePage, onNavigate }) {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/admin/users', {
        params: {
          role: roleFilter === 'ALL' ? undefined : roleFilter,
          q: query || undefined,
          page, limit: 20,
        },
      })
      setUsers(data.data.users)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [roleFilter, query, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleRoleChange = async (userId, newRole) => {
    if (!confirm(`역할을 ${ROLE_LABEL[newRole]}(으)로 변경하시겠습니까?`)) return
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role: newRole })
      showToast('✅ 역할 변경 완료!')
      fetchUsers()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '오류 발생'))
    }
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>유저 관리</h1>
          <span className={styles.badge}>{total}명</span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {['ALL', 'client', 'freelancer', 'admin'].map(r => (
              <button key={r}
                className={`${styles.tab} ${roleFilter === r ? styles.tabActive : ''}`}
                onClick={() => { setRoleFilter(r); setPage(1) }}>
                {r === 'ALL' ? '전체' : ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <input className={styles.searchInput} placeholder="이름 또는 이메일 검색"
            value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
        </div>

        {loading ? <div className={styles.empty}>불러오는 중...</div>
        : users.length === 0 ? <div className={styles.empty}>유저가 없습니다.</div>
        : (
          <div className={styles.table}>
            <div className={styles.thead} style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr' }}>
              <span>이름</span><span>이메일</span><span>역할</span><span>가입일</span><span>역할 변경</span>
            </div>
            {users.map(user => (
              <div key={user.id} className={styles.trow} style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr' }}>
                <span className={styles.name}>{user.name}</span>
                <span className={styles.sub}>{user.email}</span>
                <span>
                  <span className={styles.statusBadge}
                    style={{ background: ROLE_BG[user.role], color: ROLE_COLOR[user.role] }}>
                    {ROLE_LABEL[user.role]}
                  </span>
                </span>
                <span className={styles.sub}>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
                <span>
                  <select className={styles.roleSelect}
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}>
                    <option value="client">의뢰인</option>
                    <option value="freelancer">프리랜서</option>
                    <option value="admin">어드민</option>
                  </select>
                </span>
              </div>
            ))}
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
      {toast && <div className={styles.toast}>{toast}</div>}
    </AdminLayout>
  )
}