# iNote Server

> iNote 시리즈 공통 백엔드 API 서버 — NestJS + Prisma + Better Auth

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 언어 | TypeScript |
| 프레임워크 | NestJS |
| ORM | Prisma |
| 인증 | Better Auth (Google OAuth) |
| DB | PostgreSQL (Neon) |
| 배포 | Render |
| API 문서 | Swagger |

---

## 연결 서비스

| 서비스 | 레포 | 상태 |
|--------|------|------|
| inote-money | [seo337dc/inote-money](https://github.com/seo337dc/inote-money) | ✅ 개발 중 |
| inote-daily | — | 🚧 예정 |
| inote-goal | — | 🚧 예정 |

---

## 로컬 실행

### 1. 설치

```bash
git clone https://github.com/seo337dc/inote-server
cd inote-server
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 값 입력:

```bash
DATABASE_URL="postgresql://...?sslmode=require"   # Neon 연결 문자열
BETTER_AUTH_SECRET="..."                           # 랜덤 시크릿 (openssl rand -hex 32)
BETTER_AUTH_URL="http://localhost:3200"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
PORT=3200
```

> ⚠️ Neon DATABASE_URL에 `channel_binding=require` 옵션은 제거하세요. Prisma와 호환되지 않습니다.

### 3. DB 마이그레이션

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. 서버 실행

```bash
npm run start:dev
```

| URL | 설명 |
|-----|------|
| `http://localhost:3200` | API 서버 |
| `http://localhost:3200/api/docs` | Swagger API 문서 |
| `http://localhost:3200/api/v1/health` | 헬스 체크 |

---

## 프로젝트 구조

```
src/
├── main.ts               ← 진입점 (CORS, Swagger, 포트 설정)
├── app.module.ts         ← 루트 모듈
├── prisma/               ← PrismaService
├── auth/                 ← 인증 (Better Auth)
├── users/                ← 유저 관리
├── money/
│   ├── expenses/         ← 가계부 CRUD
│   ├── stocks/           ← 주식 CRUD
│   └── settings/         ← 내 정보 설정
└── points/               ← 포인트 (예정)
```

---

## API 목록

### 인증 (Better Auth)
| Method | URL | 설명 |
|--------|-----|------|
| POST | `/api/v1/auth/sign-in/social` | 소셜 로그인 |
| POST | `/api/v1/auth/sign-out` | 로그아웃 |
| GET | `/api/v1/auth/get-session` | 세션 조회 |

### 유저
| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/v1/users/me` | 내 정보 조회 |
| PATCH | `/api/v1/users/me` | 내 정보 수정 |

### 가계부
| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/v1/money/expenses` | 월별 지출 목록 |
| POST | `/api/v1/money/expenses` | 지출 추가 |
| PATCH | `/api/v1/money/expenses/:id` | 지출 수정 |
| DELETE | `/api/v1/money/expenses/:id` | 지출 삭제 |

### 주식
| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/v1/money/stocks` | 보유 종목 목록 |
| POST | `/api/v1/money/stocks` | 종목 추가 |
| PATCH | `/api/v1/money/stocks/:id` | 종목 수정 |
| DELETE | `/api/v1/money/stocks/:id` | 종목 삭제 |

### 자산 설정
| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/v1/money/settings` | 내 설정 조회 |
| PUT | `/api/v1/money/settings` | 내 설정 저장 |

---

## 인프라

```
FE  →  Vercel (inote-money)
BE  →  Render (이 서버) — https://inote-server-5a63.onrender.com
DB  →  Neon PostgreSQL
```

---

## 구현 현황

| 항목 | 상태 |
|------|------|
| NestJS 초기화 | ✅ 완료 |
| Swagger (`/api/docs`) | ✅ 완료 |
| Prisma + Neon DB 연결 | ✅ 완료 |
| DB 마이그레이션 | ✅ 완료 |
| Better Auth Google 소셜 로그인 | ✅ 완료 |
| Render 배포 | ✅ 완료 |
| Money 모듈 (가계부/주식/설정) | ✅ 완료 |
| Users 모듈 | 🔜 예정 |
| Sentry 연결 | 🔜 예정 |

---

## 관련 문서

- [CLAUDE.md](./CLAUDE.md) — AI 작업 컨텍스트 기준 문서
- [DEV_LOG.md](./DEV_LOG.md) — 세션별 작업 기록
- [LEARNING.md](./LEARNING.md) — NestJS / Prisma 개념 학습
