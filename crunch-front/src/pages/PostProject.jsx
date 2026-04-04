import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { CATEGORY_META, SKILL_TAGS, COLLAB_TAGS, DEADLINE_OPTIONS, BUDGET_PRESETS } from '../data/mockData'
import styles from './PostProject.module.css'

const STEPS = ['기본 정보', '예산 · 기간', '상세 요구사항', '검토 · 제출']

export default function PostProject({ onNavigate }) {
  const { addProject, currentUser } = useApp()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    title: '', category: '', skills: [],
    budgetPreset: '~50만원', budgetMin: '', budgetMax: '',
    deadline: '1개월 이내', description: '', collab: [],
  })

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const toggleArr = (key, value) =>
    set(key, form[key].includes(value) ? form[key].filter(v => v !== value) : [...form[key], value])

  const handleSubmit = () => {
    addProject(form)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.successWrap}>
          <div className={styles.successIcon}>🎉</div>
          <h2>프로젝트가 등록되었습니다!</h2>
          <p>48시간 내 평균 5.2개의 전문가 제안이 도착합니다.</p>
          <button className={styles.btnNext} onClick={() => onNavigate('home')}>홈으로 돌아가기</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1><span>프로젝트</span>를 등록하세요</h1>
        <p>몇 가지 정보만 입력하면 딱 맞는 전문가가 찾아옵니다</p>
      </div>

      <Stepper current={step} steps={STEPS} />

      <div className={styles.formWrap}>
        {step === 1 && <Step1 form={form} set={set} toggleArr={toggleArr} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} toggleArr={toggleArr} />}
        {step === 4 && <Step4 form={form} currentUser={currentUser} />}

        <div className={styles.actions}>
          {step > 1
            ? <button className={styles.btnBack} onClick={() => setStep(s => s - 1)}>← 이전</button>
            : <span className={styles.stepHint}>{step} / {STEPS.length}단계</span>
          }
          {step < 4
            ? <button className={styles.btnNext} onClick={() => setStep(s => s + 1)}>다음 →</button>
            : <button className={styles.btnSubmit} onClick={handleSubmit}>🚀 프로젝트 등록하기</button>
          }
        </div>
      </div>
    </div>
  )
}

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

function Step1({ form, set, toggleArr }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>📋</div>프로젝트 기본 정보</div>
      <div className={styles.field}>
        <label>프로젝트 제목</label>
        <input type="text" placeholder="예: 쇼핑몰 웹사이트 개발" value={form.title} onChange={e => set('title', e.target.value)} />
        <div className={styles.hint}>어떤 작업인지 명확하게 적어주세요</div>
      </div>
      <div className={styles.field}>
        <label>카테고리</label>
        <select value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="">카테고리를 선택하세요</option>
          {CATEGORY_META.map(c => <option key={c.label}>{c.label}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label>필요한 스킬 태그</label>
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

function Step2({ form, set }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>💰</div>예산 · 기간</div>
      <div className={styles.field}>
        <label>예산 범위</label>
        <div className={styles.budgetRow}>
          {BUDGET_PRESETS.map(({ label, sub }) => (
            <div key={label}
              className={`${styles.budgetOpt} ${form.budgetPreset === label ? styles.budgetOn : ''}`}
              onClick={() => set('budgetPreset', label)}>
              <strong>{label}</strong>{sub}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label>직접 입력 (최소)</label>
          <input type="text" placeholder="0 원" value={form.budgetMin} onChange={e => set('budgetMin', e.target.value)} />
        </div>
        <div className={styles.field}>
          <label>직접 입력 (최대)</label>
          <input type="text" placeholder="500,000 원" value={form.budgetMax} onChange={e => set('budgetMax', e.target.value)} />
        </div>
      </div>
      <div className={styles.field}>
        <label>희망 납기일</label>
        <select value={form.deadline} onChange={e => set('deadline', e.target.value)}>
          {DEADLINE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
        </select>
      </div>
    </div>
  )
}

function Step3({ form, set, toggleArr }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>📝</div>상세 요구사항</div>
      <div className={styles.field}>
        <label>프로젝트 상세 설명</label>
        <textarea placeholder={'프로젝트에 대해 자세히 설명해 주세요.\n\n예: 현재 상황, 원하는 결과물, 참고할 레퍼런스 등'}
          value={form.description} onChange={e => set('description', e.target.value)} />
        <div className={styles.hint}>자세할수록 더 좋은 제안을 받을 수 있어요</div>
      </div>
      <div className={styles.field}>
        <label>협업 방식</label>
        <div className={styles.tagGroup}>
          {COLLAB_TAGS.map(tag => (
            <span key={tag}
              className={`${styles.tag} ${form.collab.includes(tag) ? styles.tagOn : ''}`}
              onClick={() => toggleArr('collab', tag)}>{tag}</span>
          ))}
        </div>
      </div>
      <div className={styles.field}>
        <label>첨부 파일 <span className={styles.optional}>(선택)</span></label>
        <div className={styles.dropzone}>
          📎 파일을 드래그하거나 클릭해서 업로드하세요
          <span>PDF, PNG, JPG 등 최대 10MB</span>
        </div>
      </div>
    </div>
  )
}

function Step4({ form, currentUser }) {
  const rows = [
    { label: '제목', value: form.title || '(미입력)' },
    { label: '카테고리', value: form.category || '(미입력)' },
    { label: '예산', value: form.budgetPreset },
    { label: '납기일', value: form.deadline },
    { label: '등록자', value: currentUser ? currentUser.name : '(로그인 필요)' },
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
          <div className={styles.tipTitle}>등록 후 전문가 제안을 받으세요</div>
          <div className={styles.tipDesc}>프로젝트 등록 후 48시간 내에 평균 5.2개의 제안이 도착합니다.</div>
        </div>
      </div>
    </>
  )
}
