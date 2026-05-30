import { useState, useEffect } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import { CATEGORY_META, SKILL_TAGS } from '../data/mockData'
import styles from './MyPage.module.css'

const EXPERIENCE_OPTIONS = ['1년 미만', '1~3년', '3~5년', '5년 이상']

const ORDER_STATUS_LABEL = {
  PENDING: '결제대기', IN_PROGRESS: '진행중',
  REVIEW: '검수중', DONE: '완료',
  CANCELLED: '취소', REFUNDED: '환불',
}
const ORDER_STATUS_COLOR = {
  PENDING: '#854F0B', IN_PROGRESS: '#185FA5',
  REVIEW: '#3B6D11', DONE: '#3B6D11',
  CANCELLED: '#6b6b67', REFUNDED: '#A32D2D',
}
const ORDER_STATUS_BG = {
  PENDING: '#FAEEDA', IN_PROGRESS: '#E6F1FB',
  REVIEW: '#EAF3DE', DONE: '#EAF3DE',
  CANCELLED: '#f1efe8', REFUNDED: '#FCEBEB',
}
const SERVICE_APPROVAL_LABEL = { PENDING: '심사중', APPROVED: '승인', REJECTED: '반려' }
const SERVICE_APPROVAL_COLOR = {
  PENDING: 'var(--color-warning)',
  APPROVED: 'var(--color-success)',
  REJECTED: 'var(--color-danger)',
}
const SERVICE_APPROVAL_BG = {
  PENDING: 'var(--color-warning-bg)',
  APPROVED: 'var(--color-success-bg)',
  REJECTED: 'var(--color-danger-bg)',
}

const TABS_CLIENT     = ['프로필', '계정 설정', '알림', '주문 내역', '내 프로젝트']
const TABS_FREELANCER = ['프로필', '계정 설정', '알림', '프리랜서 프로필', '내 서비스', '주문 내역', '판매 내역', '내 프로젝트', '내 제안']

const ROLE_LABEL = {
  client: '의뢰인',
  freelancer: '프리랜서',
  admin: '어드민',
}

const AUTH_PROVIDER_META = {
  local: { label: '이메일', className: 'providerLocal' },
  google: { label: 'Google', className: 'providerGoogle' },
  naver: { label: 'Naver', className: 'providerNaver' },
  kakao: { label: 'Kakao', className: 'providerKakao' },
}

export default function MyPage({ initialTab = '프로필', onNavigate }) {
  const { currentUser, setEditingService, setEditingProject } = useApp()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const isFreelancer = currentUser?.role === 'freelancer'
  const TABS = isFreelancer ? TABS_FREELANCER : TABS_CLIENT

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    api.get('/api/mypage/profile')
      .then(({ data }) => setProfile(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className={styles.avatarImg} referrerPolicy="no-referrer" />
              ) : (
                currentUser?.name?.[0] ?? '?'
              )}
            </div>
          </div>
          <div className={styles.heroInfo}>
            <h1>{currentUser?.name}</h1>
            <p>{currentUser?.email}</p>
            <span className={styles.roleBadge}>
              {currentUser?.role === 'freelancer' ? '프리랜서' :
               currentUser?.role === 'admin' ? '어드민' : '의뢰인'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* 탭 */}
        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className={styles.tabContent}>
          {activeTab === '프로필' && (
            <ProfileTab profile={profile} onUpdate={(updated) => { setProfile(p => ({ ...p, ...updated })); showToast('✅ 저장되었습니다!') }} />
          )}
          {activeTab === '계정 설정' && <AccountSettingsTab />}
          {activeTab === '알림' && <NotificationsTab onNavigate={onNavigate} />}
          {activeTab === '프리랜서 프로필' && isFreelancer && (
            <FreelancerProfileTab
              freelancer={profile?.freelancer}
              onUpdate={(updated) => { setProfile(p => ({ ...p, freelancer: updated })); showToast('✅ 저장되었습니다!') }}
              onNavigate={onNavigate}
            />
          )}
          {activeTab === '주문 내역' && <OrdersTab />}
          {activeTab === '내 서비스' && isFreelancer && (
            <MyServicesTab
              onNavigate={onNavigate}
              onEdit={(service) => {
                setEditingService(service)
                onNavigate('post-service')
              }}
            />
          )}
          {activeTab === '판매 내역' && isFreelancer && <SalesTab />}
          {activeTab === '내 프로젝트' && (
            <ProjectsTab
              onNavigate={onNavigate}
              onEdit={(project) => {
                setEditingProject(project)
                onNavigate('post')
              }}
            />
          )}
          {activeTab === '내 제안' && isFreelancer && <MyProposalsTab />}
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

// ── 알림 탭 ──────────────────────────────────────────────────
function NotificationsTab({ onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const unreadCount = notifications.filter(item => !item.readAt).length
  const filteredNotifications = unreadOnly
    ? notifications.filter(item => !item.readAt)
    : notifications

  const fetchNotifications = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/mypage/notifications')
      setNotifications(data.data.notifications)
    } catch (err) {
      setError(err.response?.data?.message ?? '알림을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAllRead = async () => {
    if (unreadCount === 0) return
    setSaving(true)
    setError('')
    try {
      await api.patch('/api/mypage/notifications/read')
      setNotifications(prev => prev.map(item => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })))
    } catch (err) {
      setError(err.response?.data?.message ?? '알림 읽음 처리에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.card}>
      <div className={styles.notificationTop}>
        <div>
          <div className={styles.cardTitleInline}>내 알림</div>
          <p className={styles.notificationMeta}>
            읽지 않은 알림 {unreadCount}개 · 최근 {notifications.length}개 표시
          </p>
        </div>
        <div className={styles.notificationActions}>
          <label className={styles.checkControl}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={e => setUnreadOnly(e.target.checked)}
            />
            읽지 않은 알림만
          </label>
          <button
            className={styles.proposalToggleBtn}
            onClick={markAllRead}
            disabled={saving || unreadCount === 0}
          >
            전체 읽음
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {filteredNotifications.length === 0 ? (
        <div className={styles.notificationEmpty}>
          {unreadOnly ? '읽지 않은 알림이 없습니다.' : '아직 받은 알림이 없습니다.'}
        </div>
      ) : (
        <div className={styles.notificationList}>
          {filteredNotifications.map(item => (
            <button
              key={item.id}
              className={`${styles.notificationItem} ${!item.readAt ? styles.notificationUnread : ''}`}
              onClick={() => {
                onNavigate(item.link || 'mypage-notifications')
              }}
            >
              <div className={styles.notificationDot} />
              <div className={styles.notificationBody}>
                <div className={styles.notificationTitleRow}>
                  <strong>{item.title}</strong>
                  {!item.readAt && <span className={styles.unreadPill}>새 알림</span>}
                </div>
                <p>{item.message}</p>
                <span>{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 계정 설정 탭 ─────────────────────────────────────────────
function AccountSettingsTab() {
  const { authError, setAuthError } = useApp()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectingProvider, setConnectingProvider] = useState('')

  useEffect(() => {
    let mounted = true

    api.get('/api/mypage/account')
      .then(({ data }) => {
        if (mounted) setAccount(data.data)
      })
      .catch((err) => {
        if (mounted) setError(err.response?.data?.message ?? '계정 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  const connectProvider = async (provider) => {
    setConnectingProvider(provider)
    setError('')
    setAuthError('')
    try {
      const { data } = await api.get(`/api/auth/link/${provider}`)
      window.location.assign(data.data.url)
    } catch (err) {
      setError(err.response?.data?.message ?? '계정 연결을 시작하지 못했습니다.')
      setConnectingProvider('')
    }
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  const displayError = error || authError

  if (displayError && !account) {
    return (
      <div className={styles.card}>
        <div className={styles.errorBox}>{displayError}</div>
      </div>
    )
  }

  const profile = account?.profile
  const providers = account?.auth?.providers ?? {}
  const primaryProvider = account?.auth?.primaryProvider ?? 'local'
  const primaryLabel = AUTH_PROVIDER_META[primaryProvider]?.label ?? primaryProvider

  return (
    <div className={styles.accountStack}>
      <div className={styles.card}>
        <div className={styles.accountHeader}>
          <div className={styles.accountAvatar}>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className={styles.accountAvatarImg} referrerPolicy="no-referrer" />
            ) : (
              profile?.name?.[0] ?? '?'
            )}
          </div>
          <div className={styles.accountInfo}>
            <div className={styles.cardTitleInline}>계정 설정</div>
            <p>{profile?.email}</p>
            <div className={styles.accountBadges}>
              <span>{ROLE_LABEL[profile?.role] ?? profile?.role}</span>
              <span>{primaryLabel} 로그인</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>로그인 방식</div>
        {displayError && <div className={styles.errorBox}>{displayError}</div>}
        <div className={styles.providerGrid}>
          {Object.entries(AUTH_PROVIDER_META).map(([key, meta]) => {
            const connected = Boolean(providers[key])
            const canConnect = key !== 'local' && !connected
            return (
              <div key={key} className={styles.providerItem}>
                <div className={`${styles.providerIcon} ${styles[meta.className]}`}>
                  {meta.label[0]}
                </div>
                <div className={styles.providerMeta}>
                  <strong>{meta.label}</strong>
                  <span className={connected ? styles.providerConnected : styles.providerDisconnected}>
                    {connected ? '연결됨' : '미연결'}
                  </span>
                </div>
                {canConnect && (
                  <button
                    type="button"
                    className={styles.providerAction}
                    onClick={() => connectProvider(key)}
                    disabled={Boolean(connectingProvider)}
                  >
                    {connectingProvider === key ? '연결 중' : '연결'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>계정 정보</div>
        <div className={styles.accountRows}>
          <div className={styles.accountRow}>
            <span>이름</span>
            <strong>{profile?.name}</strong>
          </div>
          <div className={styles.accountRow}>
            <span>이메일</span>
            <strong>{profile?.email}</strong>
          </div>
          <div className={styles.accountRow}>
            <span>가입일</span>
            <strong>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('ko-KR') : '-'}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 프로필 탭 ────────────────────────────────────────────────
function ProfileTab({ profile, onUpdate }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    setSaving(true)
    setError('')
    try {
      const { data } = await api.patch('/api/mypage/profile', { name })
      onUpdate(data.data)
    } catch (err) {
      setError(err.response?.data?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>기본 정보</div>
      <div className={styles.field}>
        <label>이름</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>이메일</label>
        <input type="email" value={profile?.email ?? ''} disabled className={styles.disabled} />
        <div className={styles.hint}>이메일은 변경할 수 없습니다.</div>
      </div>
      <div className={styles.field}>
        <label>가입일</label>
        <input type="text" value={new Date(profile?.createdAt).toLocaleDateString('ko-KR')} disabled className={styles.disabled} />
      </div>
      {error && <div className={styles.errorBox}>{error}</div>}
      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}

// ── 프리랜서 프로필 탭 ───────────────────────────────────────
function FreelancerProfileTab({ freelancer, onUpdate, onNavigate }) {
  const skillNames = (freelancer?.skills ?? []).map(sk => sk.skill ?? sk)
  const [form, setForm] = useState({
    role: freelancer?.role ?? '',
    category: '',
    experience: freelancer?.experience ?? '',
    hourlyRate: freelancer?.hourlyRate ?? 0,
    bio: freelancer?.bio ?? '',
    skills: skillNames,
    online: freelancer?.online ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key, value) => setForm(p => ({ ...p, [key]: value }))
  const toggleSkill = (skill) =>
    set('skills', form.skills.includes(skill)
      ? form.skills.filter(s => s !== skill)
      : [...form.skills, skill])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.patch('/api/mypage/profile/freelancer', form)
      onUpdate(data.data)
    } catch (err) {
      setError(err.response?.data?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!freelancer) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>👤</div>
        <p>아직 프리랜서 프로필이 없습니다.</p>
        <button className={styles.btnPrimary} onClick={() => onNavigate('apply')}>
          프리랜서 신청하기
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>활동 정보</div>

        <div className={styles.onlineToggle}>
          <span>지금 가능 상태</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.online}
              onChange={e => set('online', e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
          <span className={form.online ? styles.onlineOn : styles.onlineOff}>
            {form.online ? '🟢 활동 중' : '⚫ 자리 비움'}
          </span>
        </div>

        <div className={styles.field}>
          <label>직책</label>
          <input type="text" placeholder="예: 풀스택 개발자"
            value={form.role} onChange={e => set('role', e.target.value)} />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label>전문 분야</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">기존 유지</option>
              {CATEGORY_META.map(c => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>경력</label>
            <select value={form.experience} onChange={e => set('experience', e.target.value)}>
              <option value="">선택하세요</option>
              {EXPERIENCE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label>시간당 단가 (원)</label>
          <input type="number" value={form.hourlyRate}
            onChange={e => set('hourlyRate', e.target.value)} />
        </div>

        <div className={styles.field}>
          <label>자기소개</label>
          <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
            placeholder="경력, 전문 분야, 작업 스타일 등을 소개해주세요." />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>보유 스킬</div>
        <div className={styles.tagGroup}>
          {SKILL_TAGS.map(skill => (
            <span key={skill}
              className={`${styles.tag} ${form.skills.includes(skill) ? styles.tagOn : ''}`}
              onClick={() => toggleSkill(skill)}>{skill}</span>
          ))}
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}
      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}

// ── 내 서비스 탭 (프리랜서) ─────────────────────────────────
function MyServicesTab({ onNavigate, onEdit }) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/mypage/services')
      .then(({ data }) => setServices(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>불러오는 중...</div>
  if (services.length === 0) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>🧾</div>
      <p>아직 등록한 서비스가 없습니다.</p>
      <button className={styles.btnPrimary} onClick={() => onNavigate('post-service')}>
        서비스 등록하기
      </button>
    </div>
  )

  return (
    <div className={styles.listWrap}>
      {services.map(service => (
        <div key={service.id} className={styles.listItem}>
          <div className={styles.listLeft}>
            <div className={styles.listTitle}>{service.title}</div>
            <div className={styles.listSub}>
              {service.category} · {service.price.toLocaleString()}원 · {service.deliveryDays}일 납기
            </div>
            <div className={styles.listSub}>
              주문 {service._count?.orders ?? 0}건 · 리뷰 {service.reviewCount}개 · 평점 {Number(service.rating).toFixed(1)}
            </div>
            {service.approvalStatus === 'REJECTED' && service.rejectedReason && (
              <div className={styles.rejectReason}>
                반려 사유: {service.rejectedReason}
              </div>
            )}
          </div>
          <div className={styles.listRight}>
            <span className={styles.statusBadge}
              style={{
                background: SERVICE_APPROVAL_BG[service.approvalStatus],
                color: SERVICE_APPROVAL_COLOR[service.approvalStatus],
              }}>
              {SERVICE_APPROVAL_LABEL[service.approvalStatus]}
            </span>
            <span className={styles.statusBadge}
              style={{
                background: service.isActive ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                color: service.isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
              }}>
              {service.isActive ? '노출 중' : '미노출'}
            </span>
            <div className={styles.listSub}>{new Date(service.createdAt).toLocaleDateString('ko-KR')}</div>
            <button className={styles.proposalToggleBtn} onClick={() => onEdit(service)}>
              수정 후 재심사
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 주문 내역 탭 ─────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/mypage/orders')
      .then(({ data }) => setOrders(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>불러오는 중...</div>
  if (orders.length === 0) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>📦</div>
      <p>아직 주문 내역이 없습니다.</p>
    </div>
  )

  return (
    <div className={styles.listWrap}>
      {orders.map(order => (
        <div key={order.id} className={styles.listItem}>
          <div className={styles.listLeft}>
            <div className={styles.listTitle}>{order.service?.title}</div>
            <div className={styles.listSub}>판매자 · {order.seller?.name}</div>
            <div className={styles.listSub}>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
          </div>
          <div className={styles.listRight}>
            <div className={styles.listPrice}>{order.amount.toLocaleString()}원</div>
            <span className={styles.statusBadge}
              style={{ background: ORDER_STATUS_BG[order.status], color: ORDER_STATUS_COLOR[order.status] }}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 판매 내역 탭 ─────────────────────────────────────────────
function SalesTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/mypage/sales')
      .then(({ data }) => setOrders(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>불러오는 중...</div>
  if (orders.length === 0) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>💼</div>
      <p>아직 판매 내역이 없습니다.</p>
    </div>
  )

  return (
    <div className={styles.listWrap}>
      {orders.map(order => (
        <div key={order.id} className={styles.listItem}>
          <div className={styles.listLeft}>
            <div className={styles.listTitle}>{order.service?.title}</div>
            <div className={styles.listSub}>구매자 · {order.buyer?.name}</div>
            <div className={styles.listSub}>{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
          </div>
          <div className={styles.listRight}>
            <div className={styles.listPrice}>{order.amount.toLocaleString()}원</div>
            <span className={styles.statusBadge}
              style={{ background: ORDER_STATUS_BG[order.status], color: ORDER_STATUS_COLOR[order.status] }}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 내 프로젝트 탭 ───────────────────────────────────────────
function ProjectsTab({ onEdit }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [proposals, setProposals] = useState({})   // { [projectId]: proposal[] }
  const [propLoading, setPropLoading] = useState({})
  const [actionLoading, setActionLoading] = useState(null)
  const [paymentLoading, setPaymentLoading] = useState(null)
  const [toast, setToast] = useState('')

  const PROJECT_STATUS_LABEL = { PAYMENT_PENDING: '결제대기', OPEN: '모집중', IN_PROGRESS: '진행중', DONE: '완료', CANCELLED: '취소' }
  const PROJECT_STATUS_COLOR = { PAYMENT_PENDING: 'var(--color-warning)', OPEN: '#185FA5', IN_PROGRESS: '#854F0B', DONE: '#3B6D11', CANCELLED: '#6b6b67' }
  const PROJECT_STATUS_BG    = { PAYMENT_PENDING: 'var(--color-warning-bg)', OPEN: '#E6F1FB', IN_PROGRESS: '#FAEEDA', DONE: '#EAF3DE', CANCELLED: '#f1efe8' }

  const PROPOSAL_STATUS_LABEL = { PENDING: '대기중', ACCEPTED: '수락', REJECTED: '거절', CANCELLED: '취소' }
  const PROPOSAL_STATUS_COLOR = { PENDING: '#854F0B', ACCEPTED: '#3B6D11', REJECTED: '#6b6b67', CANCELLED: '#6b6b67' }
  const PROPOSAL_STATUS_BG    = { PENDING: '#FAEEDA', ACCEPTED: '#EAF3DE', REJECTED: '#f1efe8', CANCELLED: '#f1efe8' }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const normalizeStatus = (status) => status === '결제대기' ? 'PAYMENT_PENDING' : status

  const startDepositPayment = async (projectId) => {
    setPaymentLoading(projectId)
    try {
      const { data } = await api.post('/api/payments/project-deposit', { projectId })
      const { scriptUrl, request } = data.data.nicepay
      const launch = () => window.AUTHNICE?.requestPay({
        ...request,
        fnError: (result) => showToast(result?.errorMsg ?? '결제창을 열지 못했습니다.'),
      })

      if (window.AUTHNICE) {
        setTimeout(launch, 0)
      } else {
        const script = document.createElement('script')
        script.src = scriptUrl
        script.async = true
        script.onload = launch
        document.body.appendChild(script)
      }
    } catch (err) {
      showToast(err.response?.data?.message ?? '예치금 결제를 준비하지 못했습니다.')
    } finally {
      setPaymentLoading(null)
    }
  }

  useEffect(() => {
    api.get('/api/mypage/projects')
      .then(({ data }) => setProjects(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggleProposals = async (projId) => {
    if (expandedId === projId) { setExpandedId(null); return }
    setExpandedId(projId)
    if (proposals[projId]) return
    setPropLoading(p => ({ ...p, [projId]: true }))
    try {
      const { data } = await api.get(`/api/proposals/project/${projId}`)
      setProposals(p => ({ ...p, [projId]: data.data }))
    } catch (err) {
      console.error(err)
    } finally {
      setPropLoading(p => ({ ...p, [projId]: false }))
    }
  }

  const handleStatus = async (proposalId, status, projectId) => {
    setActionLoading(proposalId)
    try {
      await api.patch(`/api/proposals/${proposalId}/status`, { status })
      // 로컬 상태 업데이트
      setProposals(prev => ({
        ...prev,
        [projectId]: prev[projectId].map(p =>
          p.id === proposalId
            ? { ...p, status }
            : (status === 'ACCEPTED' ? { ...p, status: 'REJECTED' } : p)
        ),
      }))
      setProjects(prev => prev.map(proj =>
        proj.id === projectId && status === 'ACCEPTED'
          ? { ...proj, status: 'IN_PROGRESS' }
          : proj
      ))
      showToast(status === 'ACCEPTED' ? '✅ 제안을 수락했습니다.' : '제안을 거절했습니다.')
    } catch (err) {
      showToast(err.response?.data?.message ?? '처리 중 오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>
  if (projects.length === 0) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>📋</div>
      <p>아직 등록한 프로젝트가 없습니다.</p>
    </div>
  )

  return (
    <div className={styles.listWrap}>
      {projects.map(proj => (
        <div key={proj.id}>
          <div className={styles.listItem}>
            <div className={styles.listLeft}>
              <div className={styles.listTitle}>{proj.title}</div>
              <div className={styles.listSub}>{proj.category} · {proj.deadline}</div>
              <div className={styles.listSub}>{new Date(proj.createdAt).toLocaleDateString('ko-KR')}</div>
              <div className={styles.skillTags}>
                {(proj.skills ?? []).map(sk => (
                  <span key={sk.skill ?? sk} className={styles.skillTag}>{sk.skill ?? sk}</span>
                ))}
              </div>
            </div>
            <div className={styles.listRight}>
              {normalizeStatus(proj.status) === 'PAYMENT_PENDING' && (
                <div className={styles.proposalActions}>
                  <button
                    className={styles.proposalToggleBtn}
                    onClick={() => startDepositPayment(proj.id)}
                    disabled={paymentLoading === proj.id}
                  >
                    {paymentLoading === proj.id ? '준비 중' : '결제하기'}
                  </button>
                  <button
                    className={styles.proposalToggleBtn}
                    onClick={() => onEdit(proj)}
                  >
                    수정하기
                  </button>
                </div>
              )}
              <span className={styles.statusBadge}
                style={{ background: PROJECT_STATUS_BG[normalizeStatus(proj.status)], color: PROJECT_STATUS_COLOR[normalizeStatus(proj.status)] }}>
                {PROJECT_STATUS_LABEL[normalizeStatus(proj.status)]}
              </span>
              <button
                className={styles.proposalToggleBtn}
                onClick={() => toggleProposals(proj.id)}
              >
                제안 {proj._count?.proposals ?? 0}건 {expandedId === proj.id ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {expandedId === proj.id && (
            <div className={styles.proposalPanel}>
              {propLoading[proj.id] ? (
                <div className={styles.proposalLoading}>불러오는 중...</div>
              ) : !proposals[proj.id] || proposals[proj.id].length === 0 ? (
                <div className={styles.proposalEmpty}>아직 제안이 없습니다.</div>
              ) : (
                proposals[proj.id].map(proposal => (
                  <div key={proposal.id} className={styles.proposalItem}>
                    <div className={styles.proposalLeft}>
                      <div className={styles.proposalName}>
                        {proposal.freelancer?.user?.name ?? '(이름 없음)'}
                        <span className={styles.proposalBadge}
                          style={{ background: PROPOSAL_STATUS_BG[proposal.status], color: PROPOSAL_STATUS_COLOR[proposal.status] }}>
                          {PROPOSAL_STATUS_LABEL[proposal.status]}
                        </span>
                      </div>
                      <div className={styles.proposalSkills}>
                        {(proposal.freelancer?.skills ?? []).slice(0, 4).map(sk => (
                          <span key={sk.skill ?? sk} className={styles.skillTag}>{sk.skill ?? sk}</span>
                        ))}
                      </div>
                      <div className={styles.proposalMsg}>{proposal.message}</div>
                    </div>
                    <div className={styles.proposalRight}>
                      {proposal.projectRole?.role && (
                        <div className={styles.proposalDays}>{proposal.projectRole.role}</div>
                      )}
                      <div className={styles.proposalPrice}>{proposal.price.toLocaleString()}원</div>
                      <div className={styles.proposalDays}>{proposal.deliveryDays}일 납기</div>
                      {proposal.status === 'PENDING' && (
                        <div className={styles.proposalActions}>
                          <button
                            className={styles.btnAccept}
                            onClick={() => handleStatus(proposal.id, 'ACCEPTED', proj.id)}
                            disabled={actionLoading === proposal.id}
                          >수락</button>
                          <button
                            className={styles.btnReject}
                            onClick={() => handleStatus(proposal.id, 'REJECTED', proj.id)}
                            disabled={actionLoading === proposal.id}
                          >거절</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

// ── 내 제안 탭 (프리랜서) ────────────────────────────────────
function MyProposalsTab() {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  const PROPOSAL_STATUS_LABEL = { PENDING: '대기중', ACCEPTED: '수락', REJECTED: '거절', CANCELLED: '취소' }
  const PROPOSAL_STATUS_COLOR = { PENDING: '#854F0B', ACCEPTED: '#3B6D11', REJECTED: '#6b6b67', CANCELLED: '#6b6b67' }
  const PROPOSAL_STATUS_BG    = { PENDING: '#FAEEDA', ACCEPTED: '#EAF3DE', REJECTED: '#f1efe8', CANCELLED: '#f1efe8' }

  useEffect(() => {
    api.get('/api/mypage/proposals')
      .then(({ data }) => setProposals(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>불러오는 중...</div>
  if (proposals.length === 0) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>📨</div>
      <p>아직 제출한 제안이 없습니다.</p>
    </div>
  )

  return (
    <div className={styles.listWrap}>
      {proposals.map(proposal => (
        <div key={proposal.id} className={styles.listItem}>
          <div className={styles.listLeft}>
            <div className={styles.listTitle}>{proposal.project?.title}</div>
            <div className={styles.listSub}>의뢰인 · {proposal.project?.author?.name}</div>
            {proposal.projectRole?.role && (
              <div className={styles.listSub}>신청 역할 · {proposal.projectRole.role}</div>
            )}
            <div className={styles.listSub}>{new Date(proposal.createdAt).toLocaleDateString('ko-KR')}</div>
            <div className={styles.proposalMsgSmall}>{proposal.message}</div>
          </div>
          <div className={styles.listRight}>
            <div className={styles.listPrice}>{proposal.price.toLocaleString()}원</div>
            <div className={styles.proposalCount}>{proposal.deliveryDays}일 납기</div>
            <span className={styles.statusBadge}
              style={{ background: PROPOSAL_STATUS_BG[proposal.status], color: PROPOSAL_STATUS_COLOR[proposal.status] }}>
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
