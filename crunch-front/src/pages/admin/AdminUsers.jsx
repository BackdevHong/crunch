import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const ROLE_LABEL = { client: '의뢰인', freelancer: '프리랜서', admin: '어드민' }
const ROLE_COLOR = { client: 'var(--color-info)', freelancer: 'var(--color-success)', admin: 'var(--color-warning)' }
const ROLE_BG    = { client: 'var(--color-hero-blue)', freelancer: 'var(--color-success-bg)', admin: 'var(--color-warning-bg)' }
const STATUS_LABEL = {
  PENDING: '대기중',
  APPROVED: '승인',
  REJECTED: '거절',
  OPEN: '모집중',
  IN_PROGRESS: '진행중',
  DONE: '완료',
  CANCELLED: '취소',
  REVIEW: '검수중',
}
const CATEGORY_LABEL = {
  DEV: '개발·IT', DESIGN: '디자인', MARKETING: '마케팅',
  WRITING: '글쓰기·번역', VIDEO: '영상·사진', MUSIC: '음악·오디오',
}

export default function AdminUsers({ activePage, onNavigate }) {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
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

  const openUserDetail = async (userId) => {
    setSelected(null)
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/api/admin/users/${userId}`)
      setSelected(data.data)
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '유저 상세를 불러오지 못했습니다.'))
    } finally {
      setDetailLoading(false)
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
            <div className={styles.thead} style={{ gridTemplateColumns: '1.6fr 2fr 1fr 1fr 1fr 0.7fr' }}>
              <span>이름</span><span>이메일</span><span>역할</span><span>가입일</span><span>역할 변경</span><span></span>
            </div>
            {users.map(user => (
              <div key={user.id} className={styles.trow} style={{ gridTemplateColumns: '1.6fr 2fr 1fr 1fr 1fr 0.7fr' }}>
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
                <span>
                  <button className={styles.detailBtn} onClick={() => openUserDetail(user.id)}>
                    상세
                  </button>
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
      {detailLoading && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalBody}>
              <div className={styles.empty}>유저 상세를 불러오는 중...</div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <UserDetailModal
          detail={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {toast && <div className={styles.toast}>{toast}</div>}
    </AdminLayout>
  )
}

function UserDetailModal({ detail, onClose }) {
  const { user, recent } = detail
  const counts = user._count

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.wideModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{user.name} 상세</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.infoGrid}>
            <InfoItem label="이메일" value={user.email} />
            <InfoItem label="역할" value={ROLE_LABEL[user.role] ?? user.role} />
            <InfoItem label="가입일" value={new Date(user.createdAt).toLocaleDateString('ko-KR')} />
            <InfoItem label="채널 참여" value={`${counts.channelMemberships}개`} />
          </div>

          <div className={styles.statGrid}>
            <InfoItem label="등록 서비스" value={`${counts.services}개`} />
            <InfoItem label="등록 프로젝트" value={`${counts.projects}개`} />
            <InfoItem label="구매 주문" value={`${counts.buyerOrders}건`} />
            <InfoItem label="판매 주문" value={`${counts.sellerOrders}건`} />
          </div>

          {user.freelancer && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>프리랜서 프로필</div>
              <div className={styles.infoGrid}>
                <InfoItem label="직책" value={user.freelancer.role} />
                <InfoItem label="분야" value={CATEGORY_LABEL[user.freelancer.category] ?? user.freelancer.category} />
                <InfoItem label="경력" value={user.freelancer.experience ?? '-'} />
                <InfoItem label="시간당 단가" value={`${user.freelancer.hourlyRate.toLocaleString()}원`} />
                <InfoItem label="평점" value={Number(user.freelancer.rating).toFixed(1)} />
                <InfoItem label="완료 작업" value={`${user.freelancer.completedJobs}건`} />
              </div>
              {user.freelancer.skills?.length > 0 && (
                <div className={styles.tags}>
                  {user.freelancer.skills.map(({ skill }) => <span key={skill} className={styles.tag}>{skill}</span>)}
                </div>
              )}
            </div>
          )}

          {user.application && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>프리랜서 신청</div>
              <div className={styles.infoGrid}>
                <InfoItem label="상태" value={STATUS_LABEL[user.application.status] ?? user.application.status} />
                <InfoItem label="분야" value={CATEGORY_LABEL[user.application.category] ?? user.application.category} />
                <InfoItem label="경력" value={user.application.experience} />
                <InfoItem label="신청 단가" value={`${user.application.hourlyRate.toLocaleString()}원`} />
              </div>
              {user.application.rejectedReason && (
                <div className={styles.rejectNote}>
                  <div className={styles.sectionLabel}>거절 사유</div>
                  <p>{user.application.rejectedReason}</p>
                </div>
              )}
            </div>
          )}

          <RecentList title="최근 서비스" items={recent.services}
            render={item => `${item.title} · ${item.price.toLocaleString()}원 · ${item.isActive ? '활성' : '비활성'}`} />
          <RecentList title="최근 프로젝트" items={recent.projects}
            render={item => `${item.title} · ${STATUS_LABEL[item.status] ?? item.status}`} />
          <RecentList title="최근 주문" items={recent.orders}
            render={item => `${item.service?.title ?? '서비스 없음'} · ${item.amount.toLocaleString()}원 · ${STATUS_LABEL[item.status] ?? item.status}`} />
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className={styles.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RecentList({ title, items, render }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{title}</div>
      {items.length === 0 ? (
        <p className={styles.sectionText}>내역이 없습니다.</p>
      ) : (
        <div className={styles.compactList}>
          {items.map(item => (
            <div key={item.id} className={styles.compactItem}>
              <span>{render(item)}</span>
              <small>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
