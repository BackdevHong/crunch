import { useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import { CATEGORY_META, SKILL_TAGS } from '../data/mockData'
import styles from './PostProject.module.css'

const STEPS = ['기본 정보', '가격·납기', '상세 설명', '검토·제출']

const SERVICE_EMOJIS = ['🌐', '💻', '⚡', '🤖', '🛡️', '📊', '🎨', '🖼️', '📱', '🎬', '📸', '✍️', '🌍', '📣', '🎵', '🔧', '🎯', '📦']

const DELIVERY_OPTIONS = ['1일', '2일', '3일', '5일', '7일', '14일', '30일']

export default function PostService({ onNavigate }) {
  const { currentUser } = useApp()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    category: '',
    emoji: '🌐',
    skills: [],
    price: '',
    deliveryDays: '7일',
    description: '',
  })

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const toggleArr = (key, value) =>
    set(key, form[key].includes(value)
      ? form[key].filter(v => v !== value)
      : [...form[key], value])

  const handleSubmit = async () => {
    if (!form.title) { setError('서비스 제목을 입력해주세요.'); return }
    if (!form.category) { setError('카테고리를 선택해주세요.'); return }
    if (!form.price || isNaN(Number(form.price.replace(/,/g, '')))) {
      setError('올바른 가격을 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/services', {
        title: form.title,
        category: form.category,
        emoji: form.emoji,
        skills: form.skills,
        price: Number(form.price.replace(/,/g, '')),
        deliveryDays: Number(form.deliveryDays.replace('일', '')),
        description: form.description,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.message ?? '등록 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.successWrap}>
          <div className={styles.successIcon}>🎉</div>
          <h2>서비스가 등록되었습니다!</h2>
          <p>서비스 목록에 노출되어 클라이언트에게 발견될 거예요.</p>
          <button className={styles.btnNext} onClick={() => onNavigate('services')}>
            서비스 목록 보러 가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero} style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #daeeff 100%)' }}>
        <h1><span style={{ color: '#1a73e8' }}>서비스</span>를 등록하세요</h1>
        <p>내 전문 서비스를 올리고 클라이언트를 만나보세요</p>
      </div>

      <Stepper current={step} steps={STEPS} />

      <div className={styles.formWrap}>
        {step === 1 && <Step1 form={form} set={set} toggleArr={toggleArr} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} toggleArr={toggleArr} />}
        {step === 4 && <Step4 form={form} currentUser={currentUser} />}

        {error && (
          <div style={{
            background: '#fcebeb', border: '0.5px solid #f09595',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#a32d2d', marginBottom: '12px',
          }}>
            {error}
          </div>
        )}

        <div className={styles.actions}>
          {step > 1
            ? <button className={styles.btnBack} onClick={() => setStep(s => s - 1)}>← 이전</button>
            : <span className={styles.stepHint}>{step} / {STEPS.length}단계</span>
          }
          {step < 4
            ? <button className={styles.btnNext} onClick={() => setStep(s => s + 1)}>다음 →</button>
            : <button className={styles.btnSubmit} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '등록 중...' : '🚀 서비스 등록하기'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

// ── STEPPER ──────────────────────────────────────────────────
function Stepper({ current, steps }) {
  return (
    <div className={styles.stepper}>
      {steps.map((label, i) => {
        const n = i + 1
        const isDone = n < current
        const isActive = n === current
        return (
          <div key={n} className={styles.stepGroup}>
            <div className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${isDone ? styles.done : isActive ? styles.active : styles.pending}`}>
                {isDone ? '✓' : n}
              </div>
              <span className={`${styles.stepLabel} ${isActive ? styles.labelActive : styles.labelPending}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`${styles.stepLine} ${isDone ? styles.lineDone : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ── STEP 1 : 기본 정보 ────────────────────────────────────────
function Step1({ form, set }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>📋</div>서비스 기본 정보</div>
      <div className={styles.field}>
        <label>서비스 제목</label>
        <input type="text" placeholder="예: 반응형 웹사이트 풀스택 개발해 드립니다"
          value={form.title} onChange={e => set('title', e.target.value)} />
        <div className={styles.hint}>클라이언트가 검색할 핵심 키워드를 포함해 주세요</div>
      </div>
      <div className={styles.field}>
        <label>카테고리</label>
        <select value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="">카테고리를 선택하세요</option>
          {CATEGORY_META.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label>대표 아이콘</label>
        <div className={styles.tagGroup}>
          {SERVICE_EMOJIS.map(emoji => (
            <span
              key={emoji}
              className={`${styles.tag} ${form.emoji === emoji ? styles.tagOn : ''}`}
              style={{ fontSize: '18px', padding: '4px 10px' }}
              onClick={() => set('emoji', emoji)}
            >
              {emoji}
            </span>
          ))}
        </div>
        <div className={styles.hint}>서비스 카드에 표시될 아이콘을 선택하세요</div>
      </div>
    </div>
  )
}

// ── STEP 2 : 가격·납기 ────────────────────────────────────────
function Step2({ form, set }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>💰</div>가격·납기일</div>
      <div className={styles.field}>
        <label>서비스 가격 (원)</label>
        <input
          type="text"
          placeholder="예: 150000"
          value={form.price}
          onChange={e => set('price', e.target.value)}
        />
        <div className={styles.hint}>기본 서비스 기준 가격을 입력하세요 (숫자만)</div>
      </div>
      <div className={styles.field}>
        <label>납기일</label>
        <select value={form.deliveryDays} onChange={e => set('deliveryDays', e.target.value)}>
          {DELIVERY_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
        </select>
        <div className={styles.hint}>기본 서비스 완료까지 걸리는 기간</div>
      </div>
    </div>
  )
}

// ── STEP 3 : 상세 설명 + 스킬 ────────────────────────────────
function Step3({ form, set, toggleArr }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>📝</div>상세 설명 · 스킬</div>
      <div className={styles.field}>
        <label>서비스 상세 설명</label>
        <textarea
          placeholder={'제공하는 서비스를 자세히 설명해 주세요.\n\n예: 어떤 작업을 해드리는지, 포함 사항, 주의 사항 등'}
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
        <div className={styles.hint}>구체적일수록 클라이언트 신뢰도가 높아져요</div>
      </div>
      <div className={styles.field}>
        <label>스킬 태그</label>
        <div className={styles.tagGroup}>
          {SKILL_TAGS.map(tag => (
            <span key={tag}
              className={`${styles.tag} ${form.skills.includes(tag) ? styles.tagOn : ''}`}
              onClick={() => toggleArr('skills', tag)}>{tag}</span>
          ))}
        </div>
        <div className={styles.hint}>복수 선택 가능해요</div>
      </div>
    </div>
  )
}

// ── STEP 4 : 검토·제출 ────────────────────────────────────────
function Step4({ form, currentUser }) {
  const deliveryNum = Number(form.deliveryDays.replace('일', ''))
  const rows = [
    { label: '제목',     value: form.title || '(미입력)' },
    { label: '카테고리', value: form.category || '(미입력)' },
    { label: '아이콘',   value: form.emoji },
    { label: '가격',     value: form.price ? `${Number(form.price.replace(/,/g, '')).toLocaleString()}원` : '(미입력)' },
    { label: '납기일',   value: `${deliveryNum}일` },
    { label: '판매자',   value: currentUser?.name ?? '(로그인 필요)' },
  ]
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>✅</div>등록 내용 검토</div>
        <div className={styles.reviewRows}>
          {rows.map(({ label, value }) => (
            <div key={label} className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{label}</span>
              <span className={styles.reviewValue}>{value}</span>
            </div>
          ))}
          {form.skills.length > 0 && (
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>스킬 태그</span>
              <div className={styles.reviewTags}>
                {form.skills.map(s => <span key={s} className={styles.reviewTag}>{s}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.tipCard}>
        <div className={styles.tipIcon}>💡</div>
        <div>
          <div className={styles.tipTitle}>서비스를 등록하면 바로 노출돼요</div>
          <div className={styles.tipDesc}>클라이언트가 서비스를 검색할 때 내 서비스가 표시됩니다.</div>
        </div>
      </div>
    </>
  )
}
