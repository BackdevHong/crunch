import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const CATEGORY_LABEL = {
  DEV: '개발·IT',
  DESIGN: '디자인',
  MARKETING: '마케팅',
  WRITING: '글쓰기·번역',
  VIDEO: '영상·사진',
  MUSIC: '음악·오디오',
}

const STATUS_LABEL = {
  PAYMENT_PENDING: '결제대기',
  OPEN: '모집중',
  IN_PROGRESS: '진행중',
  DONE: '완료',
  CANCELLED: '취소',
}

const STATUS_COLOR = {
  PAYMENT_PENDING: 'var(--color-warning)',
  OPEN: 'var(--color-info)',
  IN_PROGRESS: '#854F0B',
  DONE: 'var(--color-success)',
  CANCELLED: 'var(--color-danger)',
}

const STATUS_BG = {
  PAYMENT_PENDING: 'var(--color-warning-bg)',
  OPEN: 'var(--color-hero-blue)',
  IN_PROGRESS: '#FAEEDA',
  DONE: 'var(--color-success-bg)',
  CANCELLED: 'var(--color-danger-bg)',
}

const PAYMENT_LABEL = {
  PROJECT_DEPOSIT: '예치금',
  PROJECT_BALANCE: '잔금',
  SERVICE_ORDER: '서비스 결제',
}

const PROPOSAL_LABEL = {
  PENDING: '대기중',
  ACCEPTED: '수락',
  REJECTED: '거절',
  CANCELLED: '취소',
}

const SETTLEMENT_LABEL = {
  READY: '준비',
  AVAILABLE: '정산 가능',
  REQUESTED: '정산 요청',
  PAID: '지급 완료',
  FAILED: '실패',
  CANCELED: '취소',
}

function formatMoney(value) {
  return `${Number(value ?? 0).toLocaleString('ko-KR')}원`
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR')
}

export default function AdminProjects({ activePage, onNavigate }) {
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/admin/projects', {
        params: {
          q: query || undefined,
          status: statusFilter,
          page,
          limit: 20,
        },
      })
      setProjects(data.data.projects)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      showToast(err.response?.data?.message ?? '프로젝트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [query, statusFilter, page])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const openProjectDetail = async (projectId) => {
    setSelected(null)
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/api/admin/projects/${projectId}`)
      setSelected(data.data)
    } catch (err) {
      showToast(err.response?.data?.message ?? '프로젝트 상세를 불러오지 못했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }

  const updateStatus = async (projectId, status) => {
    if (!confirm(`프로젝트 상태를 ${STATUS_LABEL[status]}(으)로 변경할까요?`)) return
    try {
      await api.patch(`/api/admin/projects/${projectId}/status`, { status })
      showToast('프로젝트 상태를 변경했습니다.')
      await fetchProjects()
      if (selected?.project?.id === projectId) {
        const { data } = await api.get(`/api/admin/projects/${projectId}`)
        setSelected(data.data)
      }
    } catch (err) {
      showToast(err.response?.data?.message ?? '상태 변경에 실패했습니다.')
    }
  }

  const deleteProject = async (project) => {
    if (!confirm(`프로젝트 "${project.title}"을 삭제할까요?\n결제 또는 정산 완료 기록이 있으면 삭제되지 않습니다.`)) return
    try {
      const { data } = await api.delete(`/api/admin/projects/${project.id}`)
      const refundedAmount = data.data?.refundedDepositAmount ?? 0
      showToast(refundedAmount > 0
        ? `예치금 ${formatMoney(refundedAmount)} 환불 후 프로젝트를 삭제했습니다.`
        : '프로젝트를 삭제했습니다.')
      setSelected(null)
      await fetchProjects()
    } catch (err) {
      showToast(err.response?.data?.message ?? '프로젝트 삭제에 실패했습니다.')
    }
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>프로젝트 관리</h1>
          <span className={styles.badge}>{total}건</span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {['ALL', 'PAYMENT_PENDING', 'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map(status => (
              <button
                key={status}
                className={`${styles.tab} ${statusFilter === status ? styles.tabActive : ''}`}
                onClick={() => { setStatusFilter(status); setPage(1) }}
              >
                {status === 'ALL' ? '전체' : STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          <div className={styles.toolbarRight}>
            <input
              className={styles.searchInput}
              placeholder="프로젝트명, 의뢰자 검색"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        {loading ? <div className={styles.empty}>불러오는 중...</div>
        : projects.length === 0 ? <div className={styles.empty}>프로젝트가 없습니다.</div>
        : (
          <div className={styles.table}>
            <div className={styles.thead} style={{ gridTemplateColumns: '2fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr 1.1fr' }}>
              <span>프로젝트</span><span>의뢰자</span><span>예산</span><span>모집</span><span>상태</span><span>결제</span><span>관리</span>
            </div>
            {projects.map(project => {
              const depositPaid = project.paymentSummary?.PROJECT_DEPOSIT_PAID ?? 0
              const balancePaid = project.paymentSummary?.PROJECT_BALANCE_PAID ?? 0
              const totalHeadcount = project.roles?.reduce((sum, role) => sum + Number(role.headcount ?? 0), 0) ?? 0
              return (
                <div key={project.id} className={styles.trow} style={{ gridTemplateColumns: '2fr 1fr 0.9fr 0.9fr 0.9fr 0.9fr 1.1fr' }}>
                  <span>
                    <div className={styles.name}>{project.title}</div>
                    <div className={styles.sub}>{CATEGORY_LABEL[project.category] ?? project.category} · {formatDate(project.createdAt)}</div>
                  </span>
                  <span className={styles.sub}>{project.author?.name}</span>
                  <span className={styles.sub}>{formatMoney(project.budget)}</span>
                  <span className={styles.sub}>{project.acceptedCount}/{totalHeadcount || '-'}</span>
                  <span>
                    <span className={styles.statusBadge} style={{ background: STATUS_BG[project.status], color: STATUS_COLOR[project.status] }}>
                      {STATUS_LABEL[project.status] ?? project.status}
                    </span>
                  </span>
                  <span className={styles.sub}>
                    예치 {formatMoney(depositPaid)}
                    <br />
                    잔금 {formatMoney(balancePaid)}
                  </span>
                  <span className={styles.actionGroup}>
                    <button className={styles.detailBtn} onClick={() => openProjectDetail(project.id)}>상세</button>
                    <button className={styles.btnReject} onClick={() => deleteProject(project)}>삭제</button>
                    <select
                      className={styles.roleSelect}
                      value={project.status}
                      onChange={e => updateStatus(project.id, e.target.value)}
                    >
                      {Object.keys(STATUS_LABEL).map(status => (
                        <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                      ))}
                    </select>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>다음</button>
          </div>
        )}
      </div>

      {detailLoading && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalBody}>
              <div className={styles.empty}>프로젝트 상세를 불러오는 중...</div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ProjectDetailModal
          detail={selected}
          onClose={() => setSelected(null)}
          onStatusChange={status => updateStatus(selected.project.id, status)}
          onDelete={() => deleteProject(selected.project)}
        />
      )}
      {toast && <div className={styles.toast}>{toast}</div>}
    </AdminLayout>
  )
}

function ProjectDetailModal({ detail, onClose, onStatusChange, onDelete }) {
  const { project, payments, settlements } = detail
  const totalHeadcount = project.roles?.reduce((sum, role) => sum + Number(role.headcount ?? 0), 0) ?? 0
  const acceptedCount = project.proposals?.filter(proposal => proposal.status === 'ACCEPTED').length ?? 0

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.wideModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{project.title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.infoGrid}>
            <InfoItem label="의뢰자" value={`${project.author?.name ?? '-'} (${project.author?.email ?? '-'})`} />
            <InfoItem label="분야" value={CATEGORY_LABEL[project.category] ?? project.category} />
            <InfoItem label="예산" value={formatMoney(project.budget)} />
            <InfoItem label="상태" value={STATUS_LABEL[project.status] ?? project.status} />
            <InfoItem label="모집 현황" value={`${acceptedCount}/${totalHeadcount || '-'}명`} />
            <InfoItem label="등록일" value={formatDate(project.createdAt)} />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>상태 변경</div>
            <div className={styles.actionGroup}>
              {Object.entries(STATUS_LABEL).map(([status, label]) => (
                <button
                  key={status}
                  className={styles.detailBtn}
                  onClick={() => onStatusChange(status)}
                  disabled={project.status === status}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>필요 역할</div>
            <div className={styles.compactList}>
              {(project.roles ?? []).map(role => (
                <div key={role.id} className={styles.compactItem}>
                  <span>{role.role} · {role.headcount}명 · {role.budgetPercent}%</span>
                  <small>{formatMoney(role.budgetAmount)}</small>
                </div>
              ))}
            </div>
          </div>

          <RecentList
            title="제안"
            items={project.proposals ?? []}
            empty="제안이 없습니다."
            render={proposal => `${proposal.freelancer?.user?.name ?? '-'} · ${proposal.projectRole?.role ?? '역할 미지정'} · ${PROPOSAL_LABEL[proposal.status] ?? proposal.status} · ${formatMoney(proposal.price)}`}
          />

          <RecentList
            title="결제"
            items={payments ?? []}
            empty="결제 내역이 없습니다."
            render={payment => `${PAYMENT_LABEL[payment.purpose] ?? payment.purpose} · ${payment.status} · ${formatMoney(payment.amount)}`}
          />

          <RecentList
            title="정산"
            items={settlements ?? []}
            empty="정산 내역이 없습니다."
            render={settlement => `${settlement.freelancerName} · ${settlement.role ?? '역할 미지정'} · 정산 가능 ${formatMoney(settlement.payoutAmount)} · ${SETTLEMENT_LABEL[settlement.status] ?? settlement.status}`}
          />

          <div className={styles.section}>
            <div className={styles.sectionLabel}>프로젝트 설명</div>
            <p className={styles.sectionText}>{project.description || '설명이 없습니다.'}</p>
          </div>

          <div className={styles.modalActions}>
            <button className={styles.detailBtn} onClick={onClose}>닫기</button>
            <button className={styles.btnReject} onClick={onDelete}>프로젝트 삭제</button>
          </div>
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

function RecentList({ title, items, empty, render }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{title}</div>
      {items.length === 0 ? (
        <p className={styles.sectionText}>{empty}</p>
      ) : (
        <div className={styles.compactList}>
          {items.map(item => (
            <div key={item.id} className={styles.compactItem}>
              <span>{render(item)}</span>
              <small>{formatDate(item.createdAt ?? item.paidAt ?? item.approvedAt)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
