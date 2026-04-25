import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { CATEGORY_META } from '../data/mockData'
import styles from './BrowseProjects.module.css'

const CATEGORY_LABEL = {
  DEV: '개발·IT', DESIGN: '디자인', MARKETING: '마케팅',
  WRITING: '글쓰기·번역', VIDEO: '영상·사진', MUSIC: '음악·오디오',
}

const BUDGET_OPTIONS = [
  { label: '전체', min: undefined, max: undefined },
  { label: '~50만원', min: undefined, max: 500000 },
  { label: '50~200만원', min: 500000, max: 2000000 },
  { label: '200만원+', min: 2000000, max: undefined },
]

const PROJECT_STATUS_LABEL = { OPEN: '모집중', IN_PROGRESS: '진행중', DONE: '완료', CANCELLED: '취소' }

export default function BrowseProjects() {
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [budget, setBudget] = useState('전체')
  const [page, setPage] = useState(1)

  const [selectedProject, setSelectedProject] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const budgetOpt = BUDGET_OPTIONS.find(b => b.label === budget)
      const params = {
        page,
        limit: 9,
        status: 'OPEN',
        ...(query && { q: query }),
        ...(activeCategory && { category: activeCategory }),
        ...(budgetOpt?.min && { budgetMin: budgetOpt.min }),
        ...(budgetOpt?.max && { budgetMax: budgetOpt.max }),
      }
      const { data } = await api.get('/api/projects', { params })
      setProjects(data.data.projects)
      setTotal(data.data.pagination.total)
      setTotalPages(data.data.pagination.totalPages)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [query, activeCategory, budget, page])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const handleFilter = (setter, value) => { setter(value); setPage(1) }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>진행할 <span>프로젝트</span>를 찾아보세요</h1>
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="예: React 개발, 로고 디자인..."
              value={query}
              onChange={e => handleFilter(setQuery, e.target.value)}
            />
            <button onClick={fetchProjects}>검색</button>
          </div>
        </div>
        <div className={styles.quickTags}>
          <span
            className={`${styles.tag} ${activeCategory === '' ? styles.tagOn : ''}`}
            onClick={() => handleFilter(setActiveCategory, '')}
          >전체</span>
          {CATEGORY_META.map(c => (
            <span
              key={c.label}
              className={`${styles.tag} ${activeCategory === Object.entries(CATEGORY_LABEL).find(([, v]) => v === c.label)?.[0] ? styles.tagOn : ''}`}
              onClick={() => {
                const key = Object.entries(CATEGORY_LABEL).find(([, v]) => v === c.label)?.[0] ?? ''
                handleFilter(setActiveCategory, key)
              }}
            >{c.icon} {c.label}</span>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
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
        </aside>

        <div className={styles.content}>
          <div className={styles.gridHeader}>
            <h2>모집 중인 프로젝트 <span>{total}건</span></h2>
          </div>

          {loading ? (
            <div className={styles.empty}>불러오는 중...</div>
          ) : projects.length === 0 ? (
            <div className={styles.empty}>조건에 맞는 프로젝트가 없어요.</div>
          ) : (
            <div className={styles.grid}>
              {projects.map(proj => (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  onClick={() => setSelectedProject(proj)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n}
                  className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`}
                  onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            </div>
          )}
        </div>
      </div>

      {selectedProject && (
        <ProposalModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSubmitted={() => { setSelectedProject(null); fetchProjects() }}
        />
      )}
    </div>
  )
}

// ── 프로젝트 카드 ─────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  const categoryLabel = CATEGORY_LABEL[project.category] ?? project.category

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardTop}>
        <span className={styles.categoryBadge}>{categoryLabel}</span>
        <span className={styles.statusBadge}>{PROJECT_STATUS_LABEL[project.status] ?? project.status}</span>
      </div>
      <div className={styles.cardTitle}>{project.title}</div>
      <div className={styles.cardMeta}>
        {project.budgetPreset && <span>💰 {project.budgetPreset}</span>}
        {project.deadline && <span>📅 {project.deadline}</span>}
        <span>💬 제안 {project._count?.proposals ?? 0}건</span>
      </div>
      {project.skills?.length > 0 && (
        <div className={styles.skillTags}>
          {project.skills.slice(0, 4).map(sk => (
            <span key={sk.skill ?? sk} className={styles.skillTag}>{sk.skill ?? sk}</span>
          ))}
          {project.skills.length > 4 && <span className={styles.skillTag}>+{project.skills.length - 4}</span>}
        </div>
      )}
      <div className={styles.cardAuthor}>by {project.author?.name}</div>
    </div>
  )
}

// ── 제안 모달 ─────────────────────────────────────────────────
function ProposalModal({ project, onClose, onSubmitted }) {
  const [form, setForm] = useState({ message: '', price: '', deliveryDays: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const categoryLabel = CATEGORY_LABEL[project.category] ?? project.category
  const set = (key, value) => setForm(p => ({ ...p, [key]: value }))

  const handleSubmit = async () => {
    if (!form.message.trim()) { setError('제안 내용을 입력해주세요.'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('제안 금액을 입력해주세요.'); return }
    if (!form.deliveryDays || isNaN(Number(form.deliveryDays))) { setError('납기일을 입력해주세요.'); return }

    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/proposals', {
        projectId: project.id,
        message: form.message,
        price: Number(form.price),
        deliveryDays: Number(form.deliveryDays),
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message ?? '제출 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>

        {success ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon}>🎉</div>
            <h3>제안을 제출했습니다!</h3>
            <p>클라이언트가 검토 후 연락드립니다.</p>
            <button className={styles.btnSubmit} onClick={onSubmitted}>확인</button>
          </div>
        ) : (
          <>
            <div className={styles.modalHeader}>
              <span className={styles.categoryBadge}>{categoryLabel}</span>
              <h2 className={styles.modalTitle}>{project.title}</h2>
              <div className={styles.modalMeta}>
                {project.budgetPreset && <span>💰 {project.budgetPreset}</span>}
                {project.deadline && <span>📅 {project.deadline}</span>}
                <span>👤 {project.author?.name}</span>
              </div>
            </div>

            {project.description && (
              <div className={styles.modalDesc}>{project.description}</div>
            )}

            {project.skills?.length > 0 && (
              <div className={styles.skillTags} style={{ marginBottom: '20px' }}>
                {project.skills.map(sk => (
                  <span key={sk.skill ?? sk} className={styles.skillTag}>{sk.skill ?? sk}</span>
                ))}
              </div>
            )}

            <div className={styles.divider} />

            <h3 className={styles.formTitle}>제안서 작성</h3>

            <div className={styles.field}>
              <label>제안 내용</label>
              <textarea
                placeholder="어떤 방식으로 프로젝트를 진행할지, 관련 경험 등을 설명해주세요."
                value={form.message}
                onChange={e => set('message', e.target.value)}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>제안 금액 (원)</label>
                <input
                  type="number"
                  placeholder="예: 300000"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>납기일 (일)</label>
                <input
                  type="number"
                  placeholder="예: 14"
                  value={form.deliveryDays}
                  onChange={e => set('deliveryDays', e.target.value)}
                />
              </div>
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={onClose}>취소</button>
              <button className={styles.btnSubmit} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '제출 중...' : '제안 제출하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
