import { useApp } from '../context/AppContext'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { label: '프리랜서 신청', page: 'admin-applications', icon: '📋' },
  { label: '유저 관리', page: 'admin-users', icon: '👥' },
  { label: '서비스 관리', page: 'admin-services', icon: '🛠' },
]

export default function AdminLayout({ children, activePage, onNavigate }) {
  const { currentUser, logout } = useApp()

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>🔧 크런치 어드민</div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <button key={item.page}
              className={`${styles.navItem} ${activePage === item.page ? styles.navActive : ''}`}
              onClick={() => onNavigate(item.page)}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.adminName}>{currentUser?.name}</div>
          <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>
        </div>
      </aside>

      <div className={styles.content}>{children}</div>
    </div>
  )
}