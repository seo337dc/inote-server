# iNote Server — CLAUDE.md

> Claude Code 작업 시 이 파일을 기준으로 맥락을 유지합니다.
> 기능/스키마 확정될 때마다 업데이트합니다.
>
> **새 세션 시작 시 필수:** `docs/handoff/HANDOFF.md`를 이 파일보다 먼저 읽는다.
> (순서: `git pull` → `HANDOFF.md` → 이 파일 TODO/현재 단계)

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
| FE 배포 | Vercel | Next.js 무료 배포 |
| 에러 로그 | Sentry | 영구 무료 5K/월 |
| API 문서 | Swagger | @nestjs/swagger, 자동 생성 |

---

## 인프라 구성

```
FE (Next.js)  →  Vercel
BE (NestJS)   →  Render
DB            →  Neon PostgreSQL (dev 브랜치 / prod 브랜치)
에러 추적      →  Sentry (예정)
API 문서      →  /api/docs (Swagger UI)
```

---

## 문서 관리

| 문서 | URL |
|------|-----|
| 프로젝트 홈 (본문) | [Inote-server](https://app.notion.com/p/Inote-server-37bb5151f22f80429433d1c1f0241bd8) |
| DB / ERD | [DB-ERD](https://app.notion.com/p/DB-ERD-37cb5151f22f811ba7e1e23953a6d16e) |
| API | [API](https://app.notion.com/p/API-37cb5151f22f81f28836db3c02004d97) |
| 개발 일지 | [devlog](https://app.notion.com/p/devlog-37cb5151f22f80f7b2d6e03d56f710d2) |
| 학습 노트 | [LEARNING](https://app.notion.com/p/LEARNING-37fb5151f22f812ba369cdceb333a9fa) |
| 기획 | [planning](https://app.notion.com/p/planning-391b5151f22f808dbeeac31ec6c3e245) |

- FE 레포: https://github.com/seo337dc/inote-money
- Notion MCP: `.cursor/mcp.json` — Cursor Settings → Tools & MCP → `notion` → Connect

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
│   │   ├── stocks/           ← 주식(StockHolding) CRUD
│   │   ├── settings/         ← 내 자산 설정 + 히스토리
│   │   │   └── dto/          ← upsert-settings, create/update-setting-history
│   │   └── money.module.ts
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

#### 자산 설정 히스토리
- `GET /api/v1/money/settings/history` — 목록 (최신순)
- `POST /api/v1/money/settings/history` — 현재 설정 스냅샷 저장
- `GET /api/v1/money/settings/history/:id` — 단건 조회
- `PATCH /api/v1/money/settings/history/:id` — 제목 수정
- `DELETE /api/v1/money/settings/history/:id` — 삭제

#### 주식
- `GET /api/v1/money/stocks`
- `POST /api/v1/money/stocks`
- `PATCH /api/v1/money/stocks/:id`
- `DELETE /api/v1/money/stocks/:id`

#### 미니게임 결과
- `GET /api/v1/money/mini-game/results` — 이력 목록 (최신순)
- `GET /api/v1/money/mini-game/results/:id` — 단건 조회
- `POST /api/v1/money/mini-game/results` — 결과 저장

---

## DB 스키마 (확정)

> Better Auth 적용으로 테이블명 및 컬럼 변경됨 (2026-06-10)  
> Prisma 스키마 재설계 — Money 모델 전면 개편 (2026-07-03)  
> SettingHistory 추가, UserSetting memo 필드 추가 (2026-07-06)

```prisma
// ── Better Auth 필수 테이블 ──────────────────────────────────────

model user {
  id            String   @id @default(cuid())
  name          String
  nickname      String?
  email         String   @unique
  emailVerified Boolean  @default(false)
  phone         String?
  phoneVerified Boolean  @default(false)
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions         session[]
  accounts         account[]
  setting          UserSetting?
  settingHistories SettingHistory[]
  expenses         Expense[]
  stocks           StockHolding[]
  reviews          Review[]
}

model session { /* Better Auth 관리 */ }
model account { /* Better Auth 관리 */ }
model verification { /* Better Auth 관리 */ }

// ── 앱 테이블 ──────────────────────────────────────────────────

// savings/fixedExpenses: [{ id, name, amount, transferDate? }] JSON 배열
model UserSetting {
  id                String   @id @default(cuid())
  userId            String   @unique
  salary            Int      @default(0)
  salaryDate        Int      @default(25)
  dailyLimit        Int      @default(0)
  monthlySavingGoal Int      @default(0)
  assetUpdateDate   Int      @default(1)
  savings           Json     @default("[]")
  fixedExpenses     Json     @default("[]")
  memo              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              user     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SettingHistory {
  id                String   @id @default(cuid())
  userId            String
  month             String   // "2026-07" 형식
  title             String?
  salary            Int      @default(0)
  salaryDate        Int?
  dailyLimit        Int      @default(0)
  monthlySavingGoal Int      @default(0)
  assetUpdateDate   Int?
  savings           Json     @default("[]")
  fixedExpenses     Json     @default("[]")
  memo              String?
  recordedAt        DateTime @default(now())
  user              user     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Expense {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime
  amount      Int
  description String?
  category    Category @default(ETC)
  isWaste     Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        user     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Category { FOOD / CAFE / TRANSPORT / SHOPPING / MEDICAL / CULTURE / SUBSCRIPTION / ETC }

model StockHolding {
  id             String    @id @default(cuid())
  userId         String
  market         Market    // KR | US
  ticker         String?
  name           String
  inputMode      InputMode // QUANTITY | AMOUNT
  quantity       Float?
  averagePrice   Float?
  investedAmount Float?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  user           user      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Market { KR / US }
enum InputMode { QUANTITY / AMOUNT }

model Review {
  id        String     @id @default(cuid())
  userId    String
  type      ReviewType // WEEKLY | MONTHLY
  year      Int
  period    Int
  rating    Int
  text      String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  user      user       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, year, period])
}

enum ReviewType { WEEKLY / MONTHLY }

// finalStocks/finalRealEstates/liabilitiesSnapshot/gameLogs: FE PlayerState 스냅샷 JSON
model MiniGameResult {
  id     String     @id @default(cuid())
  userId String
  user   user       @relation(fields: [userId], references: [id], onDelete: Cascade)

  profession String
  result     GameResult

  turnCount            Int
  finalCash            Int
  finalPassiveIncome   Int
  finalMonthlyExpenses Int
  finalMonthlyCashflow Int
  bankLoan             Int
  totalLiabilities     Int
  stocksCount          Int
  realEstatesCount     Int
  childrenCount        Int

  finalStocks         Json
  finalRealEstates    Json
  liabilitiesSnapshot Json
  gameLogs            Json

  playedAt DateTime @default(now())
}

enum GameResult { WON / GAVE_UP }
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

## AI 역할 분담

| 역할 | 담당 |
|------|------|
| 기능 구현 / API 개발 / 코드 작성 | Claude Code |
| 코드 리뷰 / 코드 분석 / QA | Cursor AI |
| 기획·설계 판단 | 사람이 직접 결정 |

## Claude Code 작업 원칙

- 기획·설계 판단이 필요한 순간에는 임의로 결정하지 않고 먼저 질문한다
- 코드 리뷰·코드 분석·QA는 Cursor AI에게 넘기고 직접 수행하지 않는다

## 개발 방식

- 모든 코드 작업은 Claude Code + AI로만 진행
- CLAUDE.md를 프로젝트 맥락 기준 문서로 유지
- 기능/스키마 확정 시 이 파일 업데이트
- 모듈 구현 시 서비스 단위 테스트 함께 작성

---

## 현재 단계

**MiniGameResult 모델 + 결과 저장 API + FE 연동 완료** — 로컬 로그인 쿠키(SameSite/Secure) 환경별 분기 픽스, 사람 로그인 재확인 대기

| 항목 | 상태 |
|------|------|
| NestJS 11 초기화 | ✅ 완료 |
| Swagger (`/api/docs`) | ✅ 완료 |
| CORS / ValidationPipe | ✅ 완료 |
| Prisma + Neon DB 연결 | ✅ 완료 |
| DB 스키마 설계 (Money 모델 전면 개편) | ✅ 완료 |
| Better Auth (Google OAuth) | ✅ 완료 |
| DB 다이어그램 (dbdiagram.io) | ✅ 완료 |
| Users 모듈 | ✅ 완료 |
| Money 모듈 (Expenses/Stocks/Settings) | ✅ 완료 |
| SettingHistory 모델 + API 5개 | ✅ 완료 |
| UpsertSettingsDto 재설계 (배열 구조) | ✅ 완료 |
| MiniGameResult 모델 + API 3개 | ✅ 완료 (FE 연동 대기) |
| Render 배포 | ✅ 완료 (https://inote-server-5a63.onrender.com) |
| Sentry 연결 | 🔜 예정 |

---

## 미결정 항목

- [ ] 소셜 로그인 제공자 추가 여부 (Kakao 등)
- [ ] Sentry 프로젝트 생성
- [ ] 포인트 시스템 정책
- [ ] Reviews API 구현 시점 (주간/월간 리뷰)
- [ ] Expense API FE 연동
