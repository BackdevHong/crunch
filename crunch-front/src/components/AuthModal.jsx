import { useState } from 'react'
import { useApp } from '../context/AppContext'
import styles from './AuthModal.module.css'

export default function AuthModal({ initialView = 'login', onClose }) {
  const [view, setView] = useState(initialView)
  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose() }
  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {view === 'login'
          ? <LoginView onSwitch={() => setView('signup')} onClose={onClose} />
          : <SignupView onSwitch={() => setView('login')} onClose={onClose} />
        }
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className={styles.logoWrap}>
      <div className={styles.logoMark}>
        <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
      </div>
      <span className={styles.logoText}>크런치</span>
    </div>
  )
}

function SocialButtons() {
  const socials = [
    { bg: '#FEE500', color: '#3C1E1E', letter: 'K', label: '카카오로 계속하기' },
    { bg: '#03C75A', color: 'white', letter: 'N', label: '네이버로 계속하기' },
    { bg: '#f1f1f1', color: '#555', letter: 'G', label: 'Google로 계속하기' },
  ]
  return (
    <>
      <div className={styles.divider}><span>또는</span></div>
      {socials.map(({ bg, color, letter, label }) => (
        <button key={label} className={styles.btnSocial}>
          <div className={styles.socialIcon} style={{ background: bg, color }}>{letter}</div>
          {label}
        </button>
      ))}
    </>
  )
}

function LoginView({ onSwitch, onClose }) {
  const { login, authError, setAuthError } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) {
      setAuthError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    const ok = await login(email, password)
    if (ok) onClose()  // 성공할 때만 닫기
  }

  return (
    <>
      <button className={styles.closeBtn} onClick={onClose}>✕</button>
      <div className={styles.header}><Logo /><h2>다시 만나요!</h2><p>계속하려면 로그인하세요</p></div>
      <div className={styles.body}>
        {authError && <div className={styles.errorBox}>{authError}</div>}
        <div className={styles.hintBox}>테스트 계정: hong@test.com / test1234</div>
        <div className={styles.field}>
          <label>이메일</label>
          <input type="email" placeholder="hong@test.com" value={email} onChange={e => { setEmail(e.target.value); setAuthError('') }} />
        </div>
        <div className={styles.field}>
          <label>비밀번호</label>
          <input type="password" placeholder="test1234" value={password}
            onChange={e => { setPassword(e.target.value); setAuthError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        <button className={styles.forgot}>비밀번호를 잊으셨나요?</button>
        <button className={styles.btnSubmit} onClick={handleSubmit}>로그인</button>
        <SocialButtons />
      </div>
      <div className={styles.footer}>
        아직 계정이 없으신가요?{' '}
        <button className={styles.switchBtn} onClick={() => { setAuthError(''); onSwitch() }}>회원가입</button>
      </div>
    </>
  )
}

function SignupView({ onSwitch, onClose }) {
  const { signup, authError, setAuthError } = useApp()
  const [form, setForm] = useState({ lastName: '', firstName: '', email: '', password: '' })
  const [agreed, setAgreed] = useState(false)
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setAuthError('') }

  const handleSubmit = async () => {
    if (!form.lastName || !form.firstName || !form.email || !form.password) {
      setAuthError('모든 항목을 입력해주세요.')
      return
    }
    if (form.password.length < 8) {
      setAuthError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (!agreed) {
      setAuthError('이용약관에 동의해주세요.')
      return
    }
    const ok = await signup(form)
    if (ok) onClose()  // 성공할 때만 닫기
  }

  return (
    <>
      <button className={styles.closeBtn} onClick={onClose}>✕</button>
      <div className={styles.header}><Logo /><h2>크런치 시작하기</h2><p>무료로 가입하고 전문가를 만나보세요</p></div>
      <div className={styles.body}>
        {authError && <div className={styles.errorBox}>{authError}</div>}
        <div className={styles.fieldRow}>
          <div className={styles.field}><label>성</label><input type="text" placeholder="홍" value={form.lastName} onChange={e => set('lastName', e.target.value)} /></div>
          <div className={styles.field}><label>이름</label><input type="text" placeholder="길동" value={form.firstName} onChange={e => set('firstName', e.target.value)} /></div>
        </div>
        <div className={styles.field}><label>이메일</label><input type="email" placeholder="example@email.com" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div className={styles.field}>
          <label>비밀번호</label>
          <input type="password" placeholder="8자 이상 입력" value={form.password}
            onChange={e => set('password', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
          <span><a href="#">이용약관</a> 및 <a href="#">개인정보처리방침</a>에 동의합니다</span>
        </label>
        <button className={styles.btnSubmit} onClick={handleSubmit}>회원가입</button>
        <SocialButtons />
      </div>
      <div className={styles.footer}>
        이미 계정이 있으신가요?{' '}
        <button className={styles.switchBtn} onClick={() => { setAuthError(''); onSwitch() }}>로그인</button>
      </div>
    </>
  )
}
