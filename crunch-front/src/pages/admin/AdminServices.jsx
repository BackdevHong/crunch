import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const CATEGORY_LABEL = {
  DEV: '개발·IT', DESIGN: '디자인', MARKETING: '마케팅',
  WRITING: '글쓰기·번역', VIDEO: '영상·사진', MUSIC: '음악·오디오',
}
const ORDER_STATUS_LABEL = {
  PENDING: '결제대기',
  IN_PROGRESS: '진행중',
  REVIEW: '검수중',
  DONE: '완료',
  CANCELLED: '취소',
  REFUNDED: '환불',
}
const APPROVAL_LABEL = { PENDING: '심사중', APPROVED: '승인', REJECTED: '반려' }
const APPROVAL_COLOR = {
  PENDING: 'var(--color-warning)',
  APPROVED: 'var(--color-success)',
  REJECTED: 'var(--color-danger)',
}
const APPROVAL_BG = {
  PENDING: 'var(--color-warning-bg)',
  APPROVED: 'var(--color-success-bg)',
  REJECTED: 'var(--color-danger-bg)',
}

export default function AdminServices({ activePage, onNavigate }) {
  const [services, setServices] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('PENDING')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/admin/services', {
        params: {
          q: query || undefined,
          approvalStatus: approvalFilter === 'ALL' ? undefined : approvalFilter,
          active: activeFilter === 'ALL' ? undefined : activeFilter,
          page,
          limit: 20,
        },
      })
      setServices(data.data.services)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [query, approvalFilter, activeFilter, page])

  useEffect(() => { fetchServices() }, [fetchServices])

  const handleToggleActive = async (id, isActive) => {
    const action = isActive ? '비활성화' : '활성화'
    if (!confirm(`서비스를 ${action}하시겠습니까?`)) return
    try {
      await api.patch(`/api/admin/services/${id}/active`, { isActive: !isActive })
      showToast(`✅ ${action} 완료!`)
      fetchServices()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '오류 발생'))
    }
  }

  const handleApproval = async (id, status) => {
    if (!confirm(`서비스를 ${APPROVAL_LABEL[status]} 처리하시겠습니까?`)) return

    try {
      await api.patch(`/api/admin/services/${id}/approval`, { status })
      showToast(`✅ ${APPROVAL_LABEL[status]} 처리 완료!`)
      fetchServices()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '오류 발생'))
    }
  }

  const openRejectModal = (service) => {
    setRejectTarget(service)
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      showToast('반려 사유를 입력해주세요.')
      return
    }

    setRejecting(true)
    try {
      await api.patch(`/api/admin/services/${rejectTarget.id}/approval`, {
        status: 'REJECTED',
        reason: rejectReason.trim(),
      })
      showToast('✅ 반려 처리 완료!')
      setRejectTarget(null)
      setRejectReason('')
      setSelected(null)
      fetchServices()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '오류 발생'))
    } finally {
      setRejecting(false)
    }
  }

  const openServiceDetail = async (serviceId) => {
    setSelected(null)
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/api/admin/services/${serviceId}`)
      setSelected(data.data)
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '서비스 상세를 불러오지 못했습니다.'))
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>서비스 관리</h1>
          <span className={styles.badge}>{total}개</span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
              <button
                key={status}
                className={`${styles.tab} ${approvalFilter === status ? styles.tabActive : ''}`}
                onClick={() => { setApprovalFilter(status); setPage(1) }}
              >
                {status === 'ALL' ? '전체' : APPROVAL_LABEL[status]}
              </button>
            ))}
          </div>
          <div className={styles.toolbarRight}>
            <select
              className={styles.roleSelect}
              value={activeFilter}
              onChange={e => { setActiveFilter(e.target.value); setPage(1) }}
            >
              <option value="ALL">노출 전체</option>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
            <input className={styles.searchInput} placeholder="서비스명 또는 판매자 검색"
              value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
          </div>
        </div>

        {loading ? <div className={styles.empty}>불러오는 중...</div>
        : services.length === 0 ? <div className={styles.empty}>서비스가 없습니다.</div>
        : (
          <div className={styles.table}>
            <div className={styles.thead} style={{ gridTemplateColumns: '2.1fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.7fr 1.4fr' }}>
              <span>서비스명</span><span>판매자</span><span>분야</span>
              <span>가격</span><span>평점</span><span>심사</span><span>노출</span><span>관리</span>
            </div>
            {services.map(svc => (
              <div key={svc.id} className={styles.trow}
                style={{ gridTemplateColumns: '2.1fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.7fr 1.4fr' }}>
                <span>
                  <div className={styles.name}>{svc.title}</div>
                </span>
                <span className={styles.sub}>{svc.seller?.name}</span>
                <span className={styles.sub}>{CATEGORY_LABEL[svc.category] ?? svc.category}</span>
                <span className={styles.sub}>{svc.price.toLocaleString()}원</span>
                <span className={styles.sub}>⭐ {Number(svc.rating).toFixed(1)}</span>
                <span>
                  <span className={styles.statusBadge} style={{
                    background: APPROVAL_BG[svc.approvalStatus],
                    color: APPROVAL_COLOR[svc.approvalStatus],
                  }}>
                    {APPROVAL_LABEL[svc.approvalStatus]}
                  </span>
                </span>
                <span>
                  <span className={styles.statusBadge} style={{
                    background: svc.isActive ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                    color: svc.isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
                  }}>
                    {svc.isActive ? '활성' : '비활성'}
                  </span>
                </span>
                <span className={styles.actionGroup}>
                  <button className={styles.detailBtn} onClick={() => openServiceDetail(svc.id)}>
                    상세
                  </button>
                  {svc.approvalStatus === 'PENDING' ? (
                    <>
                      <button className={styles.detailBtn} onClick={() => handleApproval(svc.id, 'APPROVED')}>승인</button>
                      <button className={styles.detailBtn} onClick={() => openRejectModal(svc)}>반려</button>
                    </>
                  ) : (
                    <button className={styles.detailBtn}
                      onClick={() => handleToggleActive(svc.id, svc.isActive)}
                      disabled={svc.approvalStatus !== 'APPROVED'}>
                      {svc.isActive ? '비활성화' : '활성화'}
                    </button>
                  )}
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
              <div className={styles.empty}>서비스 상세를 불러오는 중...</div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ServiceDetailModal
          detail={selected}
          onClose={() => setSelected(null)}
          onToggleActive={async () => {
            await handleToggleActive(selected.service.id, selected.service.isActive)
            setSelected(null)
          }}
          onApproval={async (status) => {
            if (status === 'REJECTED') {
              openRejectModal(selected.service)
            } else {
              await handleApproval(selected.service.id, status)
              setSelected(null)
            }
          }}
        />
      )}
      {rejectTarget && (
        <RejectServiceModal
          service={rejectTarget}
          reason={rejectReason}
          setReason={setRejectReason}
          submitting={rejecting}
          onClose={() => { setRejectTarget(null); setRejectReason('') }}
          onSubmit={submitReject}
        />
      )}
      {toast && <div className={styles.toast}>{toast}</div>}
    </AdminLayout>
  )
}

function ServiceDetailModal({ detail, onClose, onToggleActive, onApproval }) {
  const { service, orderStats, recent } = detail
  const orderTotal = service._count.orders

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.wideModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{service.title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.infoGrid}>
            <InfoItem label="판매자" value={`${service.seller?.name ?? '-'} (${service.seller?.email ?? '-'})`} />
            <InfoItem label="분야" value={CATEGORY_LABEL[service.category] ?? service.category} />
            <InfoItem label="가격" value={`${service.price.toLocaleString()}원`} />
            <InfoItem label="배송일" value={`${service.deliveryDays}일`} />
            <InfoItem label="평점" value={`${Number(service.rating).toFixed(1)} / 리뷰 ${service.reviewCount}개`} />
            <InfoItem label="심사 상태" value={APPROVAL_LABEL[service.approvalStatus]} />
            <InfoItem label="노출 상태" value={service.isActive ? '활성' : '비활성'} />
            <InfoItem label="주문 수" value={`${orderTotal}건`} />
            <InfoItem label="등록일" value={new Date(service.createdAt).toLocaleDateString('ko-KR')} />
          </div>

          {service.approvalStatus === 'REJECTED' && service.rejectedReason && (
            <div className={styles.rejectNote}>
              <div className={styles.sectionLabel}>반려 사유</div>
              <p>{service.rejectedReason}</p>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionLabel}>서비스 설명</div>
            <p className={styles.sectionText}>{service.description || '설명이 없습니다.'}</p>
          </div>

          {service.skills?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>스킬</div>
              <div className={styles.tags}>
                {service.skills.map(({ skill }) => <span key={skill} className={styles.tag}>{skill}</span>)}
              </div>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionLabel}>주문 상태</div>
            <div className={styles.statGrid}>
              {['PENDING', 'IN_PROGRESS', 'REVIEW', 'DONE'].map(status => (
                <InfoItem
                  key={status}
                  label={ORDER_STATUS_LABEL[status]}
                  value={`${orderStats[status] ?? 0}건`}
                />
              ))}
            </div>
          </div>

          <RecentList title="최근 주문" items={recent.orders}
            render={item => `${item.buyer?.name ?? '구매자 없음'} · ${item.amount.toLocaleString()}원 · ${ORDER_STATUS_LABEL[item.status] ?? item.status}`} />

          <div className={styles.modalActions}>
            <button className={styles.detailBtn} onClick={onClose}>닫기</button>
            {service.approvalStatus === 'PENDING' ? (
              <>
                <button className={styles.btnReject} onClick={() => onApproval('REJECTED')}>반려</button>
                <button className={styles.btnApprove} onClick={() => onApproval('APPROVED')}>승인</button>
              </>
            ) : (
              <button
                className={service.isActive ? styles.btnReject : styles.btnApprove}
                onClick={onToggleActive}
                disabled={service.approvalStatus !== 'APPROVED'}
              >
                {service.isActive ? '비활성화' : '활성화'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RejectServiceModal({ service, reason, setReason, submitting, onClose, onSubmit }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>서비스 반려</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.rejectNote}>
            <div className={styles.sectionLabel}>대상 서비스</div>
            <p>{service.title}</p>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>반려 사유</div>
            <textarea
              className={styles.rejectTextarea}
              placeholder="프리랜서가 수정할 수 있도록 구체적인 사유를 입력해주세요."
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.modalActions}>
            <button className={styles.detailBtn} onClick={onClose} disabled={submitting}>취소</button>
            <button className={styles.btnReject} onClick={onSubmit} disabled={submitting}>
              {submitting ? '처리 중...' : '반려 처리'}
            </button>
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
