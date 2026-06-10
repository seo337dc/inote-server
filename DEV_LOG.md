# 개발 기록 로그 — iNote Server

> 다른 PC에서 작업을 이어받을 때 이 파일을 먼저 읽고 맥락을 파악합니다.
> 작업할 때마다 아래 로그에 날짜 + 내용을 추가합니다.

---

## 빠른 현황 파악

| 항목 | 상태 |
|------|------|
| 레포 위치 | https://github.com/seo337dc/inote-server |
| 실행 포트 | `http://localhost:3200` |
| Swagger 문서 | `http://localhost:3200/api/docs` |
| 현재 진행 단계 | NestJS + Prisma 세팅 완료 — Better Auth 다음 작업 |

---

## 로컬 실행 방법

```bash
cd inote-server
npm install
npm run start:dev
```

---

## 작업 로그

### 2026-06-10

#### ✅ 완료
- GitHub 레포 생성 (`inote-server`)
- CLAUDE.md / DEV_LOG.md / NESTJS_GUIDE.md / LEARNING.md 추가
- 인프라 및 기술 스택 전체 결정 완료
- NestJS 11 프로젝트 초기화 (TypeScript strict, 포트 3200)
- Swagger UI 설정 (`/api/docs`)
- CORS / ValidationPipe / API prefix(`/api/v1`) 설정
- Prisma 설치 + Neon PostgreSQL 연결
- DB 스키마 확정 및 마이그레이션 적용 (User, Expense, Stock, UserSetting)
- PrismaModule (@Global) + PrismaService 구현

#### 🔜 다음 작업 (다른 노트북에서 이어서)
- Better Auth 설치 및 소셜 로그인 설정
- Users 모듈
- Money 모듈 (가계부, 주식, 설정)

---

## ⚡ 다른 노트북에서 작업 이어받기

```bash
# 1. 레포 클론
git clone https://github.com/seo337dc/inote-server
cd inote-server

# 2. 패키지 설치
npm install

# 3. 환경변수 설정 (.env 파일 생성)
cp .env.example .env
# .env 에 아래 값 입력 (별도 전달)
# DATABASE_URL = Neon 연결 문자열
# BETTER_AUTH_SECRET = (아직 미설정)

# 4. Prisma Client 생성
npx prisma generate

# 5. 서버 실행
npm run start:dev
```

> ⚠️ `.env` 파일은 git에 올라가지 않으므로 직접 만들어야 합니다.
> DATABASE_URL은 Neon 대시보드(https://neon.tech)에서 확인하세요.

---

## 다음 작업 예정

- [x] NestJS 프로젝트 초기화
- [x] Prisma 설치 및 Neon PostgreSQL 연결
- [ ] **Better Auth 설치 및 소셜 로그인 설정** ← 여기서 이어받기
- [ ] Users 모듈 (GET /users/me, PATCH /users/me)
- [ ] Money 모듈 — Expenses (가계부 CRUD)
- [ ] Money 모듈 — Stocks (주식 CRUD)
- [ ] Money 모듈 — Settings (내 정보 설정)

---

## 주요 기술 결정 사항

| 결정 | 선택 | 이유 |
|------|------|------|
| BE 프레임워크 | NestJS + TypeScript | 모듈 구조, DI, 데코레이터 — 대규모 서비스 확장에 유리 |
| ORM | Prisma | TypeScript 타입 자동 생성, 마이그레이션 관리 용이 |
| 인증 | Better Auth | Next.js 16 + Prisma 공식 지원, next-auth 대체, 소셜 로그인 내장 |
| DB | Neon PostgreSQL | 영구 무료, dev/prod 브랜치 분리 가능, 512MB 제공 |
| BE 배포 | Railway | 영구 무료 (500시간/월), NestJS 컨테이너 배포 간단 |
| FE 배포 | AWS Amplify | Next.js SSR 공식 지원, GitHub 연동 CI/CD 자동화, 무료 플랜 |
| 에러 로그 | Sentry | 영구 무료 (5K 에러/월), 에러 추적 + 알림 |
| API 서버 로그 | Railway 내장 로그 | 별도 설정 불필요, 무료 |
| API 문서 | Swagger (@nestjs/swagger) | NestJS 공식 지원, 데코레이터로 자동 생성 |
| AWS EC2/RDS | 사용 안 함 | 12개월 후 과금 — 지속 가능한 무료 플랜 우선 |

---

## 인프라 결정 배경 (상세)

### DB — Neon 선택 이유
- Supabase vs Neon 비교 검토
- Supabase: 1주 비활성 시 슬립, Storage/Auth 등 부가 기능 많지만 지금은 불필요
- **Neon 선택**: 5분 슬립이지만 dev/prod 브랜치 분리 가능 → 개발환경과 운영환경 DB 분리하기 좋음

### BE 배포 — Railway 선택 이유
- AWS EC2 t2.micro는 12개월 무료 후 과금 (~$9/월)
- AWS RDS는 12개월 무료 후 과금 (~$15/월)
- **Railway 선택**: 영구 무료, Docker 기반 NestJS 배포 간단, 환경변수 관리 UI 제공

### FE 배포 — AWS Amplify 선택 이유
- Next.js App Router (SSR)는 S3+CloudFront만으로 불가
- Vercel은 무료이지만 AWS 경험 목적으로 Amplify 선택
- **AWS Amplify 선택**: Next.js SSR 공식 지원, GitHub Push 시 자동 배포, 무료 플랜 제공
