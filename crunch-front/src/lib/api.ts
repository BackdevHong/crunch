import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  withCredentials: true, // refreshToken 쿠키 자동 전송
})

// 요청 인터셉터 — Authorization 헤더 자동 주입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // 로그인/회원가입 요청은 401 재시도 제외
    const isAuthEndpoint = original.url?.includes('/api/auth/login') ||
                           original.url?.includes('/api/auth/signup') ||
                           original.url?.includes('/api/auth/refresh')

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newToken = data.data.accessToken
        localStorage.setItem('accessToken', newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        localStorage.removeItem('accessToken')
        window.location.href = '/'
      }
    }

    return Promise.reject(error)
  }
)

export default api