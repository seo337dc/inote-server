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

| 영역 | 기술 |
|------|------|
| BE | NestJS + Prisma |
| 인증 | Better Auth |
| DB | PostgreSQL (Supabase 또는 Neon) |
| 배포 | Railway |

---

## 문서 관리

- 노션: (추후 링크 추가)
- FE 레포: `inote-money`, `inote-daily`, `inote-goal`

---

## 레포 구조

```
inote-server/
├── CLAUDE.md
├── DEV_LOG.md
├── NESTJS_GUIDE.md
├── src/
│   ├── auth/           ← Better Auth 인증
│   ├── users/          ← 유저 관리
│   ├── points/         ← 포인트 시스템
│   ├── money/          ← inote-money API
│   │   ├── expenses/   ← 가계부
│   │   └── stocks/     ← 주식
│   ├── daily/          ← inote-daily API (예정)
│   └── goal/           ← inote-goal API (예정)
├── prisma/
│   └── schema.prisma
└── package.json
```

---

## 모듈 구조

### 공통 (모든 서비스 공유)
- **Auth** — 소셜 로그인, 토큰 관리 (Better Auth)
- **Users** — 유저 프로필, 계정 관리
- **Points** — 포인트 적립/사용 (추후)

### 서비스별
- **Money** — 가계부, 투자 기록, 포트폴리오
- **Daily** — 데일리 기록 (예정)
- **Goal** — 목표 관리 (예정)

---

## API 설계

- REST API 방식
- 기본 prefix: `/api/v1`
- 인증: Bearer Token (Better Auth JWT)

### 엔드포인트 목록

#### 인증
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST /api/v1/auth/signout`

#### 유저
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`

#### 가계부 (money)
- `GET /api/v1/money/expenses` — 월별 지출 목록
- `POST /api/v1/money/expenses` — 지출 추가
- `PATCH /api/v1/money/expenses/:id` — 지출 수정
- `DELETE /api/v1/money/expenses/:id` — 지출 삭제

#### 자산 설정 (money)
- `GET /api/v1/money/settings` — 내 정보 조회
- `PUT /api/v1/money/settings` — 내 정보 저장

#### 주식 (money)
- `GET /api/v1/money/stocks` — 보유 종목 목록
- `POST /api/v1/money/stocks` — 종목 추가
- `PATCH /api/v1/money/stocks/:id` — 종목 수정
- `DELETE /api/v1/money/stocks/:id` — 종목 삭제

---

## 개발 방식

- 모든 코드 작업은 Claude Code + AI로만 진행
- CLAUDE.md를 프로젝트 맥락 기준 문서로 유지
- 기능/스키마 확정 시 이 파일 업데이트

---

## 배포 전략 (무료 기준)

| 영역 | 서비스 | 비고 |
|------|--------|------|
| BE | Railway | NestJS 무료 플랜 |
| DB | Supabase 또는 Neon | PostgreSQL 무료 플랜 |

- AWS 사용 안 함 (프리티어 1년 후 과금)
- Claude를 제외한 모든 서비스 무료 플랜 기준

---

## 미결정 항목

- [ ] DB 스키마 설계 (Users, Points, Money 등)
- [ ] 서비스간 인증 토큰 공유 방식
- [ ] 포인트 시스템 정책
- [ ] 노션 문서 링크

---

## 현재 단계

레포 생성 완료 — NestJS 초기화 진행 중

---

## 회고 작성 가이드

### 작성 타이밍
- 주요 기능 완성 후
- 배포 후
- 프로젝트 마무리 시

### 담을 내용
- 왜 이 기술을 선택했는지
- 막혔던 부분과 해결 방법
- 다음엔 다르게 할 것들
