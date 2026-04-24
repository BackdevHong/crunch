import { useState } from 'react'
import './styles/global.css'
import { useApp } from '../context/useApp'
import { AppProvider } from './context/AppProvider'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import AuthModal from './components/AuthModal'
import HomePage from './pages/HomePage'
import FindServices from './pages/FindServices'
import FindFreelancers from './pages/FindFreelancers'
import PostProject from './pages/PostProject'
import ServiceDetail from './pages/ServiceDetail'
import FreelancerDetail from './pages/FreelancerDetail'
import ApplyFreelancer from './pages/ApplyFreelancer'
import AdminApplications from './pages/admin/AdminApplications'
import AdminUsers from './pages/admin/AdminUsers'
import AdminServices from './pages/admin/AdminServices'
import MyPage from './pages/MyPage'

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

function AppInner() {
  const { selectedService, selectedFreelancer, setSelectedService, setSelectedFreelancer, authLoading, currentUser } = useApp()
  const [activePage, setActivePage] = useState('home')
  const [authModal, setAuthModal] = useState(null)

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
    if ((page === 'post' || page === 'apply' || page === 'mypage') && !currentUser) {
      openLogin()
      return
    }
    if (page.startsWith('admin') && currentUser?.role !== 'admin') return
    setSelectedService(null)
    setSelectedFreelancer(null)
    setActivePage(page)
  }


  const nav = (
    <Navbar
      activePage={activePage}
      onNavigate={navigate}
      onLogin={openLogin}
      onSignup={openSignup}
    />
  )

  return (
    <>
      {nav}

      {/* 상세 페이지: selectedService/Freelancer가 있을 때만 표시, 뒤 페이지는 유지 */}
      {selectedService && <ServiceDetail />}
      {selectedFreelancer && <FreelancerDetail />}

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
              ? <PostProject onNavigate={navigate} onSignup={openSignup} />
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
          {activePage === 'admin-applications' && (
            <AdminApplications activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-users' && (
            <AdminUsers activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'admin-services' && (
            <AdminServices activePage={activePage} onNavigate={navigate} />
          )}
          {activePage === 'mypage' && (
            <>
              <MyPage onNavigate={navigate} />
              <Footer />
            </>
          )}
        </>
      )}

      {authModal && (
        <AuthModal
          initialView={authModal}
          onClose={() => setAuthModal(null)}
        />
      )}
    </>
  )
}
