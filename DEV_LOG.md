# 개발 기록 로그 — iNote Server

> 다른 PC에서 작업을 이어받을 때 이 파일을 먼저 읽고 맥락을 파악합니다.
> 작업할 때마다 아래 로그에 날짜 + 내용을 추가합니다.

---

## 빠른 현황 파악

| 항목 | 상태 |
|------|------|
| 레포 위치 | https://github.com/seo337dc/inote-server |
| 실행 포트 | `http://localhost:3200` |
| 현재 진행 단계 | NestJS 초기화 진행 중 |

---

## 로컬 실행 방법

```bash
# BE 개발 서버
cd inote-server
npm run start:dev
```

---

## 작업 로그

### 2026-06-10

#### ✅ 완료
- GitHub 레포 생성 (`inote-server`)
- CLAUDE.md / DEV_LOG.md / NESTJS_GUIDE.md 추가

#### 🔜 진행 중
- NestJS 프로젝트 초기화

---

## 다음 작업 예정

- [ ] NestJS 프로젝트 초기화
- [ ] Prisma 설치 및 PostgreSQL 연결
- [ ] Better Auth 설치 및 소셜 로그인 설정
- [ ] Users 모듈
- [ ] Money 모듈 (가계부, 주식, 설정)

---

## 주요 기술 결정 사항

| 결정 | 내용 | 이유 |
|------|------|------|
| 인증 라이브러리 | Better Auth | Next.js 16 + Prisma 지원, next-auth 대체 |
| DB 호스팅 | Supabase or Neon | 무료 플랜 PostgreSQL |
| BE 배포 | Railway | NestJS 무료 플랜 |
| AWS | 사용 안 함 | 프리티어 1년 후 과금 |
| 서버 통합 | inote-server 단일 레포 | 유저/포인트 공유, 서비스 확장 고려 |
| API 방식 | REST | 단순하고 익숙한 구조, GraphQL은 추후 검토 |
