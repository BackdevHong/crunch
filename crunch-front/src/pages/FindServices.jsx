import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import api from '../lib/api'
import ServiceCard from '../components/ServiceCard'
import { CATEGORY_META } from '../data/mockData'
import styles from './FindServices.module.css'

const SORT_MAP = {
  '추천순': { sort: 'createdAt', order: 'desc' },
  '인기순': { sort: 'reviewCount', order: 'desc' },
  '낮은 가격순': { sort: 'price', order: 'asc' },
  '높은 가격순': { sort: 'price', order: 'desc' },
}

const BUDGET_OPTIONS = [
  { label: '전체', min: undefined, max: undefined },
  { label: '10만원 이하', min: undefined, max: 100000 },
  { label: '10~50만원', min: 100000, max: 500000 },
  { label: '50~100만원', min: 500000, max: 1000000 },
  { label: '100만원 이상', min: 1000000, max: undefined },
]

const DELIVERY_OPTIONS = ['3일 이내', '1주일 이내', '2주일 이내']
const DELIVERY_DAYS_MAP = { '3일 이내': 3, '1주일 이내': 7, '2주일 이내': 14 }
const PAGE_SIZE = 6

export default function FindServices() {
  const { setSelectedService } = useApp()

  const [services, setServices] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('전체')
  const [budget, setBudget] = useState('전체')
  const [delivery, setDelivery] = useState([])
  const [minRating, setMinRating] = useState(null)
  const [sort, setSort] = useState('추천순')
  const [page, setPage] = useState(1)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const budgetOpt = BUDGET_OPTIONS.find(b => b.label === budget)
      const deliveryDay = delivery.length > 0
        ? Math.min(...delivery.map(d => DELIVERY_DAYS_MAP[d]))
        : undefined
      const { sort: sortKey, order } = SORT_MAP[sort]

      const params = {
        page,
        limit: PAGE_SIZE,
        sort: sortKey,
        order,
        ...(query && { q: query }),
        ...(activeCategory !== '전체' && { category: activeCategory }),
        ...(budgetOpt?.min && { minPrice: budgetOpt.min }),
        ...(budgetOpt?.max && { maxPrice: budgetOpt.max }),
        ...(deliveryDay && { deliveryDays: deliveryDay }),
        ...(minRating && { minRating: parseFloat(minRating) }),
      }

      const { data } = await api.get('/api/services', { params })
      setServices(data.data.services)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [query, activeCategory, budget, delivery, minRating, sort, page])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleFilter = (setter, value) => { setter(value); setPage(1) }
  const toggleDelivery = (opt) => {
    setDelivery(prev => prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt])
    setPage(1)
  }

  const allCategories = [{ label: '전체' }, ...CATEGORY_META]

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>원하는 <span>서비스</span>를 찾아보세요</h1>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <input type="text" placeholder="예: React 웹앱 개발, 로고 디자인..."
              value={query} onChange={e => handleFilter(setQuery, e.target.value)} />
            <button onClick={fetchServices}>검색</button>
          </div>
        </div>
        <div className={styles.quickTags}>
          {allCategories.map(({ label }) => (
            <span key={label}
              className={`${styles.tag} ${activeCategory === label ? styles.tagOn : ''}`}
              onClick={() => handleFilter(setActiveCategory, label)}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>카테고리</div>
            {allCategories.map(cat => (
              <div key={cat.label}
                className={`${styles.catItem} ${activeCategory === cat.label ? styles.catOn : ''}`}
                onClick={() => handleFilter(setActiveCategory, cat.label)}>
                {cat.icon && <div className={styles.catIcon} style={{ background: cat.bg }}>{cat.icon}</div>}
                {cat.label}
              </div>
            ))}
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>예산</div>
            {BUDGET_OPTIONS.map(({ label }) => (
              <label key={label} className={styles.filterLabel}>
                <input type="radio" name="budget" checked={budget === label}
                  onChange={() => handleFilter(setBudget, label)} />
                {label}
              </label>
            ))}
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>납기일</div>
            {DELIVERY_OPTIONS.map(opt => (
              <label key={opt} className={styles.filterLabel}>
                <input type="checkbox" checked={delivery.includes(opt)}
                  onChange={() => toggleDelivery(opt)} />
                {opt}
              </label>
            ))}
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>평점</div>
            {['4.5 이상', '4.0 이상'].map(opt => (
              <label key={opt} className={styles.filterLabel}>
                <input type="radio" name="rating" checked={minRating === opt}
                  onChange={() => handleFilter(setMinRating, opt)} />
                ★ {opt}
              </label>
            ))}
            <label className={styles.filterLabel}>
              <input type="radio" name="rating" checked={minRating === null}
                onChange={() => handleFilter(setMinRating, null)} />
              전체
            </label>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.gridHeader}>
            <h2>{activeCategory} <span>{total.toLocaleString()}개</span></h2>
            <select className={styles.sortSelect} value={sort}
              onChange={e => handleFilter(setSort, e.target.value)}>
              {Object.keys(SORT_MAP).map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {loading ? (
            <div className={styles.empty}>불러오는 중...</div>
          ) : services.length === 0 ? (
            <div className={styles.empty}>검색 결과가 없어요. 필터를 바꿔보세요.</div>
          ) : (
            <div className={styles.grid}>
              {services.map(card => (
                <ServiceCard key={card.id} card={card} onClick={() => setSelectedService(card)} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`}
                  onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}