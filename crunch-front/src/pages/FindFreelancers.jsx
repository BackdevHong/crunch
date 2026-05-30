import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import FreelancerCard from '../components/FreelancerCard'
import { SKILL_TAGS } from '../data/mockData'
import styles from './FindFreelancers.module.css'

const SORT_MAP = {
  추천순: { sort: 'rating', order: 'desc' },
  평점순: { sort: 'rating', order: 'desc' },
  완료건수순: { sort: 'completedJobs', order: 'desc' },
}

const EXP_OPTIONS = ['1년 미만', '1~3년', '3~5년', '5년 이상']
const PAGE_SIZE = 6

export default function FindFreelancers() {
  const { currentUser, setSelectedFreelancer } = useApp()

  const [freelancers, setFreelancers] = useState([])
  const [myProjects, setMyProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [inviteTarget, setInviteTarget] = useState(null)
  const [inviteProjectId, setInviteProjectId] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [toast, setToast] = useState('')

  const [query, setQuery] = useState('')
  const [activeSkills, setActiveSkills] = useState([])
  const [experience, setExperience] = useState([])
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [sort, setSort] = useState('추천순')
  const [page, setPage] = useState(1)

  const canInvite = currentUser?.role === 'client' || currentUser?.role === 'admin'

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchFreelancers = useCallback(async () => {
    setLoading(true)
    try {
      const { sort: sortKey, order } = SORT_MAP[sort]
      const params = {
        page,
        limit: PAGE_SIZE,
        sort: sortKey,
        order,
        ...(query && { q: query }),
        ...(activeSkills.length > 0 && { skill: activeSkills[0] }),
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
  }, [query, activeSkills, experience, onlyOnline, sort, page])

  useEffect(() => {
    fetchFreelancers()
  }, [fetchFreelancers])

  useEffect(() => {
    if (!canInvite) {
      setMyProjects([])
      return
    }

    api.get('/api/projects/me')
      .then(({ data }) => setMyProjects(data.data))
      .catch(() => setMyProjects([]))
  }, [canInvite])

  const handleFilter = (setter, value) => { setter(value); setPage(1) }
  const toggleSkill = (skill) => {
    setActiveSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
    setPage(1)
  }
  const toggleExp = (opt) => {
    setExperience(prev => prev.includes(opt) ? prev.filter(e => e !== opt) : [...prev, opt])
    setPage(1)
  }

  const openInviteModal = (freelancer) => {
    setInviteTarget(freelancer)
    setInviteProjectId(myProjects[0]?.id ?? '')
    setInviteMessage('')
  }

  const submitInvite = async () => {
    if (!inviteTarget || !inviteProjectId) {
      showToast('제안할 프로젝트를 선택해주세요.')
      return
    }

    setInviteLoading(true)
    try {
      await api.post(`/api/projects/${inviteProjectId}/invitations`, {
        freelancerId: inviteTarget.id,
        message: inviteMessage.trim() || undefined,
      })
      showToast('프로젝트 제안을 보냈습니다.')
      setInviteTarget(null)
    } catch (err) {
      showToast(err.response?.data?.message ?? '프로젝트 제안을 보내지 못했습니다.')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>나에게 딱 맞는 <span>프리랜서</span>를 찾아보세요</h1>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="예: React 개발자, UI/UX 디자이너..."
              value={query}
              onChange={e => handleFilter(setQuery, e.target.value)}
            />
            <button onClick={fetchFreelancers}>검색</button>
          </div>
        </div>
        <div className={styles.quickTags}>
          {SKILL_TAGS.slice(0, 7).map(tag => (
            <span
              key={tag}
              className={`${styles.tag} ${activeSkills.includes(tag) ? styles.tagOn : ''}`}
              onClick={() => toggleSkill(tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>전문 스킬</div>
            <div className={styles.skillChips}>
              {SKILL_TAGS.map(skill => (
                <span
                  key={skill}
                  className={`${styles.skillChip} ${activeSkills.includes(skill) ? styles.skillChipOn : ''}`}
                  onClick={() => toggleSkill(skill)}
                >
                  {skill}
                </span>
              ))}
            </div>
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
            <div className={styles.sectionTitle}>상태</div>
            <label className={styles.filterLabel}>
              <input type="checkbox" checked={onlyOnline} onChange={e => handleFilter(setOnlyOnline, e.target.checked)} />
              지금 바로 가능
            </label>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.gridHeader}>
            <h2>프리랜서 <span>{total}명</span></h2>
            <select className={styles.sortSelect} value={sort} onChange={e => handleFilter(setSort, e.target.value)}>
              {Object.keys(SORT_MAP).map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {loading ? (
            <div className={styles.empty}>불러오는 중...</div>
          ) : freelancers.length === 0 ? (
            <div className={styles.empty}>조건에 맞는 프리랜서가 없습니다.</div>
          ) : (
            <div className={styles.grid}>
              {freelancers.map(fl => (
                <FreelancerCard
                  key={fl.id}
                  freelancer={{
                    ...fl,
                    name: fl.user.name,
                    avatarUrl: fl.user.avatarUrl,
                  }}
                  canInvite={canInvite}
                  onInvite={() => openInviteModal(fl)}
                  onClick={() => setSelectedFreelancer(fl)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))}>이전</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>다음</button>
            </div>
          )}
        </div>
      </div>

      {inviteTarget && (
        <div className={styles.overlay} onClick={() => setInviteTarget(null)}>
          <div className={styles.inviteModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>프로젝트 제안</h2>
              <button onClick={() => setInviteTarget(null)}>×</button>
            </div>
            <p className={styles.modalLead}>
              {inviteTarget.user?.name}님에게 제안할 프로젝트를 선택해주세요.
            </p>
            {myProjects.length === 0 ? (
              <div className={styles.empty}>제안할 수 있는 내 프로젝트가 없습니다.</div>
            ) : (
              <>
                <label className={styles.modalLabel}>프로젝트</label>
                <select value={inviteProjectId} onChange={e => setInviteProjectId(e.target.value)}>
                  {myProjects.map(project => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>
                <label className={styles.modalLabel}>메시지</label>
                <textarea
                  value={inviteMessage}
                  onChange={e => setInviteMessage(e.target.value)}
                  placeholder="함께 작업하고 싶은 이유나 요청사항을 남겨주세요."
                />
                <div className={styles.modalActions}>
                  <button onClick={() => setInviteTarget(null)} disabled={inviteLoading}>취소</button>
                  <button onClick={submitInvite} disabled={inviteLoading}>
                    {inviteLoading ? '전송 중...' : '제안 보내기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
