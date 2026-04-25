import { useApp } from '../context/useApp'
import styles from './Navbar.module.css'

const isFreelancer = (user) => user?.role === 'freelancer'

export default function Navbar({ activePage, onNavigate, onLogin, onSignup }) {
  const { currentUser, logout } = useApp()
  const freelancer = isFreelancer(currentUser)

  const navItems = [
    { label: '홈', page: 'home' },
    { label: '서비스 찾기', page: 'services' },
    { label: '프리랜서 찾기', page: 'freelancers' },
    freelancer
      ? { label: '프로젝트 보기', page: 'browse-projects' }
      : { label: '프로젝트 올리기', page: 'post' },
    { label: '프리랜서 신청', page: 'apply' },
  ]

  return (
    <nav className={styles.nav}>
      <a className={styles.logo} onClick={() => onNavigate('home')} href="#">
        <div className={styles.logoMark}>
          <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        크런치
      </a>

      <div className={styles.navLinks}>
        {navItems.map(({ label, page }) => (
          <button
            key={page}
            className={`${styles.navLink} ${activePage === page ? styles.active : ''}`}
            onClick={() => onNavigate(page)}
          >
            {label}
          </button>
        ))}
        {freelancer && (
          <button
            className={`${styles.navLink} ${activePage === 'post-service' ? styles.active : ''}`}
            onClick={() => onNavigate('post-service')}>
            서비스 올리기
          </button>
        )}
        {currentUser?.role === 'admin' && (
          <button
            className={`${styles.navLink} ${activePage.startsWith('admin') ? styles.active : ''}`}
            onClick={() => onNavigate('admin-applications')}>
            어드민
          </button>
        )}
      </div>

      <div className={styles.navActions}>
        {currentUser ? (
          <>
            <div
              className={styles.userAvatar}
              style={{ background: currentUser.avatarBg, color: currentUser.avatarColor, cursor: 'pointer' }}
              onClick={() => onNavigate('mypage')}
              title="마이 페이지"
            >
              {currentUser.avatar ?? currentUser.name?.[0]}
            </div>
            <span
              className={styles.userName}
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigate('mypage')}
            >
              {currentUser.name}
            </span>
            <button className={styles.btnGhost} onClick={async () => { await logout(); onNavigate('home') }}>로그아웃</button>
          </>
        ) : (
          <>
            <button className={styles.btnGhost} onClick={onLogin}>로그인</button>
            <button className={styles.btnPrimary} onClick={onSignup}>시작하기</button>
          </>
        )}
      </div>
    </nav>
  )
}
