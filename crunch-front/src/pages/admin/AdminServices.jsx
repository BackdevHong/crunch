import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'
import styles from './AdminPage.module.css'

const CATEGORY_LABEL = {
  DEV: '개발·IT', DESIGN: '디자인', MARKETING: '마케팅',
  WRITING: '글쓰기·번역', VIDEO: '영상·사진', MUSIC: '음악·오디오',
}

export default function AdminServices({ activePage, onNavigate }) {
  const [services, setServices] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/admin/services', {
        params: { q: query || undefined, page, limit: 20 },
      })
      setServices(data.data.services)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [query, page])

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

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>서비스 관리</h1>
          <span className={styles.badge}>{total}개</span>
        </div>

        <div className={styles.toolbar}>
          <div />
          <input className={styles.searchInput} placeholder="서비스명 또는 판매자 검색"
            value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
        </div>

        {loading ? <div className={styles.empty}>불러오는 중...</div>
        : services.length === 0 ? <div className={styles.empty}>서비스가 없습니다.</div>
        : (
          <div className={styles.table}>
            <div className={styles.thead} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr' }}>
              <span>서비스명</span><span>판매자</span><span>분야</span>
              <span>가격</span><span>평점</span><span>상태</span><span>관리</span>
            </div>
            {services.map(svc => (
              <div key={svc.id} className={styles.trow}
                style={{ gridTemplateColumns: '2.5fr 1fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr' }}>
                <span>
                  <div className={styles.name}>{svc.title}</div>
                </span>
                <span className={styles.sub}>{svc.seller?.name}</span>
                <span className={styles.sub}>{CATEGORY_LABEL[svc.category] ?? svc.category}</span>
                <span className={styles.sub}>{svc.price.toLocaleString()}원</span>
                <span className={styles.sub}>⭐ {Number(svc.rating).toFixed(1)}</span>
                <span>
                  <span className={styles.statusBadge} style={{
                    background: svc.isActive ? '#EAF3DE' : '#f1efe8',
                    color: svc.isActive ? '#3B6D11' : '#6b6b67',
                  }}>
                    {svc.isActive ? '활성' : '비활성'}
                  </span>
                </span>
                <span>
                  <button className={styles.detailBtn}
                    onClick={() => handleToggleActive(svc.id, svc.isActive)}>
                    {svc.isActive ? '비활성화' : '활성화'}
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
      {toast && <div className={styles.toast}>{toast}</div>}
    </AdminLayout>
  )
}