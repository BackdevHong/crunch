import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import FreelancerCard from '../components/FreelancerCard'
import { SKILL_TAGS } from '../data/mockData'
import styles from './FindFreelancers.module.css'

const SORT_MAP = {
  '추천순':     { sort: 'rating',        order: 'desc' },
  '평점순':     { sort: 'rating',        order: 'desc' },
  '완료 건수순': { sort: 'completedJobs', order: 'desc' },
  '낮은 단가순': { sort: 'hourlyRate',    order: 'asc'  },
}

const RATE_OPTIONS = [
  { label: '전체',         min: undefined, max: undefined },
  { label: '~3만원/시간',  min: undefined, max: 30000    },
  { label: '3~6만원/시간', min: 30000,     max: 60000    },
  { label: '6만원+/시간',  min: 60000,     max: undefined },
]

const EXP_OPTIONS = ['1년 미만', '1~3년', '3~5년', '5년 이상']
const PAGE_SIZE = 6

export default function FindFreelancers() {
  const { setSelectedFreelancer } = useApp()

  const [freelancers, setFreelancers] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [activeSkills, setActiveSkills] = useState([])
  const [rate, setRate] = useState('전체')
  const [experience, setExperience] = useState([])
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [sort, setSort] = useState('추천순')
  const [page, setPage] = useState(1)

  const fetchFreelancers = useCallback(async () => {
    setLoading(true)
    try {
      const rateOpt = RATE_OPTIONS.find(r => r.label === rate)
      const { sort: sortKey, order } = SORT_MAP[sort]

      const params = {
        page,
        limit: PAGE_SIZE,
        sort: sortKey,
        order,
        ...(query && { q: query }),
        ...(activeSkills.length > 0 && { skill: activeSkills[0] }),
        ...(rateOpt?.min && { minRate: rateOpt.min }),
        ...(rateOpt?.max && { maxRate: rateOpt.max }),
        ...(experience.length > 0 && { experience: experience[0] }),
        ...(onlyOnline && { online: true }),
      }

      const { data } = await api.get('/api/freelancers', { params })
      setFreelancers(data.data.freelancers)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [query, activeSkills, rate, experience, onlyOnline, sort, page])

  useEffect(() => {
    fetchFreelancers()
  }, [fetchFreelancers])

  const handleFilter = (setter, value) => { setter(value); setPage(1) }
  const toggleSkill = (skill) => {
    setActiveSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
    setPage(1)
  }
  const toggleExp = (opt) => {
    setExperience(prev => prev.includes(opt) ? prev.filter(e => e !== opt) : [...prev, opt])
    setPage(1)
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>나에게 딱 맞는 <span>프리랜서</span>를 찾아보세요</h1>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <input type="text" placeholder="예: React 개발자, UI/UX 디자이너..."
              value={query} onChange={e => handleFilter(setQuery, e.target.value)} />
            <button onClick={fetchFreelancers}>검색</button>
          </div>
        </div>
        <div className={styles.quickTags}>
          {SKILL_TAGS.slice(0, 7).map(tag => (
            <span key={tag}
              className={`${styles.tag} ${activeSkills.includes(tag) ? styles.tagOn : ''}`}
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
                <input type="radio" name="rate" checked={rate === label}
                  onChange={() => handleFilter(setRate, label)} />
                {label}
              </label>
            ))}
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>경력</div>
            {EXP_OPTIONS.map(opt => (
              <label key={opt} className={styles.filterLabel}>
                <input type="checkbox" checked={experience.includes(opt)}
                  onChange={() => toggleExp(opt)} />
                {opt}
              </label>
            ))}
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>가용 상태</div>
            <label className={styles.filterLabel}>
              <input type="checkbox" checked={onlyOnline}
                onChange={e => handleFilter(setOnlyOnline, e.target.checked)} />
              지금 바로 가능
            </label>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.gridHeader}>
            <h2>프리랜서 <span>{total}명</span></h2>
            <select className={styles.sortSelect} value={sort}
              onChange={e => handleFilter(setSort, e.target.value)}>
              {Object.keys(SORT_MAP).map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {loading ? (
            <div className={styles.empty}>불러오는 중...</div>
          ) : freelancers.length === 0 ? (
            <div className={styles.empty}>조건에 맞는 프리랜서가 없어요.</div>
          ) : (
            <div className={styles.grid}>
              {freelancers.map(fl => (
                <FreelancerCard key={fl.id} freelancer={{
                  ...fl,
                  name: fl.user.name,
                  avatarUrl: fl.user.avatarUrl,
                }} onClick={() => setSelectedFreelancer(fl)} />
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