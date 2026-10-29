# 0003 — 초기 기술 스택 선택 (2026-06) — 일부는 이후 변경됨

> 상태: **과거 기록(초기 선택)** — `DEV_LOG.md`(현 `docs/devlog/be.md`)에 있던 "주요 기술 결정 사항"·"인프라 결정 배경"을
> 낡은 현황 표와 분리해 옮겼다. 본문은 2026-06 시점 그대로이고, 아래 "이후 변경"만 새로 덧붙였다.

## 이후 변경 (2026-10-29 기준, 문서로 확인한 것만)

| 항목 | 본문의 선택 | 현재 |
|------|------------|------|
| DB | Neon PostgreSQL | **Supabase로 이전** — [`0001-neon-to-supabase.md`](./0001-neon-to-supabase.md). Neon은 롤백용으로 남겨뒀다고 10/2 기준 HANDOFF에 적혀 있음 |
| FE 배포 | AWS Amplify | **Vercel** (`inote` 레포 CLAUDE.md "배포") |
| BE 배포 | Render | Render 유지 (서비스 1개만 상시). 호스팅 이전 경위는 `inote` 레포 `docs/adr/0003-hosting-migration.md` |
| 에러 로그 | Sentry | 아직 프로젝트 미생성 (CLAUDE.md "미결정 항목") |
| API 서버 로그 | Railway 내장 로그 | 아래 "BE 배포" 비교에서 Railway는 무료 플랜이 없어 제외됐다 — 본문 표와 모순. BE 로깅 방향은 [`0002-backend-monitoring.md`](./0002-backend-monitoring.md) |

---

## 주요 기술 결정 사항

| 결정 | 선택 | 이유 |
|------|------|------|
| BE 프레임워크 | NestJS + TypeScript | 모듈 구조, DI, 데코레이터 — 대규모 서비스 확장에 유리 |
| ORM | Prisma | TypeScript 타입 자동 생성, 마이그레이션 관리 용이 |
| 인증 | Better Auth | Next.js 16 + Prisma 공식 지원, next-auth 대체, 소셜 로그인 내장 |
| DB | Neon PostgreSQL | 영구 무료, dev/prod 브랜치 분리 가능, 512MB 제공 |
| BE 배포 | Render | 영구 무료 (15분 슬립), GitHub 연동 자동 배포 |
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

### BE 배포 — Render 선택 이유
- AWS EC2 t2.micro는 12개월 무료 후 과금 (~$9/월)
- Railway는 무료 플랜 없음 ($5/월 최소 과금)
- **Render 선택**: 영구 무료 (15분 슬립), GitHub 연동 자동 배포, 환경변수 관리 UI 제공

### FE 배포 — AWS Amplify 선택 이유
- Next.js App Router (SSR)는 S3+CloudFront만으로 불가
- Vercel은 무료이지만 AWS 경험 목적으로 Amplify 선택
- **AWS Amplify 선택**: Next.js SSR 공식 지원, GitHub Push 시 자동 배포, 무료 플랜 제공
