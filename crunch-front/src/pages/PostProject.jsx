import { useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import { CATEGORY_META, SKILL_TAGS, COLLAB_TAGS, DEADLINE_OPTIONS } from '../data/mockData'
import styles from './PostProject.module.css'

const STEPS = ['기본 정보', '예산 · 기간', '상세 요구사항', '검토 · 제출']
const DEPOSIT_RATE = 0.2
const ROLE_OPTIONS = [
  '프론트엔드 개발자',
  '백엔드 개발자',
  '풀스택 개발자',
  '모바일 앱 개발자',
  'UI/UX 디자이너',
  '기획자',
  '마케터',
  '데이터 분석가',
]

const parseMoney = (value) => Number(String(value).replace(/[^\d]/g, '')) || 0
const formatMoney = (value) => `${Number(value || 0).toLocaleString('ko-KR')}원`
const getRoleAmount = (budget, percent) => Math.floor(parseMoney(budget) * Number(percent || 0) / 100)
const getPerPersonAmount = (budget, percent, headcount) =>
  Math.floor(getRoleAmount(budget, percent) / Math.max(1, Number(headcount || 1)))

export default function PostProject({ onNavigate, editingProject }) {
  const { currentUser, setEditingProject } = useApp()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [createdProject, setCreatedProject] = useState(null)
  const [preparingPayment, setPreparingPayment] = useState(false)
  const [error, setError] = useState('')
  const nicepayScriptRef = useRef(null)

  const [form, setForm] = useState({
    title: editingProject?.title ?? '',
    category: editingProject?.category ?? '',
    skills: (editingProject?.skills ?? []).map(sk => sk.skill ?? sk),
    budget: editingProject?.budget ? String(editingProject.budget) : '',
    roles: editingProject?.roles?.length
      ? editingProject.roles.map((role, index) => ({
          id: role.id ?? `role-${index + 1}`,
          role: role.role ?? '',
          headcount: role.headcount ?? 1,
          budgetPercent: role.budgetPercent ?? 0,
        }))
      : [{ id: 'role-1', role: '', headcount: 1, budgetPercent: 100 }],
    deadline: editingProject?.deadline ?? '1개월 이내',
    description: editingProject?.description ?? '',
    collab: Array.isArray(editingProject?.collabTags) ? editingProject.collabTags : [],
  })
  const isEditing = Boolean(editingProject?.id)

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const updateRole = (id, key, value) => setForm(prev => ({
    ...prev,
    roles: prev.roles.map(item => item.id === id ? { ...item, [key]: value } : item),
  }))
  const addRole = () => setForm(prev => ({
    ...prev,
    roles: [...prev.roles, { id: `role-${Date.now()}`, role: '', headcount: 1, budgetPercent: 0 }],
  }))
  const removeRole = (id) => setForm(prev => ({
    ...prev,
    roles: prev.roles.length > 1 ? prev.roles.filter(item => item.id !== id) : prev.roles,
  }))
  const toggleArr = (key, value) =>
    set(key, form[key].includes(value)
      ? form[key].filter(v => v !== value)
      : [...form[key], value])

  const handleSubmit = async () => {
    if (!form.title) { setError('제목을 입력해주세요.'); return }
    if (!form.category) { setError('카테고리를 선택해주세요.'); return }
    const budget = parseMoney(form.budget)
    if (budget <= 0) { setError('프로젝트 예산을 입력해주세요.'); return }

    const roles = form.roles.map(item => ({
      role: item.role.trim(),
      headcount: Number(item.headcount),
      budgetPercent: Number(item.budgetPercent),
    }))
    if (roles.some(item => !item.role || item.headcount < 1 || item.budgetPercent < 1)) {
      setError('필요 역할, 인원, 예산 배분율을 확인해주세요.')
      return
    }
    if (roles.reduce((sum, item) => sum + item.budgetPercent, 0) > 100) {
      setError('역할별 예산 배분율은 총 100%를 넘을 수 없습니다.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        category: form.category,
        budget,
        budgetPreset: formatMoney(budget),
        roles,
        deadline: form.deadline,
        description: form.description,
        collabTags: form.collab,
        skills: form.skills,
      }
      const { data } = isEditing
        ? await api.patch(`/api/projects/${editingProject.id}`, payload)
        : await api.post('/api/projects', payload)
      setCreatedProject(data.data)
      setEditingProject(null)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.message ?? '등록 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const startPayment = async () => {
      if (!createdProject?.id) return
      setPreparingPayment(true)
      setError('')
      try {
        const { data } = await api.post('/api/payments/project-deposit', { projectId: createdProject.id })
        const { scriptUrl, request } = data.data.nicepay
        const launch = () => window.AUTHNICE?.requestPay({
          ...request,
          fnError: (result) => setError(result?.errorMsg ?? '결제창을 열지 못했습니다.'),
        })

        if (window.AUTHNICE) {
          setTimeout(launch, 0)
        } else {
          const script = document.createElement('script')
          script.src = scriptUrl
          script.async = true
          script.onload = launch
          nicepayScriptRef.current = script
          document.body.appendChild(script)
        }
      } catch (err) {
        setError(err.response?.data?.message ?? '예치금 결제를 준비하지 못했습니다.')
      } finally {
        setPreparingPayment(false)
      }
    }

    return (
      <div className={styles.page}>
        <div className={styles.successWrap}>
          <div className={styles.successIcon}>💳</div>
          <h2>예치금 결제가 필요합니다</h2>
          <p>프로젝트는 총 예산의 20% 예치금 결제가 완료되면 공개됩니다.</p>
          <button className={styles.btnNext} onClick={startPayment} disabled={preparingPayment}>
            {preparingPayment ? '결제 준비 중...' : '예치금 결제하기'}
          </button>
          <button className={styles.btnBack} onClick={() => onNavigate('mypage-projects')}>
            내 프로젝트로 이동
          </button>
          {error && <div className={styles.errorBox}>{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1><span>프로젝트</span>{isEditing ? '를 수정하세요' : '를 등록하세요'}</h1>
        <p>{isEditing ? '예치금 결제 전까지 예산과 구성을 조정할 수 있습니다' : '몇 가지 정보만 입력하면 딱 맞는 전문가가 찾아옵니다'}</p>
      </div>

      <Stepper current={step} steps={STEPS} />

      <div className={styles.formWrap}>
        {step === 1 && <Step1 form={form} set={set} toggleArr={toggleArr} />}
        {step === 2 && (
          <Step2
            form={form}
            set={set}
            updateRole={updateRole}
            addRole={addRole}
            removeRole={removeRole}
          />
        )}
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
                {submitting ? (isEditing ? '수정 중...' : '등록 중...') : (isEditing ? '프로젝트 수정 완료' : '🚀 프로젝트 등록하기')}
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

// ── STEP 1 ───────────────────────────────────────────────────
function Step1({ form, set, toggleArr }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>📋</div>프로젝트 기본 정보</div>
      <div className={styles.field}>
        <label>프로젝트 제목</label>
        <input type="text" placeholder="예: 쇼핑몰 웹사이트 개발"
          value={form.title} onChange={e => set('title', e.target.value)} />
        <div className={styles.hint}>어떤 작업인지 명확하게 적어주세요</div>
      </div>
      <div className={styles.field}>
        <label>카테고리</label>
        <select value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="">카테고리를 선택하세요</option>
          {CATEGORY_META.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
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

// ── STEP 2 ───────────────────────────────────────────────────
function Step2({ form, set, updateRole, addRole, removeRole }) {
  const budget = parseMoney(form.budget)
  const deposit = Math.floor(budget * DEPOSIT_RATE)
  const totalPercent = form.roles.reduce((sum, item) => sum + Number(item.budgetPercent || 0), 0)
  const remainingPercent = 100 - totalPercent

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>💰</div>예산 · 기간</div>
      <div className={styles.field}>
        <label>프로젝트 총 예산</label>
        <input type="text" inputMode="numeric" placeholder="예: 1,000,000"
          value={form.budget} onChange={e => set('budget', e.target.value)} />
        <div className={styles.hint}>프로젝트 등록 시 총 예산의 20%가 예치금으로 계산됩니다</div>
      </div>

      <div className={styles.budgetSummary}>
        <div>
          <span>총 예산</span>
          <strong>{formatMoney(budget)}</strong>
        </div>
        <div>
          <span>예치금 20%</span>
          <strong>{formatMoney(deposit)}</strong>
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.fieldFull}>
          <div className={styles.roleHeader}>
            <label>필요 프리랜서 구성</label>
            <button type="button" className={styles.btnMini} onClick={addRole}>역할 추가</button>
          </div>
          <div className={`${styles.percentNotice} ${totalPercent > 100 ? styles.percentOver : ''}`}>
            배분율 합계 {totalPercent}% · 남은 배분율 {remainingPercent}%
          </div>
          <div className={styles.roleList}>
            {form.roles.map(item => (
              <div key={item.id} className={styles.roleItem}>
                <div className={styles.roleGrid}>
                  <div className={styles.fieldCompact}>
                    <label>필요 역할</label>
                    <input
                      type="text"
                      list="project-role-options"
                      placeholder="예: 백엔드 개발자"
                      value={item.role}
                      onChange={e => updateRole(item.id, 'role', e.target.value)}
                    />
                  </div>
                  <div className={styles.fieldCompact}>
                    <label>인원</label>
                    <input
                      type="number"
                      min="1"
                      value={item.headcount}
                      onChange={e => updateRole(item.id, 'headcount', e.target.value)}
                    />
                  </div>
                  <div className={styles.fieldCompact}>
                    <label>배분율</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={item.budgetPercent}
                      onChange={e => updateRole(item.id, 'budgetPercent', e.target.value)}
                    />
                  </div>
                  <div className={styles.roleAmount}>
                    <span>1인당 예산</span>
                    <strong>{formatMoney(getPerPersonAmount(form.budget, item.budgetPercent, item.headcount))}</strong>
                    <small>총 {formatMoney(getRoleAmount(form.budget, item.budgetPercent))}</small>
                  </div>
                  <button
                    type="button"
                    className={styles.roleRemove}
                    onClick={() => removeRole(item.id)}
                    disabled={form.roles.length === 1}
                    aria-label="역할 삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <datalist id="project-role-options">
            {ROLE_OPTIONS.map(role => <option key={role} value={role} />)}
          </datalist>
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

// ── STEP 3 ───────────────────────────────────────────────────
function Step3({ form, set, toggleArr }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><div className={styles.cardTitleIcon}>📝</div>상세 요구사항</div>
      <div className={styles.field}>
        <label>프로젝트 상세 설명</label>
        <textarea
          placeholder={'프로젝트에 대해 자세히 설명해 주세요.\n\n예: 현재 상황, 원하는 결과물, 참고할 레퍼런스 등'}
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

// ── STEP 4 ───────────────────────────────────────────────────
function Step4({ form, currentUser }) {
  const budget = parseMoney(form.budget)
  const deposit = Math.floor(budget * DEPOSIT_RATE)
  const rows = [
    { label: '제목',   value: form.title || '(미입력)' },
    { label: '카테고리', value: form.category || '(미입력)' },
    { label: '총 예산',   value: formatMoney(budget) },
    { label: '예치금 20%', value: formatMoney(deposit) },
    { label: '납기일', value: form.deadline },
    { label: '등록자', value: currentUser?.name ?? '(로그인 필요)' },
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
          <div className={styles.reviewBlock}>
            <span className={styles.reviewLabel}>필요 프리랜서</span>
            <div className={styles.reviewRoleList}>
              {form.roles.map(item => (
                <div key={item.id} className={styles.reviewRole}>
                  <strong>{item.role || '(역할 미입력)'}</strong>
                  <span>
                    {Number(item.headcount || 0)}명 · {Number(item.budgetPercent || 0)}% · 1인당 {formatMoney(getPerPersonAmount(form.budget, item.budgetPercent, item.headcount))}
                    <small>총 {formatMoney(getRoleAmount(form.budget, item.budgetPercent))}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
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
