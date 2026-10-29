# iNote Server

> iNote 시리즈 공통 백엔드 API 서버 — NestJS + Prisma + Better Auth

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 언어 | TypeScript |
| 프레임워크 | NestJS |
| ORM | Prisma |
| 인증 | Better Auth (이메일/비밀번호 + Google OAuth) |
| DB | PostgreSQL (Supabase) |
| 파일 저장 | Cloudflare R2 (글 이미지 업로드) |
| 배포 | Render |
| API 문서 | Swagger (`/api/docs`) |

---

## 연결 서비스

| 서비스 | 레포 | 역할 |
|--------|------|------|
| inote-money | [seo337dc/inote-money](https://github.com/seo337dc/inote-money) | 자산관리 FE — `money` 모듈 사용 |
| inote | [seo337dc/inote](https://github.com/seo337dc/inote) | 글쓰기·독서·할 일·만다라트 FE — `blog`, `categories`, `reading-logs`, `todos`, `mandalart`, `uploads`, `embeddings`, `admin` 사용 |
| inote-ai | [seo337dc/inote-ai](https://github.com/seo337dc/inote-ai) | LLM 채팅·요약·임베딩 — `x-internal-secret`으로 이 서버와 통신 |
| inote-daily | — | 🚧 예정 |
| inote-goal | — | 🚧 예정 |

---

## 로컬 실행

### 1. 설치

```bash
git clone https://github.com/seo337dc/inote-server
cd inote-server
pnpm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

값의 종류와 설명은 [`.env.example`](./.env.example)이 기준이다. 자주 틀리는 것만 적는다.

- `DATABASE_URL`은 **기본적으로 운영 DB(Supabase)** 다. 로컬에서 그대로 쓰면 운영 데이터에 영향이 간다.
- `INTERNAL_SECRET`은 `inote-ai`와 같은 값이어야 한다 (서비스 간 인증).
- `R2_KEY_PREFIX`를 비우면 운영 경로 그대로 쓴다. 로컬은 `scripts/dev-db.sh start`가 `dev`를 넣어 버킷의 `dev/` 아래에서만 읽고 쓴다.
- `EMBEDDINGS_ENABLED`는 기본 꺼짐(`false`). 켜야만 글 저장·삭제를 `inote-ai` 임베딩 API에 알린다.

### 3. 로컬 개발 DB (권장)

운영 DB 대신 **내 PC의 도커 Postgres**를 쓴다. 상세와 주의는 [`docs/runbooks/local-dev-db.md`](docs/runbooks/local-dev-db.md).

```bash
cp .env.dev.example .env.dev      # 개발 DB 비밀번호를 채운다
scripts/dev-db.sh up              # DB 시작 (5435)
scripts/dev-db.sh migrate         # 마이그레이션 적용 (개발 DB에만)
scripts/dev-db.sh seed            # 시드
scripts/dev-db.sh start           # BE를 개발 DB로 실행 (3200)
```

> ⚠️ `.env`의 `DATABASE_URL`이 운영 DB라서 `pnpm exec prisma migrate dev`나 `pnpm run start:dev`를 그대로 실행하면 **운영 DB에 붙는다.** 마이그레이션·시드는 `scripts/dev-db.sh`로만 실행한다.

### 4. 확인

| URL | 설명 |
|-----|------|
| `http://localhost:3200` | API 서버 |
| `http://localhost:3200/api/docs` | Swagger API 문서 (엔드포인트의 기준 문서) |
| `http://localhost:3200/api/v1/health` | 헬스 체크 |

---

## 프로젝트 구조

```
src/
├── main.ts            ← 진입점 (CORS, Swagger, 전역 ValidationPipe, 포트)
├── app.module.ts      ← 루트 모듈
├── prisma/            ← PrismaService
├── auth/              ← 인증 (Better Auth)
├── users/ admin/      ← 유저 관리, 관리자
├── blog/ categories/  ← 글쓰기 CRUD·draft/발행·AI 요약, 카테고리 트리
├── reading-logs/ todos/ mandalart/
├── uploads/           ← 이미지 업로드 (R2)
├── embeddings/        ← 글 임베딩·비슷한 글 (inote-ai 연동)
└── money/             ← expenses, stocks, settings, books, terms, mini-game, reviews
prisma/                ← schema.prisma, 마이그레이션, 시드, dbml(ERD용 생성물)
scripts/               ← dev-db.sh, 백필 스크립트
test/                  ← E2E
```

> 폴더 목록은 코드가 소스다. 위 목록이 낡으면 `src/`를 본다.

---

## API

엔드포인트 목록은 문서에 옮겨 적지 않는다 — **Swagger(`/api/docs`)** 가 컨트롤러에서 자동 생성한 기준 문서다.
요청 검증은 `class-validator` DTO + 전역 `ValidationPipe`(`whitelist`, `transform`)가 한다. DB 스키마의 소스는 `prisma/schema.prisma`다.

---

## 테스트

```bash
pnpm test          # 단위 테스트 (jest, 서비스에 mock 주입)
pnpm test:e2e      # E2E (test/)
```

---

## 스크립트

| 명령 | 용도 |
|------|------|
| `pnpm run post-category:backfill` | 글의 `categoryId` 채우기 (기본 dry-run) — [`docs/runbooks/post-category-backfill.md`](docs/runbooks/post-category-backfill.md) |
| `pnpm run embeddings:backfill` | 기존 글 일괄 임베딩 — [`docs/runbooks/embeddings-backfill.md`](docs/runbooks/embeddings-backfill.md) |
| `scripts/dev-db.sh` | 로컬 개발 DB 관리 |

---

## 인프라

```
FE  →  Vercel (inote, inote-money)
BE  →  Render (이 서버) — https://inote-server-5a63.onrender.com
AI  →  Vercel (inote-ai)
DB  →  Supabase PostgreSQL (BE용 / AI용 프로젝트 별도)
```

- Neon에서 Supabase로 옮긴 경위: [`docs/adr/0001-neon-to-supabase.md`](docs/adr/0001-neon-to-supabase.md), 호스팅 전체 정리: `inote` 레포 `docs/adr/0003-hosting-migration.md`.
- **Render 무료 플랜 콜드 스타트 방지**: [cron-job.org](https://cron-job.org)에서 10분마다 `/api/v1/health`를 호출하도록 설정한다(15분 무활동 시 슬립). cron-job.org 대시보드 설정이라 레포에는 설정 파일이 없다. 운영은 정상 동작 중이다(2026-10-29 사용자 확인).
- [`render.yaml`](./render.yaml)의 환경변수는 실제 Render 대시보드 값과 다르다 — `INOTE_AI_URL`이 옛 Render 주소(`inote-ai.onrender.com`)이고 `CF_*`·`EMBEDDINGS_ENABLED`가 없다. 운영은 대시보드 값으로 정상 동작 중이라(2026-10-29 사용자 확인) 이 파일의 값은 **참고용**이다.

---

## 구현 현황

| 항목 | 상태 |
|------|------|
| NestJS · Swagger · Prisma · Supabase 연결 · 마이그레이션 | ✅ 완료 |
| Better Auth (이메일/비밀번호, Google) | ✅ 완료 |
| Render 배포 | ✅ 완료 |
| Users · Admin | ✅ 완료 |
| Money 모듈 (가계부·주식·설정·책·용어·미니게임·리뷰) | ✅ 완료 |
| Blog (draft/발행, AI 요약 연동, 접근 제어)·Categories·이미지 업로드 | ✅ 완료 |
| Reading-logs · Todos · Mandalart | ✅ 완료 |
| Embeddings (비슷한 글) | ✅ 구현 — 운영은 `EMBEDDINGS_ENABLED` 꺼짐 |
| Sentry 연결 | 🔜 예정 (`SENTRY_DSN` 항목만 있고 `src/`에 연동 코드 없음) |

---

## 관련 문서

- [CLAUDE.md](./CLAUDE.md) — AI 작업 컨텍스트 기준 문서
- [docs/handoff/HANDOFF.md](./docs/handoff/HANDOFF.md) — 세션 인수인계
- [docs/devlog/be.md](./docs/devlog/be.md) — 세션별 작업 기록
- [docs/adr/](./docs/adr/) — 결정 기록, [docs/runbooks/](./docs/runbooks/) — 작업 절차서
- [docs/learning/](./docs/learning/README.md) — 학습용 문서 (NestJS / Prisma / 테스트)
- [docs/AUTH_POLICY.md](./docs/AUTH_POLICY.md) — 회원(가입/로그인/프로필/비밀번호) 정책
- [docs/CURSOR.md](./docs/CURSOR.md) — Cursor 작업 지침
