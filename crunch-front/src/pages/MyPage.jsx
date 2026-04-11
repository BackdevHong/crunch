import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
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

const TABS_CLIENT     = ['프로필', '주문 내역', '내 프로젝트']
const TABS_FREELANCER = ['프로필', '프리랜서 프로필', '주문 내역', '판매 내역', '내 프로젝트']

export default function MyPage({ onNavigate }) {
  const { currentUser, setAuthError } = useApp()
  const [activeTab, setActiveTab] = useState('프로필')
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
              {currentUser?.name?.[0] ?? '?'}
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
          {activeTab === '프리랜서 프로필' && isFreelancer && (
            <FreelancerProfileTab
              freelancer={profile?.freelancer}
              onUpdate={(updated) => { setProfile(p => ({ ...p, freelancer: updated })); showToast('✅ 저장되었습니다!') }}
              onNavigate={onNavigate}
            />
          )}
          {activeTab === '주문 내역' && <OrdersTab />}
          {activeTab === '판매 내역' && isFreelancer && <SalesTab />}
          {activeTab === '내 프로젝트' && <ProjectsTab />}
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
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
function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const PROJECT_STATUS_LABEL = { OPEN: '모집중', IN_PROGRESS: '진행중', DONE: '완료', CANCELLED: '취소' }
  const PROJECT_STATUS_COLOR = { OPEN: '#185FA5', IN_PROGRESS: '#854F0B', DONE: '#3B6D11', CANCELLED: '#6b6b67' }
  const PROJECT_STATUS_BG    = { OPEN: '#E6F1FB', IN_PROGRESS: '#FAEEDA', DONE: '#EAF3DE', CANCELLED: '#f1efe8' }

  useEffect(() => {
    api.get('/api/mypage/projects')
      .then(({ data }) => setProjects(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
        <div key={proj.id} className={styles.listItem}>
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
            <span className={styles.statusBadge}
              style={{ background: PROJECT_STATUS_BG[proj.status], color: PROJECT_STATUS_COLOR[proj.status] }}>
              {PROJECT_STATUS_LABEL[proj.status]}
            </span>
            <div className={styles.proposalCount}>제안 {proj._count?.proposals ?? 0}건</div>
          </div>
        </div>
      ))}
    </div>
  )
}