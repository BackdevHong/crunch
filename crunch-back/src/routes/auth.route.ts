import { Router } from 'express'
import { body } from 'express-validator'
import { signup, login, refresh, logout, me } from '../controllers/auth.controller'
import { authenticate } from '../middlewares/authenticate'

const router = Router()

// ── 유효성 검사 규칙 ──────────────────────────────────────────
const signupRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('이름을 입력해주세요.')
    .isLength({ min: 2, max: 50 }).withMessage('이름은 2~50자 사이여야 합니다.'),

  body('email')
    .trim()
    .notEmpty().withMessage('이메일을 입력해주세요.')
    .isEmail().withMessage('올바른 이메일 형식이 아닙니다.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('비밀번호를 입력해주세요.')
    .isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다.')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('비밀번호는 영문과 숫자를 모두 포함해야 합니다.'),

  body('role')
    .optional()
    .isIn(['client', 'freelancer']).withMessage('role 은 client 또는 freelancer 만 허용됩니다.'),
]

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일을 입력해주세요.')
    .isEmail().withMessage('올바른 이메일 형식이 아닙니다.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('비밀번호를 입력해주세요.'),
]

// ── 라우트 ────────────────────────────────────────────────────
// POST /api/auth/signup
router.post('/signup', signupRules, signup)

// POST /api/auth/login
router.post('/login', loginRules, login)

// POST /api/auth/refresh  — refresh token 으로 access token 재발급
router.post('/refresh', refresh)

// POST /api/auth/logout
router.post('/logout', logout)

// GET  /api/auth/me  — 인증 필요
router.get('/me', authenticate, me)

export default router
