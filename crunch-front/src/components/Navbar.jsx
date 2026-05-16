import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'
import api from '../lib/api'
import styles from './Navbar.module.css'

const isFreelancer = (user) => user?.role === 'freelancer'

export default function Navbar({ activePage, onNavigate, onLogin, onSignup, theme, onToggleTheme }) {
  const { currentUser, logout } = useApp()
  const currentUserId = currentUser?.id
  const freelancer = isFreelancer(currentUser)
  const isDark = theme === 'dark'
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [noticeOpen, setNoticeOpen] = useState(false)

  useEffect(() => {
    if (!currentUserId) return

    api.get('/api/mypage/notifications')
      .then(({ data }) => {
        setNotifications(data.data.notifications)
        setUnreadCount(data.data.unreadCount)
      })
      .catch(console.error)
  }, [currentUserId])

  const toggleNotifications = async () => {
    const nextOpen = !noticeOpen
    setNoticeOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      try {
        await api.patch('/api/mypage/notifications/read')
        setUnreadCount(0)
        setNotifications(prev => prev.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
      } catch (err) {
        console.error(err)
      }
    }
  }

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
            onClick={() => onNavigate('admin-dashboard')}>
            어드민
          </button>
        )}
      </div>

      <div className={styles.navActions}>
        <button
          className={styles.themeToggle}
          type="button"
          onClick={onToggleTheme}
          title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
        </button>
        {currentUser ? (
          <>
            <div className={styles.noticeWrap}>
              <button
                className={styles.themeToggle}
                type="button"
                onClick={toggleNotifications}
                title="알림"
                aria-label="알림"
              >
                <span aria-hidden="true">!</span>
                {unreadCount > 0 && <span className={styles.noticeBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {noticeOpen && (
                <div className={styles.noticePanel}>
                  <div className={styles.noticeHeader}>알림</div>
                  {notifications.length === 0 ? (
                    <div className={styles.noticeEmpty}>새 알림이 없습니다.</div>
                  ) : notifications.map(item => (
                    <button
                      key={item.id}
                      className={styles.noticeItem}
                      onClick={() => {
                        setNoticeOpen(false)
                        onNavigate(item.link || 'mypage-notifications')
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              className={styles.userAvatar}
              style={{
                background: currentUser.avatarUrl ? undefined : currentUser.avatarBg,
                color: currentUser.avatarColor,
                cursor: 'pointer',
              }}
              onClick={() => onNavigate('mypage')}
              title="마이 페이지"
            >
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className={styles.userAvatarImg} referrerPolicy="no-referrer" />
              ) : (
                currentUser.avatar ?? currentUser.name?.[0]
              )}
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
