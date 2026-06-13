import { useState, useEffect } from 'react'
import './styles/global.css'
import { useApp } from './context/useApp'
import { AppProvider } from './context/AppProvider'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import AuthModal from './components/AuthModal'
import ChatPage from './pages/ChatPage'
import CallModal from './components/CallModal'
import HomePage from './pages/HomePage'
import FindServices from './pages/FindServices'
import FindFreelancers from './pages/FindFreelancers'
import PostProject from './pages/PostProject'
import ServiceDetail from './pages/ServiceDetail'
import FreelancerDetail from './pages/FreelancerDetail'
import ApplyFreelancer from './pages/ApplyFreelancer'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminApplications from './pages/admin/AdminApplications'
import AdminUsers from './pages/admin/AdminUsers'
import AdminServices from './pages/admin/AdminServices'
import AdminProjects from './pages/admin/AdminProjects'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import MyPage from './pages/MyPage'
import PostService from './pages/PostService'
import BrowseProjects from './pages/BrowseProjects'
import socket, { reconnectSocket } from './lib/socket'

const THEME_STORAGE_KEY = 'crunch-theme'

const MYPAGE_TAB_ROUTES = {
  'mypage-profile': '프로필',
  'mypage-account': '계정 설정',
  'mypage-notifications': '알림',
  'mypage-services': '내 서비스',
  'mypage-orders': '주문 내역',
  'mypage-sales': '판매 내역',
  'mypage-projects': '내 프로젝트',
  'mypage-proposals': '내 제안',
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialAuthModal() {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  if (params.get('emailVerification')) return 'login'
  return params.get('oauth') && params.get('error') && params.get('link') !== '1' ? 'login' : null
}

function getInitialPage() {
  if (typeof window === 'undefined') return 'home'

  const page = new URLSearchParams(window.location.search).get('page')
  return MYPAGE_TAB_ROUTES[page] ? 'mypage' : 'home'
}

function getInitialMyPageTab() {
  if (typeof window === 'undefined') return '프로필'

  const page = new URLSearchParams(window.location.search).get('page')
  return MYPAGE_TAB_ROUTES[page] ?? '프로필'
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

function AppInner() {
  const { selectedService, selectedFreelancer, setSelectedService, setSelectedFreelancer, authLoading, currentUser, editingProject, setEditingProject } = useApp()
  const currentUserId = currentUser?.id
  const [activePage, setActivePage] = useState(getInitialPage)
  const [myPageInitialTab, setMyPageInitialTab] = useState(getInitialMyPageTab)
  const [authModal, setAuthModal] = useState(getInitialAuthModal)
  const [callInfo, setCallInfo] = useState(null) // { channelId, channelName }
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // 로그인 시 소켓 연결, 로그아웃 시 해제
  useEffect(() => {
    if (currentUserId) {
      reconnectSocket()
    } else {
      socket.disconnect()
    }
  }, [currentUserId])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b6b67', fontSize: '14px' }}>
        불러오는 중...
      </div>
    )
  }

  // 로그인/시작하기는 상세 페이지 유지한 채 모달만 열기
  const openLogin = () => setAuthModal('login')
  const openSignup = () => setAuthModal('signup')

  // 페이지 이동 시에만 상세 상태 초기화
  const navigate = (page) => {
    const targetPage = MYPAGE_TAB_ROUTES[page] ? 'mypage' : page
    const targetTab = MYPAGE_TAB_ROUTES[page]

    if ((targetPage === 'post' || targetPage === 'apply' || targetPage === 'mypage' || targetPage === 'post-service' || targetPage === 'browse-projects' || targetPage === 'chat') && !currentUser) {
      openLogin()
      return
    }
    if ((targetPage === 'post-service' || targetPage === 'browse-projects') && currentUser?.role !== 'freelancer') return
    if (targetPage.startsWith('admin') && currentUser?.role !== 'admin') return
    setSelectedService(null)
    setSelectedFreelancer(null)
    if (targetPage !== 'post') setEditingProject(null)
    if (targetTab) setMyPageInitialTab(targetTab)
    if (targetPage !== 'mypage') setMyPageInitialTab('프로필')
    setActivePage(targetPage)
  }


  const nav = (
    <Navbar
      activePage={activePage}
      onNavigate={navigate}
      onLogin={openLogin}
      onSignup={openSignup}
      theme={theme}
      onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
    />
  )

  return (
    <>
      {nav}

      {/* 상세 페이지: selectedService/Freelancer가 있을 때만 표시, 뒤 페이지는 유지 */}
      {selectedService && <ServiceDetail />}
      {selectedFreelancer && <FreelancerDetail onNavigate={navigate} />}

      {/* 상세 페이지가 열려있을 때는 뒤 콘텐츠를 숨김 (display:none 대신 조건부 렌더) */}
      {!selectedService && !selectedFreelancer && (
        <>
          {activePage === 'home' && (
            <>
              <HomePage onNavigate={navigate} onSignup={openSignup} />
              <Footer />
            </>
          )}
          {activePage === 'services' && (
            <>
              <FindServices />
              <Footer />
            </>
          )}
          {activePage === 'freelancers' && (
            <>
              <FindFreelancers />
              <Footer />
            </>
          )}
          {activePage === 'post' && (
            currentUser
              ? <PostProject onNavigate={navigate} onSignup={openSignup} editingProject={editingProject} />
              : (() => {
                  // 로그인 안 된 상태로 접근 시 로그인 모달 띄우고 홈으로
                  openLogin()
                  navigate('home')
                  return null
                })()
          )}
          {activePage === 'apply' && (
            <ApplyFreelancer onNavigate={navigate} />
          )}
          {activePage === 'admin-dashboard' && (
            <AdminDashboard activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-applications' && (
            <AdminApplications activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-users' && (
            <AdminUsers activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-services' && (
            <AdminServices activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-projects' && (
            <AdminProjects activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-audit-logs' && (
            <AdminAuditLogs activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'browse-projects' && (
            <>
              <BrowseProjects />
              <Footer />
            </>
          )}
          {activePage === 'post-service' && (
            <PostService onNavigate={navigate} />
          )}
          {activePage === 'mypage' && (
            <>
              <MyPage key={myPageInitialTab} initialTab={myPageInitialTab} onNavigate={navigate} />
              <Footer />
            </>
          )}
          {activePage === 'chat' && (
            <ChatPage
              onStartCall={(info) => setCallInfo(info)}
              activeCallChannelId={callInfo?.channelId}
            />
          )}
        </>
      )}

      {authModal && (
        <AuthModal
          initialView={authModal}
          onClose={() => setAuthModal(null)}
        />
      )}

      {/* 채팅 플로팅 버튼 — 채팅 페이지로 이동 */}
      {currentUser && activePage !== 'chat' && (
        <button
          onClick={() => navigate('chat')}
          style={{
            position: 'fixed', bottom: '28px', right: '28px', zIndex: 100,
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'var(--color-accent)', border: 'none',
            color: 'white', fontSize: '22px', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="채팅"
        >
          💬
        </button>
      )}

      {/* 그룹 통화 모달 */}
      {callInfo && (
        <CallModal
          callInfo={callInfo}
          onClose={() => setCallInfo(null)}
        />
      )}
    </>
  )
}
