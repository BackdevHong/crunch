# 크런치 (Crunch)
[![CI](https://github.com/BackdevHong/crunch/actions/workflows/ci.yml/badge.svg)](https://github.com/BackdevHong/crunch/actions/workflows/ci.yml)

프리랜서와 클라이언트를 연결하는 서비스 중개 플랫폼입니다. 클라이언트는 프로젝트를 의뢰하거나 판매 중인 서비스를 구매할 수 있고, 프리랜서는 자신을 홍보하고 제안서를 보내거나 주문을 처리할 수 있습니다. 어드민 영역에서는 프리랜서 신청 승인·거절, 사용자 관리, 서비스 활성화 관리를 수행할 수 있습니다.

> 레포지토리: https://github.com/BackdevHong/crunch

---

## 프로젝트 구성

본 레포지토리는 **모노레포 형태**로 두 개의 하위 프로젝트를 포함합니다.

```
crunch/
├── crunch-back/     # Express + Prisma + MySQL REST API 서버
└── crunch-front/    # React 19 + Vite 기반 SPA 클라이언트
```

---

## 기술 스택

### 백엔드 (`crunch-back`)

- **런타임/언어**: Node.js, TypeScript 5
- **프레임워크**: Express 4
- **ORM**: Prisma 5 (MySQL)
- **인증**: JSON Web Token (Access + Refresh 토큰 회전), bcryptjs
- **유효성 검사**: express-validator
- **기타**: cors, cookie-parser, morgan, dotenv

### 프론트엔드 (`crunch-front`)

- **프레임워크**: React 19
- **빌드 도구**: Vite 8
- **HTTP 클라이언트**: Axios
- **스타일**: CSS Modules + 전역 CSS
- **상태 관리**: React Context (`AppContext`)
- **코드 품질**: ESLint 9

---

## 주요 기능

- **회원가입 / 로그인 / 로그아웃**: Access Token + HttpOnly Refresh Token 조합, 토큰 회전(Rotation) 방식
- **역할(Role)**: `client`, `freelancer`, `admin` 세 가지 권한 구분
- **서비스 탐색 및 상세 조회**: 카테고리별 (개발·IT, 디자인, 마케팅, 글쓰기·번역, 영상·사진, 음악·오디오) 서비스 목록/상세
- **프리랜서 탐색 및 상세 조회**: 배지(Top/Pro/New), 평점, 시간당 단가, 스킬 태그 기반 필터링
- **프로젝트 의뢰(Post Project)**: 클라이언트가 예산·기한·카테고리를 지정해 프로젝트 게시
- **프리랜서 전환 신청**: 일반 사용자가 프리랜서 신청서 제출 → 어드민 승인 시 `freelancer` 권한 부여
- **주문(Order)**: 서비스 결제 → 진행중 → 검수중 → 완료 등 상태 관리
- **마이페이지**: 내 프로필, 구매 내역, 판매 내역, 의뢰한 프로젝트 확인
- **관리자 페이지**: 프리랜서 신청 관리, 사용자 역할 변경, 서비스 활성화 토글

---

## 디렉터리 구조

### 백엔드

```
crunch-back/
├── prisma/
│   └── schema.prisma        # User, Freelancer, Service, Project, Order, Review, Message ...
├── src/
│   ├── index.ts             # Express 엔트리 (라우트 등록, CORS, 에러 핸들러)
│   ├── controllers/         # auth, service, freelancer, order, project, application, admin, mypage
│   ├── routes/              # 각 도메인별 라우터
│   ├── middlewares/         # authenticate, requireAdmin
│   └── lib/                 # jwt, prisma, response, api, contains
├── package.json
└── tsconfig.json
```

### 프론트엔드

```
crunch-front/
├── index.html
├── vite.config.js
├── .env                     # VITE_API_URL
└── src/
    ├── main.jsx
    ├── App.jsx              # 페이지 라우팅 및 인증 모달 관리
    ├── context/AppContext.jsx
    ├── components/          # Navbar, Footer, AuthModal, Hero, ServiceCard, FreelancerCard, StatsBar, Sidebar ...
    ├── pages/               # HomePage, FindServices, FindFreelancers, PostProject, ServiceDetail,
    │                        # FreelancerDetail, ApplyFreelancer, MyPage, admin/*
    ├── lib/api.ts           # axios 인스턴스 및 API 호출 래퍼
    ├── data/mockData.js
    └── styles/global.css
```

---

## 사전 요구사항

- **Node.js** 18 이상 (권장 20 LTS)
- **npm** 9 이상
- **MySQL** 8.x (로컬 또는 원격, 빈 데이터베이스 하나 필요)

---

## 실행 방법

### 1. 레포지토리 클론

```bash
git clone https://github.com/BackdevHong/crunch.git
cd crunch
```

### 2. 백엔드 세팅 및 실행 (`crunch-back`)

```bash
cd crunch-back

# 2-1) 패키지 설치
npm install

# 2-2) 환경변수 파일 생성
# 프로젝트 루트에 .env 파일을 만들고 아래 값을 채워주세요.
```

`crunch-back/.env` 예시:

```env
PORT=4000
DATABASE_URL="mysql://root:비밀번호@localhost:3306/crunch"

JWT_ACCESS_SECRET="아무거나_충분히_긴_랜덤_문자열"
JWT_REFRESH_SECRET="또다른_충분히_긴_랜덤_문자열"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CLIENT_URL=http://localhost:5173
BCRYPT_ROUNDS=12
```

```bash
# 2-3) Prisma 클라이언트 생성
npm run db:generate

# 2-4) 스키마를 DB에 반영 (개발용)
npm run db:push
# 또는 마이그레이션 히스토리를 남기려면:
# npm run db:migrate

# 2-5) 개발 서버 실행 (기본 http://localhost:4000)
npm run dev
```

프로덕션 빌드/실행이 필요하면:

```bash
npm run build   # dist/ 로 컴파일
npm start       # node dist/index.js
```

서버가 정상 기동되었는지 확인:

```bash
curl http://localhost:4000/health
# => {"status":"ok","timestamp":"..."}
```

### 3. 프론트엔드 세팅 및 실행 (`crunch-front`)

새 터미널에서:

```bash
cd crunch-front

# 3-1) 패키지 설치
npm install

# 3-2) 환경변수 확인 (.env 파일)
# 기본값으로 http://localhost:4000 을 바라보도록 설정되어 있습니다.
```

`crunch-front/.env` 기본값:

```env
VITE_API_URL=http://localhost:4000
```

```bash
# 3-3) 개발 서버 실행 (기본 http://localhost:5173)
npm run dev
```

프로덕션 빌드/프리뷰:

```bash
npm run build     # dist/ 생성
npm run preview   # dist/ 프리뷰 서버 실행
```

### 4. 접속

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:4000
- Prisma Studio(선택): `cd crunch-back && npm run db:studio`

---

## API 엔드포인트 요약

모든 엔드포인트는 `/api` 접두어를 공유합니다. 인증이 필요한 엔드포인트는 `Authorization: Bearer <accessToken>` 헤더를 요구하며, `refresh`/`logout`은 HttpOnly 쿠키의 `refreshToken`을 사용합니다.

### 인증 (`/api/auth`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/signup` | ✗ | 회원가입 (`role`: `client` 또는 `freelancer`) |
| POST | `/login` | ✗ | 로그인, Access Token 반환 + Refresh 쿠키 발급 |
| POST | `/refresh` | 쿠키 | Access Token 재발급 + Refresh 토큰 회전 |
| POST | `/logout` | 쿠키 | Refresh 토큰 폐기 및 쿠키 제거 |
| GET  | `/me` | Bearer | 내 정보 조회 |

### 서비스 (`/api/services`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 서비스 목록 |
| GET | `/:id` | 서비스 상세 |

### 프리랜서 (`/api/freelancers`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 프리랜서 목록 |
| GET | `/:id` | 프리랜서 상세 |

### 프로젝트 (`/api/projects`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET  | `/` | ✗ | 프로젝트 목록 |
| GET  | `/me` | Bearer | 내가 등록한 프로젝트 |
| GET  | `/:id` | ✗ | 프로젝트 상세 |
| POST | `/` | Bearer | 프로젝트 의뢰 생성 |

### 주문 (`/api/orders`)

모든 엔드포인트 Bearer 인증 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST  | `/` | 주문 생성 (`serviceId`) |
| GET   | `/` | 내 주문 목록 |
| GET   | `/:id` | 주문 상세 |
| PATCH | `/:id/status` | 상태 변경 (`IN_PROGRESS`, `REVIEW`, `DONE`, `CANCELLED`) |

### 프리랜서 신청 (`/api/applications`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST  | `/` | Bearer | 프리랜서 전환 신청 |
| GET   | `/me` | Bearer | 내 신청 상태 조회 |
| GET   | `/` | Admin | 전체 신청 목록 |
| PATCH | `/:id/approve` | Admin | 신청 승인 → `freelancer` 권한 부여 |
| PATCH | `/:id/reject` | Admin | 신청 거절 |

### 마이페이지 (`/api/mypage`)

모든 엔드포인트 Bearer 인증 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET   | `/profile` | 내 프로필 조회 |
| PATCH | `/profile` | 내 프로필 수정 |
| PATCH | `/profile/freelancer` | 프리랜서 프로필 수정 |
| GET   | `/orders` | 내가 구매한 주문 |
| GET   | `/sales` | 내가 판매한 주문 |
| GET   | `/projects` | 내가 의뢰한 프로젝트 |

### 관리자 (`/api/admin`)

모든 엔드포인트 Admin 권한 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET   | `/users` | 사용자 목록 |
| PATCH | `/users/:id/role` | 사용자 역할 변경 |
| GET   | `/services` | 관리자용 서비스 목록 |
| PATCH | `/services/:id/active` | 서비스 활성화 토글 |

### 헬스 체크

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |

---

## 인증 흐름 요약

```
[회원가입 / 로그인]
   └─► Access Token (15분, 응답 body)
   └─► Refresh Token (7일, HttpOnly 쿠키)

[Access Token 만료]
   └─► POST /api/auth/refresh
        └─► 새 Access Token + 새 Refresh Token (Rotation)

[로그아웃]
   └─► DB refreshToken 삭제 + 쿠키 제거
```

프론트의 `src/lib/api.ts` 는 Axios 인터셉터로 401 응답을 받으면 자동으로 `/api/auth/refresh` 를 호출해 재로그인 없이 토큰을 갱신합니다.

---

## 데이터 모델 개요

Prisma 스키마에 정의된 주요 엔티티:

- **User**: 이름, 이메일, 해시 비밀번호, 역할(`client`/`freelancer`/`admin`), 리프레시 토큰
- **Freelancer**: 사용자 1:1, 배지(Top/Pro/New), 평점, 완료 건수, 시간당 단가, 카테고리
- **FreelancerApplication**: 프리랜서 전환 신청 (상태: PENDING/APPROVED/REJECTED)
- **Service**: 판매자가 등록하는 상품, 카테고리/가격/배송일/평점
- **Project**: 클라이언트가 올리는 의뢰 (상태: 모집중/진행중/완료/취소)
- **Proposal**: 프리랜서가 프로젝트에 제출하는 제안서
- **Order**: 서비스 결제·주문 (상태: 결제대기/진행중/검수중/완료/취소/환불)
- **Review**: 주문 완료 후 작성하는 리뷰 (1~5점)
- **Message**: 사용자 간 메시징 (주문과 연동 가능)

---

## 개발 팁

- Prisma 스키마를 수정한 뒤에는 반드시 `npm run db:generate` 를 실행해 타입을 갱신하세요.
- DB 스키마 내용을 초기화하고 싶다면 `npx prisma migrate reset` 을 사용할 수 있습니다(로컬 한정).
- 프론트는 기본 포트 `5173`, 백엔드는 기본 포트 `4000` 입니다. 포트를 바꾸면 백엔드의 `CLIENT_URL` 과 프론트의 `VITE_API_URL` 을 함께 맞춰야 합니다.
- 관리자 기능을 테스트하려면 우선 일반 계정을 만든 뒤 DB에서 해당 사용자의 `role` 을 `admin` 으로 바꿔주세요.

---

## 스크립트 모음

### 백엔드 (`crunch-back`)

| 명령 | 설명 |
|------|------|
| `npm run dev` | ts-node-dev 로 개발 서버 실행 (자동 재시작) |
| `npm run build` | TypeScript → `dist/` 로 컴파일 |
| `npm start` | 컴파일된 `dist/index.js` 실행 |
| `npm run db:generate` | Prisma Client 생성 |
| `npm run db:push` | 스키마를 DB에 바로 반영 |
| `npm run db:migrate` | 마이그레이션 파일 생성 및 적용 |
| `npm run db:studio` | Prisma Studio 실행 (DB GUI) |

### 프론트엔드 (`crunch-front`)

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint 실행 |

---

## 라이선스

레포지토리에 별도의 라이선스 파일이 포함되어 있지 않습니다. 사용/배포 전에 원작자에게 확인하시기 바랍니다.
