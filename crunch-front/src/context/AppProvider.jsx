import { useState, useEffect } from 'react'
import { AppContext } from './AppContext'
import api from '../lib/api'

const OAUTH_PROVIDER_LABEL = {
  google: 'Google',
  naver: '네이버',
  kakao: '카카오',
}

const OAUTH_ERROR_MESSAGE = {
  invalid_state: '로그인 요청이 만료되었습니다. 다시 시도해주세요.',
  email_not_verified: 'Google 계정의 이메일 인증이 필요합니다.',
  email_not_provided: '이메일 제공 동의가 필요합니다. 소셜 계정 동의 항목을 확인해주세요.',
  callback_failed: '소셜 계정 인증을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  provider_in_use: '이미 다른 계정에 연결된 소셜 계정입니다.',
  account_not_found: '연결할 계정을 찾을 수 없습니다. 다시 로그인해주세요.',
  access_denied: '소셜 로그인 동의가 취소되었습니다.',
}

function getOAuthErrorMessage(provider, error, linkMode = false) {
  const providerLabel = OAUTH_PROVIDER_LABEL[provider] ?? '소셜'
  const detail = OAUTH_ERROR_MESSAGE[error] ?? '로그인 처리 중 오류가 발생했습니다.'
  return `${providerLabel} ${linkMode ? '계정 연결' : '로그인'} 실패: ${detail}`
}

function getEmailVerificationMessage(status) {
  const messages = {
    success: '이메일 인증이 완료되었습니다. 로그인해주세요.',
    invalid: '인증 링크가 만료되었거나 올바르지 않습니다.',
    failed: '이메일 인증 처리 중 오류가 발생했습니다.',
    missing_token: '인증 토큰이 없습니다.',
  }
  return messages[status] ?? '이메일 인증 상태를 확인해주세요.'
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(true)

  const [services, _setServices] = useState([])
  const [freelancers, _setFreelancers] = useState([])
  const [projects, setProjects] = useState([])

  const [selectedService, setSelectedService] = useState(null)
  const [selectedFreelancer, setSelectedFreelancer] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [editingProject, setEditingProject] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('accessToken')
    const oauthProvider = params.get('oauth')
    const oauthError = params.get('error')
    const oauthLinked = params.get('linked')
    const oauthLinkMode = params.get('link') === '1'
    const emailVerification = params.get('emailVerification')

    if (oauthToken) {
      localStorage.setItem('accessToken', oauthToken)
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (oauthProvider && oauthError) {
      setAuthError(getOAuthErrorMessage(oauthProvider, oauthError, oauthLinkMode))
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (oauthProvider && oauthLinked) {
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (emailVerification) {
      setAuthError(getEmailVerificationMessage(emailVerification))
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    const token = oauthToken || localStorage.getItem('accessToken')
    if (!token) {
      setAuthLoading(false)
      return
    }

    api.get('/api/auth/me')
      .then(({ data }) => setCurrentUser(data.data))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setAuthLoading(false))
  }, [])

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

  const signup = async ({ lastName, firstName, email, password }) => {
    setAuthError('')
    try {
      const { data } = await api.post('/api/auth/signup', {
        name: `${lastName}${firstName}`,
        email,
        password,
      })
      setAuthError(data.data?.message ?? '인증 메일을 보냈습니다. 이메일 인증 후 로그인해주세요.')
      return true
    } catch (err) {
      setAuthError(err.response?.data?.message ?? '회원가입 중 오류가 발생했습니다.')
      return false
    }
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      localStorage.removeItem('accessToken')
      setCurrentUser(null)
    }
  }

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
      editingService, setEditingService,
      editingProject, setEditingProject,
    }}>
      {children}
    </AppContext.Provider>
  )
}
