import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const STATUS_LABEL = { PENDING: '대기중', APPROVED: '승인', REJECTED: '거절' }
const STATUS_COLOR = { PENDING: '#854F0B', APPROVED: '#3B6D11', REJECTED: '#A32D2D' }
const STATUS_BG    = { PENDING: '#FAEEDA', APPROVED: '#EAF3DE', REJECTED: '#FCEBEB' }
const CATEGORY_LABEL = {
  DEV: '개발·IT', DESIGN: '디자인', MARKETING: '마케팅',
  WRITING: '글쓰기·번역', VIDEO: '영상·사진', MUSIC: '음악·오디오',
}

export default function AdminApplications({ activePage, onNavigate }) {
  const [applications, setApplications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [selected, setSelected] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/applications', {
        params: { status: statusFilter, limit: 50 },
      })
      setApplications(data.data.applications)
      setTotal(data.data.pagination.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  const handleApprove = async (id) => {
    if (!confirm('승인하시겠습니까?')) return
    setProcessing(true)
    try {
      await api.patch(`/api/applications/${id}/approve`)
      showToast('✅ 승인 완료!')
      setSelected(null)
      fetchApplications()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '오류 발생'))
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (id) => {
    if (!rejectReason.trim()) { alert('거절 사유를 입력해주세요.'); return }
    if (!confirm('거절하시겠습니까?')) return
    setProcessing(true)
    try {
      await api.patch(`/api/applications/${id}/reject`, { reason: rejectReason })
      showToast('거절 처리되었습니다.')
      setSelected(null)
      setRejectReason('')
      fetchApplications()
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.message ?? '오류 발생'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>프리랜서 신청 관리</h1>
          <span className={styles.badge}>{total}건</span>
        </div>

        <div className={styles.tabs}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
            <button key={s}
              className={`${styles.tab} ${statusFilter === s ? styles.tabActive : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s === 'ALL' ? '전체' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? <div className={styles.empty}>불러오는 중...</div>
        : applications.length === 0 ? <div className={styles.empty}>신청 내역이 없습니다.</div>
        : (
          <div className={styles.table}>
            <div className={styles.thead} style={{ gridTemplateColumns: '1.5fr 1.2fr 1fr 0.8fr 0.9fr 0.8fr 0.8fr 0.5fr' }}>
              <span>신청자</span><span>직책</span><span>분야</span>
              <span>경력</span><span>단가</span><span>상태</span>
              <span>신청일</span><span></span>
            </div>
            {applications.map(app => (
              <div key={app.id} className={styles.trow} style={{ gridTemplateColumns: '1.5fr 1.2fr 1fr 0.8fr 0.9fr 0.8fr 0.8fr 0.5fr' }}>
                <span>
                  <div className={styles.name}>{app.user.name}</div>
                  <div className={styles.sub}>{app.user.email}</div>
                </span>
                <span>{app.role}</span>
                <span>{CATEGORY_LABEL[app.category] ?? app.category}</span>
                <span>{app.experience}</span>
                <span>{app.hourlyRate.toLocaleString()}원/h</span>
                <span>
                  <span className={styles.statusBadge}
                    style={{ background: STATUS_BG[app.status], color: STATUS_COLOR[app.status] }}>
                    {STATUS_LABEL[app.status]}
                  </span>
                </span>
                <span>{new Date(app.createdAt).toLocaleDateString('ko-KR')}</span>
                <span>
                  <button className={styles.detailBtn}
                    onClick={() => { setSelected(app); setRejectReason('') }}>상세</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{selected.user.name} 님의 신청</h2>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.infoGrid}>
                {[
                  ['이메일', selected.user.email],
                  ['직책', selected.role],
                  ['분야', CATEGORY_LABEL[selected.category] ?? selected.category],
                  ['경력', selected.experience],
                  ['시간당 단가', `${selected.hourlyRate.toLocaleString()}원`],
                  ['신청일', new Date(selected.createdAt).toLocaleDateString('ko-KR')],
                ].map(([label, value]) => (
                  <div key={label} className={styles.infoItem}>
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))}
              </div>
              {selected.bio && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>자기소개</div>
                  <p className={styles.sectionText}>{selected.bio}</p>
                </div>
              )}
              {selected.skills?.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>스킬</div>
                  <div className={styles.tags}>
                    {selected.skills.map(s => <span key={s} className={styles.tag}>{s}</span>)}
                  </div>
                </div>
              )}
              {selected.portfolioUrl && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>포트폴리오</div>
                  <a href={selected.portfolioUrl} target="_blank" rel="noreferrer" className={styles.link}>
                    {selected.portfolioUrl}
                  </a>
                </div>
              )}
              {selected.status === 'REJECTED' && selected.rejectedReason && (
                <div className={styles.rejectNote}>
                  <div className={styles.sectionLabel}>거절 사유</div>
                  <p>{selected.rejectedReason}</p>
                </div>
              )}
              {selected.status === 'PENDING' && (
                <>
                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>거절 사유 (거절 시 입력)</div>
                    <textarea className={styles.rejectTextarea}
                      placeholder="거절 사유를 입력해주세요."
                      value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  </div>
                  <div className={styles.modalActions}>
                    <button className={styles.btnReject}
                      onClick={() => handleReject(selected.id)} disabled={processing}>거절</button>
                    <button className={styles.btnApprove}
                      onClick={() => handleApprove(selected.id)} disabled={processing}>
                      {processing ? '처리 중...' : '승인'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </AdminLayout>
  )
}