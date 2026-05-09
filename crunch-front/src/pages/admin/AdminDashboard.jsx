import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminDashboard.module.css'

const ROLE_LABEL = { client: '의뢰인', freelancer: '프리랜서', admin: '어드민' }
const STATUS_LABEL = { PENDING: '대기중', APPROVED: '승인', REJECTED: '거절' }
const SERVICE_STATUS_LABEL = { PENDING: '심사중', APPROVED: '승인', REJECTED: '반려' }
const CATEGORY_LABEL = {
  DEV: '개발·IT', DESIGN: '디자인', MARKETING: '마케팅',
  WRITING: '글쓰기·번역', VIDEO: '영상·사진', MUSIC: '음악·오디오',
}

const formatDate = (value) => new Date(value).toLocaleDateString('ko-KR', {
  month: 'short',
  day: 'numeric',
})

export default function AdminDashboard({ activePage, onNavigate }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/api/admin/summary')
      setSummary(data.data)
    } catch (err) {
      console.error('[AdminDashboard]', err)
      setError(err.response?.data?.message ?? '대시보드를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const metrics = summary?.metrics
  const reviewItems = useMemo(() => {
    if (!metrics) return []
    return [
      {
        label: '프리랜서 신청 대기',
        value: metrics.applications.pending,
        detail: `승인 ${metrics.applications.approved}건 · 거절 ${metrics.applications.rejected}건`,
        action: '신청 관리',
        page: 'admin-applications',
        tone: 'warning',
      },
      {
        label: '서비스 심사 대기',
        value: metrics.services.pending,
        detail: `승인 활성 ${metrics.services.active}개 · 반려 ${metrics.services.rejected}개`,
        action: '서비스 관리',
        page: 'admin-services',
        tone: 'warning',
      },
      {
        label: '운영 유저',
        value: metrics.users.total,
        detail: `프리랜서 ${metrics.users.freelancer}명 · 의뢰인 ${metrics.users.client}명`,
        action: '유저 관리',
        page: 'admin-users',
        tone: 'info',
      },
    ]
  }, [metrics])

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Admin Overview</p>
            <h1>운영 대시보드</h1>
          </div>
          <button className={styles.refreshBtn} onClick={loadSummary} disabled={loading}>
            새로고침
          </button>
        </div>

        {loading ? (
          <div className={styles.state}>대시보드를 불러오는 중...</div>
        ) : error ? (
          <div className={styles.state}>{error}</div>
        ) : (
          <>
            <section className={styles.metricGrid}>
              <MetricCard label="전체 유저" value={metrics.users.total} meta={`어드민 ${metrics.users.admin}명`} />
              <MetricCard label="프리랜서" value={metrics.users.freelancer} meta={`의뢰인 ${metrics.users.client}명`} />
              <MetricCard label="활성 서비스" value={metrics.services.active} meta={`전체 ${metrics.services.total}개`} />
              <MetricCard label="열린 프로젝트" value={metrics.projects.open} meta={`주문 ${metrics.orders.total}건`} />
            </section>

            <section className={styles.reviewGrid}>
              {reviewItems.map(item => (
                <button
                  key={item.label}
                  className={`${styles.reviewCard} ${styles[item.tone]}`}
                  onClick={() => onNavigate(item.page)}
                >
                  <span className={styles.reviewLabel}>{item.label}</span>
                  <strong>{item.value.toLocaleString()}</strong>
                  <span className={styles.reviewDetail}>{item.detail}</span>
                  <span className={styles.reviewAction}>{item.action}</span>
                </button>
              ))}
            </section>

            <section className={styles.activityGrid}>
              <ActivityList title="최근 운영 로그" empty="최근 운영 로그가 없습니다.">
                {summary.recent.auditLogs.map(log => (
                  <li key={log.id}>
                    <div>
                      <strong>{log.message}</strong>
                      <span>{log.admin?.name ?? '관리자'} · {formatDate(log.createdAt)}</span>
                    </div>
                    <Badge>{log.targetType}</Badge>
                  </li>
                ))}
              </ActivityList>

              <ActivityList title="최근 가입 유저" empty="최근 가입 유저가 없습니다.">
                {summary.recent.users.map(user => (
                  <li key={user.id}>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
                  </li>
                ))}
              </ActivityList>

              <ActivityList title="최근 프리랜서 신청" empty="최근 신청이 없습니다.">
                {summary.recent.applications.map(app => (
                  <li key={app.id}>
                    <div>
                      <strong>{app.user.name}</strong>
                      <span>{CATEGORY_LABEL[app.category] ?? app.category} · {formatDate(app.createdAt)}</span>
                    </div>
                    <Badge tone={app.status.toLowerCase()}>{STATUS_LABEL[app.status]}</Badge>
                  </li>
                ))}
              </ActivityList>

              <ActivityList title="최근 등록 서비스" empty="최근 등록 서비스가 없습니다.">
                {summary.recent.services.map(service => (
                  <li key={service.id}>
                    <div>
                      <strong>{service.title}</strong>
                      <span>{service.seller?.name ?? '판매자 없음'} · {service.price.toLocaleString()}원</span>
                    </div>
                    <Badge tone={service.approvalStatus.toLowerCase()}>
                      {SERVICE_STATUS_LABEL[service.approvalStatus]}
                    </Badge>
                  </li>
                ))}
              </ActivityList>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function MetricCard({ label, value, meta }) {
  return (
    <div className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <p>{meta}</p>
    </div>
  )
}

function ActivityList({ title, empty, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <div className={styles.activityCard}>
      <h2>{title}</h2>
      {hasChildren ? <ul>{children}</ul> : <p className={styles.empty}>{empty}</p>}
    </div>
  )
}

function Badge({ tone = 'default', children }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
