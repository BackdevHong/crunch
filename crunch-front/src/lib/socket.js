import { io } from 'socket.io-client'

const socket = io(import.meta.env.VITE_API_URL ?? 'http://localhost:4000', {
  auth: { token: localStorage.getItem('accessToken') },
  autoConnect: false,
})

// 토큰 갱신 시 재연결
export function reconnectSocket() {
  socket.auth = { token: localStorage.getItem('accessToken') }
  if (socket.connected) socket.disconnect()
  socket.connect()
}

export default socket
