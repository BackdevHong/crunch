import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import FreelancerCard from '../components/FreelancerCard'
import { SKILL_TAGS } from '../data/mockData'
import styles from './FindFreelancers.module.css'

const SORT_OPTIONS = ['추천순', '평점순', '완료 건수순', '낮은 단가순']
const RATE_OPTIONS = [
  { label: '전체', min: 0, max: Infinity },
  { label: '~3만원/시간', min: 0, max: 30000 },
  { label: '3~6만원/시간', min: 30000, max: 60000 },
  { label: '6만원+/시간', min: 60000, max: Infinity },
]
const EXP_OPTIONS = ['1년 미만', '1~3년', '3~5년', '5년 이상']
const PAGE_SIZE = 6

export default function FindFreelancers() {
  const { freelancers, setSelectedFreelancer } = useApp()

  const [query, setQuery] = useState('')
  const [activeSkills, setActiveSkills] = useState([])
  const [rate, setRate] = useState('전체')
  const [experience, setExperience] = useState([])
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [sort, setSort] = useState('추천순')
  const [page, setPage] = useState(1)

  const toggleSkill = (skill) => { setActiveSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]); setPage(1) }
  const toggleExp = (opt) => { setExperience(prev => prev.includes(opt) ? prev.filter(e => e !== opt) : [...prev, opt]); setPage(1) }

  const rateRange = RATE_OPTIONS.find(r => r.label === rate) || RATE_OPTIONS[0]

  const filtered = useMemo(() => {
    let result = [...freelancers]

    if (query) result = result.filter(f => f.name.includes(query) || f.role.includes(query) || f.skills.some(s => s.includes(query)))
    if (activeSkills.length > 0) result = result.filter(f => activeSkills.every(sk => f.skills.includes(sk)))
    result = result.filter(f => f.hourlyRate >= rateRange.min && f.hourlyRate <= rateRange.max)
    if (experience.length > 0) result = result.filter(f => experience.includes(f.experience))
    if (onlyOnline) result = result.filter(f => f.online)

    if (sort === '평점순') result.sort((a, b) => b.rating - a.rating)
    else if (sort === '완료 건수순') result.sort((a, b) => b.completedJobs - a.completedJobs)
    else if (sort === '낮은 단가순') result.sort((a, b) => a.hourlyRate - b.hourlyRate)

    return result
  }, [freelancers, query, activeSkills, rateRange, experience, onlyOnline, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const handleFilter = (setter, value) => { setter(value); setPage(1) }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>나에게 딱 맞는 <span>프리랜서</span>를 찾아보세요</h1>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <input type="text" placeholder="예: React 개발자, UI/UX 디자이너..." value={query}
              onChange={e => handleFilter(setQuery, e.target.value)} />
            <button>검색</button>
          </div>
        </div>
        <div className={styles.quickTags}>
          {SKILL_TAGS.slice(0, 7).map(tag => (
            <span key={tag} className={`${styles.tag} ${activeSkills.includes(tag) ? styles.tagOn : ''}`}
              onClick={() => toggleSkill(tag)}>{tag}</span>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>전문 스킬</div>
            <div className={styles.skillChips}>
              {SKILL_TAGS.map(skill => (
                <span key={skill}
                  className={`${styles.skillChip} ${activeSkills.includes(skill) ? styles.skillChipOn : ''}`}
                  onClick={() => toggleSkill(skill)}>{skill}</span>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>시간당 단가</div>
            {RATE_OPTIONS.map(({ label }) => (
              <label key={label} className={styles.filterLabel}>
                <input type="radio" name="rate" checked={rate === label} onChange={() => handleFilter(setRate, label)} />
                {label}
              </label>
            ))}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>경력</div>
            {EXP_OPTIONS.map(opt => (
              <label key={opt} className={styles.filterLabel}>
                <input type="checkbox" checked={experience.includes(opt)} onChange={() => toggleExp(opt)} />
                {opt}
              </label>
            ))}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>가용 상태</div>
            <label className={styles.filterLabel}>
              <input type="checkbox" checked={onlyOnline} onChange={e => handleFilter(setOnlyOnline, e.target.checked)} />
              지금 바로 가능
            </label>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.gridHeader}>
            <h2>프리랜서 <span>{filtered.length}명</span></h2>
            <select className={styles.sortSelect} value={sort} onChange={e => handleFilter(setSort, e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {paginated.length === 0 ? (
            <div className={styles.empty}>조건에 맞는 프리랜서가 없어요. 필터를 바꿔보세요.</div>
          ) : (
            <div className={styles.grid}>
              {paginated.map(fl => (
                <FreelancerCard key={fl.id} freelancer={fl} onClick={() => setSelectedFreelancer(fl)} />
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
