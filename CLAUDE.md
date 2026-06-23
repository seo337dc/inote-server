# iNote Server — CLAUDE.md

> Claude Code 작업 시 이 파일을 기준으로 맥락을 유지합니다.
> 기능/스키마 확정될 때마다 업데이트합니다.

---

## 프로젝트 개요

iNote 시리즈 서비스의 공통 백엔드 서버.
인증, 유저 관리, 포인트 시스템 등 공통 기능과 각 서비스별 API를 통합 관리.

**연결된 서비스**
- `inote-money` — 자산관리
- `inote-daily` — 데일리 (예정)
- `inote-goal` — 목표 (예정)

---

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 언어 | TypeScript | strict mode |
| 프레임워크 | NestJS | 모듈/컨트롤러/서비스 구조 |
| ORM | Prisma | 타입 자동생성, 마이그레이션 관리 |
| 인증 | Better Auth | 소셜 로그인, JWT 세션 |
| DB | PostgreSQL (Neon) | 영구 무료, dev/prod 브랜치 분리 |
| BE 배포 | Render | 영구 무료 (슬립 있음), GitHub 연동 자동 배포 |
| FE 배포 | AWS Amplify | Next.js SSR 지원, 무료 플랜 |
| 에러 로그 | Sentry | 영구 무료 5K/월 |
| API 문서 | Swagger | @nestjs/swagger, 자동 생성 |

---

## 인프라 구성

```
FE (Next.js)  →  AWS Amplify
BE (NestJS)   →  Render
DB            →  Neon PostgreSQL (dev 브랜치 / prod 브랜치)
에러 추적      →  Sentry
API 로그      →  Railway 내장 로그
API 문서      →  /api/docs (Swagger UI)
```

---

## 문서 관리

- 노션: (추후 링크 추가)
- FE 레포: https://github.com/seo337dc/inote-money

---

## 레포 구조

```
inote-server/
├── CLAUDE.md
├── DEV_LOG.md
├── NESTJS_GUIDE.md
├── README.md
├── src/
│   ├── main.ts               ← 앱 진입점 (포트 3200, CORS, Swagger)
│   ├── app.module.ts         ← 루트 모듈
│   ├── prisma/
│   │   └── prisma.service.ts ← PrismaClient 래퍼
│   ├── auth/                 ← Better Auth 인증
│   ├── users/                ← 유저 관리
│   ├── points/               ← 포인트 시스템 (추후)
│   ├── money/                ← inote-money API
│   │   ├── expenses/         ← 가계부 CRUD
│   │   ├── stocks/           ← 주식 CRUD
│   │   └── settings/         ← 내 정보 설정
│   ├── daily/                ← inote-daily API (예정)
│   └── goal/                 ← inote-goal API (예정)
├── prisma/
│   └── schema.prisma
├── .env                      ← 로컬 환경변수 (git 제외)
├── .env.example              ← 환경변수 템플릿
└── package.json
```

---

## 모듈 구조

### 공통 (모든 서비스 공유)
- **Auth** — 소셜 로그인, 토큰 관리 (Better Auth)
- **Users** — 유저 프로필, 계정 관리
- **Points** — 포인트 적립/사용 (추후)

### 서비스별
- **Money** — 가계부, 주식, 내 정보 설정
- **Daily** — 데일리 기록 (예정)
- **Goal** — 목표 관리 (예정)

---

## API 설계

- 방식: REST API
- 기본 prefix: `/api/v1`
- 인증: Bearer Token (Better Auth JWT)
- 문서: `GET /api/docs` (Swagger UI)

### 엔드포인트 목록

#### 인증
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST /api/v1/auth/signout`
- `POST /api/v1/auth/social/:provider`

#### 유저
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`

#### 가계부
- `GET /api/v1/money/expenses?year=&month=`
- `POST /api/v1/money/expenses`
- `PATCH /api/v1/money/expenses/:id`
- `DELETE /api/v1/money/expenses/:id`

#### 자산 설정
- `GET /api/v1/money/settings`
- `PUT /api/v1/money/settings`

#### 주식
- `GET /api/v1/money/stocks`
- `POST /api/v1/money/stocks`
- `PATCH /api/v1/money/stocks/:id`
- `DELETE /api/v1/money/stocks/:id`

---

## DB 스키마 (확정)

> Better Auth 적용으로 테이블명 및 컬럼 변경됨 (2026-06-10)

```prisma
// Better Auth 필수 테이블
model user {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  emailVerified Boolean  @default(false)
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions session[]
  accounts account[]

  expenses Expense[]
  stocks   Stock[]
  setting  UserSetting?
}

model session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      user     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  user      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// 앱 테이블
model Expense {
  id        String   @id @default(cuid())
  userId    String
  user      user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount    Int
  category  String
  type      String   // "income" | "expense"
  memo      String?
  date      DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Stock {
  id           String   @id @default(cuid())
  userId       String
  user         user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ticker       String
  name         String
  currency     String   // "KRW" | "USD"
  inputMode    String   // "shares" | "amount"
  quantity     Float?
  buyPrice     Float?
  investAmount Float?
  memo         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model UserSetting {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         user     @relation(fields: [userId], references: [id], onDelete: Cascade)
  salary       Int?
  savings      Int?
  fixedExpense Int?
  salaryDate   Int?     // 1~31
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## 환경변수

```bash
# .env
DATABASE_URL="postgresql://..."        # Neon 연결 문자열
BETTER_AUTH_SECRET="..."               # 랜덤 시크릿 키
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
SENTRY_DSN="..."
PORT=3200
```

---

## 테스트 전략

### 도구

| 도구 | 용도 |
|------|------|
| **Jest** | 단위 테스트 (NestJS 기본 내장) |
| **supertest** | E2E 테스트 HTTP 요청 시뮬레이션 |
| **@nestjs/testing** | NestJS 테스트 모듈 생성 |

### 테스트 종류별 적용 범위

| 종류 | 대상 | DB 연결 |
|------|------|---------|
| 단위 테스트 | 서비스 로직 (계산, 필터, 검증) | ❌ Mock 사용 |
| E2E 테스트 | API 엔드포인트 전체 흐름 | ✅ Neon dev 브랜치 |

### 우선순위

1. **핵심 서비스 로직** — 지출 합계, 유저 권한 확인, 입력값 검증
2. **API 엔드포인트** — 인증 필요 API, CRUD 정상 동작
3. 나머지는 기능 완성 후 점진적으로 추가

### 파일 구조 컨벤션

```
src/money/expenses/
├── expenses.service.ts
├── expenses.service.spec.ts   ← 단위 테스트 (서비스 옆에 배치)
└── expenses.controller.ts

test/
└── expenses.e2e-spec.ts       ← E2E 테스트
```

### 실행 명령어

```bash
npm run test          # 단위 테스트 전체 실행
npm run test:watch    # 변경 감지 자동 실행
npm run test:e2e      # E2E 테스트 실행
npm run test:cov      # 커버리지 리포트
```

---

## 개발 방식

- 모든 코드 작업은 Claude Code + AI로만 진행
- CLAUDE.md를 프로젝트 맥락 기준 문서로 유지
- 기능/스키마 확정 시 이 파일 업데이트
- 모듈 구현 시 서비스 단위 테스트 함께 작성

---

## 현재 단계

**Money 모듈 완료** — Railway 배포 다음 작업

| 항목 | 상태 |
|------|------|
| NestJS 11 초기화 | ✅ 완료 |
| Swagger (`/api/docs`) | ✅ 완료 |
| CORS / ValidationPipe | ✅ 완료 |
| Prisma + Neon DB 연결 | ✅ 완료 |
| DB 마이그레이션 (init) | ✅ 완료 |
| Better Auth (Google OAuth) | ✅ 완료 |
| DB 다이어그램 (dbdiagram.io) | ✅ 완료 |
| Users 모듈 | ✅ 완료 |
| Money 모듈 (Expenses/Stocks/Settings) | ✅ 완료 |
| Railway 배포 | 🔜 예정 |
| Sentry 연결 | 🔜 예정 |

---

## 미결정 항목

- [ ] 소셜 로그인 제공자 추가 여부 (Kakao 등)
- [ ] Sentry 프로젝트 생성
- [ ] Railway 프로젝트 생성 및 배포
- [ ] 포인트 시스템 정책
