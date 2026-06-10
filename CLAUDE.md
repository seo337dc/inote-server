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
| BE 배포 | Railway | 영구 무료, 컨테이너 배포 |
| FE 배포 | AWS Amplify | Next.js SSR 지원, 무료 플랜 |
| 에러 로그 | Sentry | 영구 무료 5K/월 |
| API 문서 | Swagger | @nestjs/swagger, 자동 생성 |

---

## 인프라 구성

```
FE (Next.js)  →  AWS Amplify
BE (NestJS)   →  Railway
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

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  expenses  Expense[]
  stocks    Stock[]
  setting   UserSetting?
}

model Expense {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
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
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
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

## 개발 방식

- 모든 코드 작업은 Claude Code + AI로만 진행
- CLAUDE.md를 프로젝트 맥락 기준 문서로 유지
- 기능/스키마 확정 시 이 파일 업데이트

---

## 현재 단계

레포 생성 완료, 문서 정리 완료 — NestJS 초기화 진행 예정

---

## 미결정 항목

- [ ] Neon 프로젝트 생성 및 DB URL 발급
- [ ] Better Auth 소셜 로그인 제공자 확정 (Google만? Kakao 추가?)
- [ ] Sentry 프로젝트 생성
- [ ] Railway 프로젝트 생성
- [ ] 포인트 시스템 정책
