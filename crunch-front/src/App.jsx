import { useState } from 'react'
import './styles/global.css'
import { AppProvider, useApp } from './context/AppContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import AuthModal from './components/AuthModal'
import HomePage from './pages/HomePage'
import FindServices from './pages/FindServices'
import FindFreelancers from './pages/FindFreelancers'
import PostProject from './pages/PostProject'
import ServiceDetail from './pages/ServiceDetail'
import FreelancerDetail from './pages/FreelancerDetail'

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

function AppInner() {
  const { selectedService, selectedFreelancer, setSelectedService, setSelectedFreelancer } = useApp()
  const [activePage, setActivePage] = useState('home')
  const [authModal, setAuthModal] = useState(null)

  // 페이지 이동 시에만 상세 상태 초기화
  const navigate = (page) => {
    setSelectedService(null)
    setSelectedFreelancer(null)
    setActivePage(page)
  }

  // 로그인/시작하기는 상세 페이지 유지한 채 모달만 열기
  const openLogin = () => setAuthModal('login')
  const openSignup = () => setAuthModal('signup')

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
            <PostProject onNavigate={navigate} />
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
