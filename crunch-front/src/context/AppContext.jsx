import { createContext, useContext, useState } from 'react'
import { MOCK_USERS, MOCK_SERVICES, MOCK_FREELANCERS } from '../data/mockData'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // ── 인증 상태 ──
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')

  // ── 데이터 ──
  const [services] = useState(MOCK_SERVICES)
  const [freelancers] = useState(MOCK_FREELANCERS)
  const [projects, setProjects] = useState([])

  // ── 상세 페이지 ──
  const [selectedService, setSelectedService] = useState(null)
  const [selectedFreelancer, setSelectedFreelancer] = useState(null)

  // ── 로그인 ──
  const login = (email, password) => {
    const user = MOCK_USERS.find(u => u.email === email && u.password === password)
    if (user) {
      setCurrentUser(user)
      setAuthError('')
      return true
    }
    setAuthError('이메일 또는 비밀번호가 올바르지 않습니다.')
    return false
  }

  // ── 회원가입 ──
  const signup = ({ firstName, lastName, email, password }) => {
    const exists = MOCK_USERS.find(u => u.email === email)
    if (exists) {
      setAuthError('이미 사용 중인 이메일입니다.')
      return false
    }
    const newUser = {
      id: Date.now(),
      name: `${lastName}${firstName}`,
      email,
      password,
      avatar: lastName[0] || '?',
      avatarBg: '#E6F1FB',
      avatarColor: '#185FA5',
    }
    MOCK_USERS.push(newUser)
    setCurrentUser(newUser)
    setAuthError('')
    return true
  }

  // ── 로그아웃 ──
  const logout = () => {
    setCurrentUser(null)
  }

  // ── 프로젝트 등록 ──
  const addProject = (projectData) => {
    const newProject = {
      id: Date.now(),
      ...projectData,
      authorId: currentUser?.id,
      authorName: currentUser?.name || '익명',
      createdAt: new Date().toISOString(),
      status: '모집중',
    }
    setProjects(prev => [newProject, ...prev])
    return newProject
  }

  return (
    <AppContext.Provider value={{
      // auth
      currentUser, authError, setAuthError, login, signup, logout,
      // data
      services, freelancers, projects,
      // detail
      selectedService, setSelectedService,
      selectedFreelancer, setSelectedFreelancer,
      // actions
      addProject,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
