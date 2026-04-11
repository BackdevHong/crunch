import { useState } from 'react'
import { useApp } from '../context/AppContext'
import api from '../lib/api'
import { CATEGORY_META, SKILL_TAGS } from '../data/mockData'
import styles from './ApplyFreelancer.module.css'

const EXPERIENCE_OPTIONS = ['1년 미만', '1~3년', '3~5년', '5년 이상']

export default function ApplyFreelancer({ onNavigate }) {
  const { currentUser } = useApp()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    role: '', category: '', experience: '',
    hourlyRate: '', bio: '', skills: [], portfolioUrl: '',
  })

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const toggleSkill = (skill) =>
    set('skills', form.skills.includes(skill)
      ? form.skills.filter(s => s !== skill)
      : [...form.skills, skill])

  const handleSubmit = async () => {
    if (!form.role) { setError('직책을 입력해주세요.'); return }
    if (!form.category) { setError('카테고리를 선택해주세요.'); return }
    if (!form.experience) { setError('경력을 선택해주세요.'); return }
    if (!form.hourlyRate) { setError('시간당 단가를 입력해주세요.'); return }

    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/applications', {
        role: form.role,
        category: form.category,
        experience: form.experience,
        hourlyRate: Number(form.hourlyRate),
        bio: form.bio,
        skills: form.skills,
        portfolioUrl: form.portfolioUrl,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.message ?? '신청 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.successWrap}>
          <div className={styles.successIcon}>🎉</div>
          <h2>신청이 완료되었습니다!</h2>
          <p>검토 후 승인 여부를 이메일로 안내드릴게요.<br />보통 1~3일 이내에 처리됩니다.</p>
          <button className={styles.btnPrimary} onClick={() => onNavigate('home')}>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1><span>프리랜서</span>로 활동 신청하기</h1>
        <p>심사 후 승인되면 서비스를 등록하고 수익을 올릴 수 있어요</p>
      </div>

      <div className={styles.formWrap}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>기본 정보</div>

          <div className={styles.field}>
            <label>직책 <span className={styles.required}>*</span></label>
            <input type="text" placeholder="예: 풀스택 개발자, UI/UX 디자이너"
              value={form.role} onChange={e => set('role', e.target.value)} />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>전문 분야 <span className={styles.required}>*</span></label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">선택하세요</option>
                {CATEGORY_META.map(c => (
                  <option key={c.label} value={c.label}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>경력 <span className={styles.required}>*</span></label>
              <select value={form.experience} onChange={e => set('experience', e.target.value)}>
                <option value="">선택하세요</option>
                {EXPERIENCE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>시간당 단가 (원) <span className={styles.required}>*</span></label>
            <input type="number" placeholder="예: 50000"
              value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>스킬 & 소개</div>

          <div className={styles.field}>
            <label>보유 스킬</label>
            <div className={styles.tagGroup}>
              {SKILL_TAGS.map(skill => (
                <span key={skill}
                  className={`${styles.tag} ${form.skills.includes(skill) ? styles.tagOn : ''}`}
                  onClick={() => toggleSkill(skill)}>{skill}</span>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>자기소개</label>
            <textarea
              placeholder="경력, 전문 분야, 작업 스타일 등을 자유롭게 소개해주세요."
              value={form.bio} onChange={e => set('bio', e.target.value)} />
          </div>

          <div className={styles.field}>
            <label>포트폴리오 URL <span className={styles.optional}>(선택)</span></label>
            <input type="url" placeholder="https://portfolio.example.com"
              value={form.portfolioUrl} onChange={e => set('portfolioUrl', e.target.value)} />
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>{error}</div>
        )}

        <div className={styles.actions}>
          <button className={styles.btnBack} onClick={() => onNavigate('home')}>취소</button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? '제출 중...' : '신청하기'}
          </button>
        </div>
      </div>
    </div>
  )
}