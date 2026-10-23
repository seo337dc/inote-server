# 할 일 — README 현행화 (inote-server)

> 2026-10-21 `README.md`를 실제 코드(컨트롤러 경로, `.env.example`, `render.yaml`, `package.json`)와 대조해 점검한 결과.
> 아직 고치지 않았다. 항목을 끝내면 완료일을 적고 아래 "완료" 칸으로 옮긴다.
> 규칙: 나중에 하기로 한 일은 `docs/todo/`에 기록한다 (`inote` 레포 CLAUDE.md와 같은 규칙).

## 사실과 다른 내용 (우선 수정)
- [ ] **DB가 Neon으로 적혀 있다** — 운영 DB는 Supabase로 이전됨(`docs/adr/0001-neon-to-supabase.md`). 기술 스택 표, 인프라 다이어그램, 환경변수 주석("Neon 연결 문자열")을 고친다.
- [ ] **"Neon DATABASE_URL에 `channel_binding=require` 제거" 경고** — Neon 전용 설명이라 Supabase에는 해당 없음. 삭제하거나 Supabase 기준으로 바꾼다.
- [ ] **구현 현황의 "Users 모듈 🔜 예정"** — `users/`(내 정보, 비밀번호 설정, 탈퇴)는 이미 구현됨. 완료로 바꾼다.
- [ ] **프로젝트 구조의 `points/ (예정)`** — 폴더가 없다. 삭제한다(`CLAUDE.md`도 같은 내용으로 "폴더 자체가 없음").
- [ ] **연결 서비스 표의 inote** — "`blog` 모듈 담당"이 아니라 `blog`, `categories`, `reading-logs`, `todos`, `mandalart`, `uploads`, `embeddings`, `admin`까지 담당한다.
- [ ] **인프라의 `FE → Vercel (inote-money)`** — `inote`(블로그)도 Vercel이다(`render.yaml`의 `AUTH_ERROR_FALLBACK_URL`이 `inote-main.vercel.app`).

## 빠져 있는 내용
- [ ] **프로젝트 구조**에 추가: `admin`, `categories`, `embeddings`, `mandalart`, `reading-logs`, `todos`, `uploads`, `money/{books, mini-game, reviews, terms}`, 최상위 `scripts/`·`docs/`·`prisma/`·`test/`.
- [ ] **API 목록**이 많이 빠져 있다 — 아래를 다 적기보다 **Swagger(`/api/docs`)를 기준 문서로 안내**하고 목록은 줄이는 쪽을 권장(컨트롤러가 곧 사실이라 낡지 않는다).
  - blog: `outline`, `public-ids`, `outline/user/:userId`, `mine`, `mine/outline`, `:id/similar`, `:id/summarize`
  - categories(GET/POST/PATCH), reading-logs, todos, uploads(`image`, `post-image`), mandalart, money(`books`·`terms` 좋아요 포함, `mini-game/results`, `reviews`, `settings/history`), users(`set-password`, `DELETE me`), admin(`admin/users`)
- [ ] **환경변수**에 추가: `NODE_ENV`, `AUTH_ERROR_FALLBACK_URL`, `CF_ACCOUNT_ID`, `CF_ACCESS_KEY_ID`, `CF_SECRET_ACCESS_KEY`, `CF_R2_BUCKET`, `CF_R2_PUBLIC_URL`, `R2_KEY_PREFIX`, `SENTRY_DSN`.
- [ ] **새 섹션**: 테스트 실행법(`pnpm test`, `pnpm test:e2e`), 스크립트(마이그레이션·시드·백필), R2 이미지 업로드와 `R2_KEY_PREFIX=dev` 규칙, 검증 방식(`class-validator` + 전역 `ValidationPipe`).
- [ ] **관련 문서** 목록에 추가: `API.md`, `DATABASE.md`, `docs/learning/`(TESTING_GUIDE·NESTJS_GUIDE·LEARNING — 2026-10-23 이동), `CURSOR.md`, `docs/`(`local-dev-db`, `post-category-backfill`, `embeddings-backfill`, `supabase-migration`, `handoff`).

## 위험하거나 오해를 부르는 안내
- [ ] **"3. DB 마이그레이션"이 `prisma migrate dev`** — `.env`의 `DATABASE_URL`이 운영 DB라 그대로 따라 하면 운영 DB에 실행될 수 있다. `scripts/dev-db.sh migrate`(로컬 DB 전용)를 기본 안내로 바꾼다.
- [ ] **로컬 실행이 `pnpm run start:dev`뿐** — 이렇게 띄우면 운영 DB·R2 운영 경로를 쓴다. 로컬은 `scripts/dev-db.sh start`(개발 DB + R2 `dev/`)를 기본으로 안내한다.
- [ ] **`render.yaml`에 `CF_*`, `EMBEDDINGS_ENABLED`, `SIMILAR_MIN_SCORE`가 없다** — Render 대시보드에서 직접 넣었다면 괜찮다. 이미지 업로드(`post-image`)가 운영에서 동작하려면 `CF_*`가 필요하니 확인한다.

## 확인이 필요한 것
- [ ] cron-job.org 콜드스타트 방지 설정이 지금도 유효한지 (`docs/adr/0001-neon-to-supabase.md`에 한때 "BE가 Render 정지 상태"라는 언급이 있었다).
- [ ] 인프라 섹션의 AI 서버 위치(Render/Vercel) — `inote` 레포 `docs/infra/hosting-migration.md`는 Vercel로 옮긴다고 하는데 `render.yaml`의 `INOTE_AI_URL`은 `inote-ai.onrender.com`이다.

## 같이 고칠 것 (README 밖)
- [ ] `CLAUDE.md`에도 같은 낡은 Neon 정보가 있다(기술 스택 표, 배포 다이어그램, 환경변수 주석, E2E 표, 구현 현황 등).
- [ ] `API.md`는 `categories`, `reading-logs`, `todos`, `uploads`가 하나도 없다(마지막 갱신 2026-10-12). 갱신하거나 Swagger로 대체한다.
- [ ] README·`CLAUDE.md`·`API.md`가 같은 내용을 중복으로 들고 있어 매번 어긋난다 — 한 곳을 기준으로 정하고 나머지는 링크로 줄이는 것을 검토한다.

## 완료
(아직 없음)
