import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import authRouter from './routes/auth.route'
import serviceRouter from './routes/service.route'
import freelancerRouter from './routes/freelancer.route'
import orderRouter from './routes/order.route'
import projectRouter from './routes/project.route'
import applicationRouter from './routes/application.route'
import adminRouter from './routes/admin.route'
import mypageRouter from './routes/mypage.route'
import proposalRouter from './routes/proposal.route'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

// ── 미들웨어 ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,   // 쿠키 전달 허용
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── 라우터 ────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/services', serviceRouter)
app.use('/api/freelancers', freelancerRouter)
app.use('/api/orders', orderRouter)
app.use('/api/projects', projectRouter)
app.use('/api/applications', applicationRouter)
app.use('/api/admin', adminRouter)
app.use('/api/mypage', mypageRouter)
app.use('/api/proposals', proposalRouter)

// ── 헬스 체크 ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── 404 핸들러 ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: '요청한 경로를 찾을 수 없습니다.' })
})

// ── 전역 에러 핸들러 ──────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UnhandledError]', err)
  res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' })
})

// ── 서버 시작 ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중 → http://localhost:${PORT}`)
  console.log(`   환경: ${process.env.NODE_ENV ?? 'development'}`)
})

export default app
