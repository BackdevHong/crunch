import { useApp } from '../context/AppContext'
import styles from './Navbar.module.css'

const NAV_ITEMS = [
  { label: '홈', page: 'home' },
  { label: '서비스 찾기', page: 'services' },
  { label: '프리랜서 찾기', page: 'freelancers' },
  { label: '프로젝트 올리기', page: 'post' },
]

export default function Navbar({ activePage, onNavigate, onLogin, onSignup }) {
  const { currentUser, logout } = useApp()

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
        {NAV_ITEMS.map(({ label, page }) => (
          <button
            key={page}
            className={`${styles.navLink} ${activePage === page ? styles.active : ''}`}
            onClick={() => onNavigate(page)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.navActions}>
        {currentUser ? (
          <>
            <div className={styles.userAvatar} style={{ background: currentUser.avatarBg, color: currentUser.avatarColor }}>
              {currentUser.avatar}
            </div>
            <span className={styles.userName}>{currentUser.name}</span>
            <button className={styles.btnGhost} onClick={logout}>로그아웃</button>
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
