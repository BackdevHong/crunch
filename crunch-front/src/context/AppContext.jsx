import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { MOCK_SERVICES, MOCK_FREELANCERS } from '../data/mockData'

export const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(true) // 초기 인증 확인 중

  const [services, _setServices] = useState([])
  const [freelancers, _setFreelancers] = useState([])
  const [projects, setProjects] = useState([])

  const [selectedService, setSelectedService] = useState(null)
  const [selectedFreelancer, setSelectedFreelancer] = useState(null)

  // ── 앱 시작 시 로그인 상태 복원 ──────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setAuthLoading(false)
      return
    }
    api.get('/api/auth/me')
      .then(({ data }) => setCurrentUser(data.data))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setAuthLoading(false))
  }, [])

  // ── 로그인 ───────────────────────────────────────────────────
  const login = async (email, password) => {
    setAuthError('')
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      localStorage.setItem('accessToken', data.data.accessToken)
      setCurrentUser(data.data.user)
      return true
    } catch (err) {
      setAuthError(err.response?.data?.message ?? '로그인 중 오류가 발생했습니다.')
      return false
    }
  }

  // ── 회원가입 ─────────────────────────────────────────────────
  const signup = async ({ lastName, firstName, email, password }) => {
    setAuthError('')
    try {
      const { data } = await api.post('/api/auth/signup', {
        name: `${lastName}${firstName}`,
        email,
        password,
      })
      localStorage.setItem('accessToken', data.data.accessToken)
      setCurrentUser(data.data.user)
      return true
    } catch (err) {
      setAuthError(err.response?.data?.message ?? '회원가입 중 오류가 발생했습니다.')
      return false
    }
  }

  // ── 로그아웃 ─────────────────────────────────────────────────
  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      localStorage.removeItem('accessToken')
      setCurrentUser(null)
    }
  }

  // ── 프로젝트 등록 ─────────────────────────────────────────────
  const addProject = (projectData) => {
    const newProject = {
      id: Date.now(),
      ...projectData,
      authorId: currentUser?.id,
      authorName: currentUser?.name ?? '익명',
      createdAt: new Date().toISOString(),
      status: '모집중',
    }
    setProjects(prev => [newProject, ...prev])
    return newProject
  }

  return (
    <AppContext.Provider value={{
      currentUser, authError, setAuthError, authLoading,
      login, signup, logout,
      services, freelancers, projects, addProject,
      selectedService, setSelectedService,
      selectedFreelancer, setSelectedFreelancer,
    }}>
      {children}
    </AppContext.Provider>
  )
}