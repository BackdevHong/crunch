import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import ServiceCard from '../components/ServiceCard'
import { CATEGORY_META } from '../data/mockData'
import styles from './FindServices.module.css'

const SORT_OPTIONS = ['추천순', '인기순', '낮은 가격순', '높은 가격순', '최신순']
const BUDGET_OPTIONS = [
  { label: '전체', min: 0, max: Infinity },
  { label: '10만원 이하', min: 0, max: 100000 },
  { label: '10~50만원', min: 100000, max: 500000 },
  { label: '50~100만원', min: 500000, max: 1000000 },
  { label: '100만원 이상', min: 1000000, max: Infinity },
]
const DELIVERY_OPTIONS = ['3일 이내', '1주일 이내', '2주일 이내']
const PAGE_SIZE = 6

export default function FindServices() {
  const { services, setSelectedService } = useApp()

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('전체')
  const [budget, setBudget] = useState('전체')
  const [delivery, setDelivery] = useState([])
  const [minRating, setMinRating] = useState(null)
  const [sort, setSort] = useState('추천순')
  const [page, setPage] = useState(1)

  const toggleDelivery = (opt) =>
    setDelivery(prev => prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt])

  const budgetRange = BUDGET_OPTIONS.find(b => b.label === budget) || BUDGET_OPTIONS[0]

  const filtered = useMemo(() => {
    let result = [...services]

    if (query) result = result.filter(s => s.title.includes(query) || s.sellerName.includes(query) || s.skills.some(sk => sk.includes(query)))
    if (activeCategory !== '전체') result = result.filter(s => s.category === activeCategory)
    result = result.filter(s => s.price >= budgetRange.min && s.price <= budgetRange.max)
    if (delivery.includes('3일 이내')) result = result.filter(s => s.deliveryDays <= 3)
    else if (delivery.includes('1주일 이내')) result = result.filter(s => s.deliveryDays <= 7)
    else if (delivery.includes('2주일 이내')) result = result.filter(s => s.deliveryDays <= 14)
    if (minRating === '4.5 이상') result = result.filter(s => s.rating >= 4.5)
    if (minRating === '4.0 이상') result = result.filter(s => s.rating >= 4.0)

    if (sort === '인기순') result.sort((a, b) => b.reviewCount - a.reviewCount)
    else if (sort === '낮은 가격순') result.sort((a, b) => a.price - b.price)
    else if (sort === '높은 가격순') result.sort((a, b) => b.price - a.price)
    else if (sort === '최신순') result.sort((a, b) => b.id - a.id)

    return result
  }, [services, query, activeCategory, budgetRange, delivery, minRating, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilter = (setter, value) => { setter(value); setPage(1) }

  const allCategories = [{ label: '전체' }, ...CATEGORY_META]

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>원하는 <span>서비스</span>를 찾아보세요</h1>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <input type="text" placeholder="예: React 웹앱 개발, 로고 디자인..." value={query}
              onChange={e => handleFilter(setQuery, e.target.value)} />
            <button>검색</button>
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
                <input type="radio" name="budget" checked={budget === label} onChange={() => handleFilter(setBudget, label)} />
                {label}
              </label>
            ))}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>납기일</div>
            {DELIVERY_OPTIONS.map(opt => (
              <label key={opt} className={styles.filterLabel}>
                <input type="checkbox" checked={delivery.includes(opt)} onChange={() => { toggleDelivery(opt); setPage(1) }} />
                {opt}
              </label>
            ))}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>평점</div>
            {['4.5 이상', '4.0 이상'].map(opt => (
              <label key={opt} className={styles.filterLabel}>
                <input type="radio" name="rating" checked={minRating === opt} onChange={() => handleFilter(setMinRating, opt)} />
                ★ {opt}
              </label>
            ))}
            <label className={styles.filterLabel}>
              <input type="radio" name="rating" checked={minRating === null} onChange={() => handleFilter(setMinRating, null)} />
              전체
            </label>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.gridHeader}>
            <h2>{activeCategory} <span>{filtered.length.toLocaleString()}개</span></h2>
            <select className={styles.sortSelect} value={sort} onChange={e => handleFilter(setSort, e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {paginated.length === 0 ? (
            <div className={styles.empty}>검색 결과가 없어요. 필터를 바꿔보세요.</div>
          ) : (
            <div className={styles.grid}>
              {paginated.map(card => (
                <ServiceCard key={card.id} card={card} onClick={() => setSelectedService(card)} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
