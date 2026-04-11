# 크런치 백엔드 API

Express + Prisma + MySQL + JWT 기반 REST API

## 시작하기

```bash
# 1. 패키지 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET 입력

# 3. Prisma 클라이언트 생성 + DB 동기화
npm run db:generate
npm run db:push        # 개발용 (스키마 그대로 적용)
# npm run db:migrate   # 마이그레이션 파일 생성 및 적용 (프로덕션 권장)

# 4. 개발 서버 실행
npm run dev
```

## API 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/signup` | ✗ | 회원가입 |
| POST | `/api/auth/login` | ✗ | 로그인 |
| POST | `/api/auth/refresh` | 쿠키 | Access Token 재발급 |
| POST | `/api/auth/logout` | 쿠키 | 로그아웃 |
| GET | `/api/auth/me` | Bearer | 내 정보 조회 |
| GET | `/health` | ✗ | 서버 상태 확인 |

## 요청/응답 예시

### 회원가입
```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "홍길동",
  "email": "hong@example.com",
  "password": "password123",
  "role": "client"
}
```
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "홍길동", "email": "hong@example.com", "role": "client" },
    "accessToken": "eyJhbGci..."
  }
}
```

### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "hong@example.com",
  "password": "password123"
}
```

### 인증이 필요한 요청
```http
GET /api/auth/me
Authorization: Bearer eyJhbGci...
```

### Refresh Token 재발급
```http
POST /api/auth/refresh
# refreshToken 쿠키가 자동으로 전송됨 (HttpOnly)
```

## 인증 흐름

```
로그인/회원가입
  → Access Token (15분, 응답 body)
  → Refresh Token (7일, HttpOnly 쿠키)

Access Token 만료 시
  → POST /api/auth/refresh
  → 새 Access Token + 새 Refresh Token (Rotation)

로그아웃
  → DB의 refreshToken 삭제
  → 쿠키 제거
```

## 환경변수

| 키 | 설명 | 기본값 |
|----|------|--------|
| `PORT` | 서버 포트 | `4000` |
| `DATABASE_URL` | MySQL 연결 문자열 | - |
| `JWT_ACCESS_SECRET` | Access Token 서명 키 | - |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 키 | - |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 유효기간 | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 유효기간 | `7d` |
| `CLIENT_URL` | CORS 허용 프론트 주소 | `http://localhost:5173` |
| `BCRYPT_ROUNDS` | bcrypt 해싱 라운드 | `12` |
