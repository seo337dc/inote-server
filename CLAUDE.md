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
- `inote` — 개인 기록 앱 (글쓰기, 만다르트, 회원 관리자 페이지 — 지금 가장 활발히 개발 중)
- `inote-money` — 자산관리
- `inote-daily` — 데일리 (예정, 미착수)
- `inote-goal` — 목표 (예정, 미착수)

---

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 언어 | TypeScript | strict mode |
| 프레임워크 | NestJS | 모듈/컨트롤러/서비스 구조 |
| ORM | Prisma | 타입 자동생성, 마이그레이션 관리 |
| 인증 | Better Auth | Google OAuth + 이메일/비밀번호, 쿠키 기반 세션 |
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

- FE 레포: https://github.com/seo337dc/inote (글쓰기/만다르트/관리자), https://github.com/seo337dc/inote-money (자산관리)
- Notion MCP: `.cursor/mcp.json` — Cursor Settings → Tools & MCP → `notion` → Connect

---

## 레포 구조

```
inote-server/
├── CLAUDE.md
├── AUTH_POLICY.md            ← 회원(가입/로그인/프로필/비밀번호) 정책
├── API.md / DATABASE.md / TESTING_GUIDE.md / DEV_LOG.md / NESTJS_GUIDE.md
├── README.md
├── src/
│   ├── main.ts               ← 앱 진입점 (포트 3200, CORS, Swagger)
│   ├── app.module.ts         ← 루트 모듈
│   ├── prisma/
│   │   └── prisma.service.ts ← PrismaClient 래퍼
│   ├── auth/                 ← Better Auth 설정, AuthGuard/AdminGuard, setPassword 래퍼
│   ├── users/                ← 내 프로필 조회/수정, 비밀번호 생성, 회원 탈퇴
│   ├── admin/
│   │   └── users/            ← 관리자 전용 회원 목록/상세/삭제
│   ├── blog/                 ← inote 글쓰기 CRUD, draft/발행, AI 요약 연동
│   ├── mandalart/            ← 만다르트 로드맵 (공개 조회, 관리자만 수정)
│   └── money/                ← inote-money API
│       ├── expenses/         ← 가계부 CRUD
│       ├── stocks/           ← 주식(StockHolding) CRUD
│       ├── settings/         ← 내 자산 설정 + 히스토리
│       ├── reviews/          ← 주간/월간 리뷰
│       ├── mini-game/        ← 캐시플로우 미니게임 결과
│       ├── terms/            ← 금융 용어 + 좋아요
│       └── books/            ← 금융 책 추천 + 좋아요
├── prisma/
│   ├── schema.prisma
│   └── dbml/schema.dbml      ← `prisma generate`로 자동 생성, dbdiagram.io에 붙여넣는 용도
├── .env                      ← 로컬 환경변수 (git 제외)
├── .env.example              ← 환경변수 템플릿
└── package.json
```

> `points/`(포인트 시스템), `daily/`, `goal/`은 아직 폴더 자체가 없음 — 전부 미착수 상태의
> 계획일 뿐, 실제 코드는 없음.

---

## 모듈 구조

### 공통 (모든 서비스 공유)
- **Auth** — Better Auth 설정(Google OAuth + 이메일/비밀번호), AuthGuard/AdminGuard
- **Users** — 내 프로필 조회/수정, 비밀번호 생성, 회원 탈퇴
- **Admin** — 관리자 전용 회원 목록/상세/삭제
- **Points** — 포인트 적립/사용 (추후, 미착수)

### 서비스별
- **Blog** (`inote`) — 글쓰기 CRUD, draft/발행, AI 요약 연동
- **Mandalart** (`inote`) — 로드맵 항목, 공개 조회·관리자만 수정
- **Money** (`inote-money`) — 가계부, 주식, 내 정보 설정, 리뷰, 미니게임, 금융 용어/책
- **Daily** — 데일리 기록 (예정, 미착수)
- **Goal** — 목표 관리 (예정, 미착수)

---

## API 설계

- 방식: REST API
- 기본 prefix: `/api/v1`
- 인증: Better Auth 세션 쿠키 (`AuthGuard`/`AdminGuard`)
- **정확한 엔드포인트 목록은 여기 손으로 안 옮겨 적음** — `GET /api/docs`(Swagger)가 코드에서
  자동 생성되는 진짜 소스. (예전엔 여기 손으로 옮겨 적었는데 몇 달 지나며 실제와 절반 넘게
  달라져 있었음 — 2026-09-22, 손으로 유지하는 방식 폐기)

### 모듈별 라우트 prefix

| 모듈 | prefix | 비고 |
|------|--------|------|
| Auth | `/api/v1/auth/*` | better-auth가 직접 라우트 등록 (세션, 소셜 로그인 등) |
| Users | `/api/v1/users` | 내 프로필, `/set-password`, 회원 탈퇴 |
| Admin | `/api/v1/admin/users` | 관리자 전용 |
| Blog | `/api/v1/blog/posts` | `inote` 글쓰기 |
| Mandalart | `/api/v1/mandalart` | |
| Money | `/api/v1/money/*` | expenses, stocks, settings, reviews, mini-game, terms, books |

---

## DB 스키마

> **여기다 Prisma 스키마를 통째로 복붙해서 유지하던 방식은 폐기** (2026-09-22) — 스키마 바뀔
> 때마다 여기도 같이 고쳐야 하는데 계속 놓쳐서, 몇 달째 실제 스키마와 다른 채로 방치돼
> 있었음(예: `user.role`/`usesInote`/`usesInoteMoney`, `Post`/`MandalartItem`/`Term`/`Book`
> 등 모델 자체가 안 적혀 있었음). **정확한 스키마는 항상 [`prisma/schema.prisma`](prisma/schema.prisma)
> 직접 확인.** ERD: https://dbdiagram.io/d/inote-6a39fc895c789b8acbdd5d39 (스키마 바뀔 때마다
> `prisma generate`로 `prisma/dbml/schema.dbml` 갱신 후 수동으로 붙여넣어야 함, 아래 작업
> 진행 원칙 참고).

### 모델 목록 (이름만 — 필드 상세는 schema.prisma 참고)

| 구분 | 모델 |
|------|------|
| Better Auth 관리 | `user`, `session`, `account`, `verification` |
| 공통 | `Post`, `PostSummary`, `MandalartItem` |
| Money (`inote-money`) | `UserSetting`, `SettingHistory`, `Expense`, `StockHolding`, `Review`, `MiniGameResult`, `Term`, `TermLike`, `Book`, `BookLike` |

---

## 환경변수

```bash
# .env
DATABASE_URL="postgresql://..."           # Neon 연결 문자열
BETTER_AUTH_SECRET="..."                  # 랜덤 시크릿 키
BETTER_AUTH_URL="http://localhost:3200"   # 로컬은 3200, 배포는 실제 도메인
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
INOTE_AI_URL="..."                        # inote-ai 베이스 URL (blog AI 요약 호출용)
INTERNAL_SECRET="..."                     # inote-ai와 동일한 값이어야 함 (서비스 간 인증)
AUTH_ERROR_FALLBACK_URL="..."             # OAuth state 재사용 등 에러 시 최종 fallback (inote 로그인 페이지)
SENTRY_DSN="..."                          # 아직 미연결
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
| **@swc/jest** | E2E 전용 트랜스파일러 — Jest ESM 모드(`extensionsToTreatAsEsm`)와 함께 써서
  better-auth(순수 ESM 배포) import 문제 해결. ts-jest의 ESM 모드는 `isolatedModules`를 강제해서
  NestJS `emitDecoratorMetadata`(DI에 필수)가 깨지는 반면, SWC는 `decoratorMetadata: true` 옵션으로
  이 문제가 없음 (`.swcrc`, `test/jest-e2e.json` 참고). 단위 테스트는 기존 ts-jest 그대로 유지 —
  설정이 분리돼 있어 서로 영향 없음. |

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

### ✅ 커밋 전 체크리스트 (매번 이 순서 그대로)

기능/모듈 하나를 완성했을 때 — 커밋하기 직전, 예외 없이:

- [ ] **단위 테스트** — 새로 만들거나 수정한 서비스 로직에 `*.service.spec.ts` 작성/보강 후 `pnpm test` 전체 통과
- [ ] **빌드** — `pnpm run build`로 타입 에러 없는지 확인
- [ ] **E2E 테스트** — `pnpm test:e2e`로 실제 DB까지 거치는 흐름이 안 깨졌는지 확인
- [ ] **CLAUDE.md 문서 최신화** — 이번 작업으로 레포 구조/모듈 구조/환경변수/현재 단계/미결정
      항목 등 이 파일에 적힌 사실 정보가 바뀌었다면, 커밋 전에 해당 섹션을 그 자리에서 갱신한다
      (2026-09-22 추가 — 나중으로 미루면 다음 세션에서 낡은 정보를 사실로 믿고 작업하게 됨)
- [ ] 네 가지 다 통과한 뒤에만 커밋 (커밋/푸시 자체는 사용자가 명시적으로 요청했을 때만)

> 실무에서는 이 순서를 CI(GitHub Actions 등)가 자동으로 강제해서 사람이 깜빡해도 머지가
> 막히는데, 지금은 CI가 없어서 사람이 직접 챙겨야 함. **AI도 매 기능 단위로 이 체크리스트를
> 빠짐없이 실제로 실행하고 결과를 보여줄 것** — "작업 진행 원칙"에 있던 규칙을 여기로 옮겨
> 체크리스트 형태로 명확히 함 (2026-09-22, 산문 속에 묻혀서 계속 빠뜨려지길래 형태를 바꿈).

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

### 작업 진행 원칙 (2026-09-04 추가 — 반드시 지킬 것)

- **한 번에 여러 작업을 몰아서 하지 않는다.** 기능/API/모듈 하나 단위로 끊어서 진행한다. 여러 개를
  한꺼번에 구현하고 나중에 몰아서 보고하지 않는다.
- **테스트는 작업 단위마다, 커밋 전에는 e2e까지 돌린다** (2026-09-20 추가) — 상세 체크리스트는
  위 "테스트 전략 → 커밋 전 체크리스트" 참고.
- **착수 전에 먼저 의논하고 확인받는다.** 무엇을, 어떻게 할지 — 스키마 변경, API 설계, 구현 방식
  등 — 코드를 쓰기 전에 사용자와 상의하고 승인받은 뒤에만 작업한다. "구현해줘" 한 마디를 받았다고
  이후 세부 결정까지 임의로 밀어붙이지 않는다.
- **구현한 코드는 상세히 공유한다.** 어떤 파일을 왜 이렇게 바꿨는지 설명하고, 변경된 코드 내용을
  사용자가 직접 확인할 수 있게 보여준다. 결과 요약만 던지고 넘어가지 않는다.
- **커밋·PR·push는 사용자가 명시적으로 요청하기 전까지 절대 하지 않는다.** 구현·테스트·검증까지
  다 끝났어도 자동으로 커밋·푸시로 이어가지 않는다. 매번 사용자의 명시적 허락을 받은 뒤에만
  진행한다. (동일한 규칙이 `inote-blog`/`inote-money`에도 있음 — 2026-09-03 inote-blog에서
  이 규칙이 있었는데도 자동으로 커밋·푸시까지 진행해서 사용자가 정정한 사례가 있으니 특히 주의.)
- **커밋을 한 번에 몰아서 하지 않는다.** 여러 기능/파일을 한 세션에서 고쳤어도 커밋은 기능 단위로
  쪼개서 각각 따로 만든다 (2026-09-20 추가 — `inote-server`/`inote-money`/`inote` 공통 규칙).
- **`schema.prisma` 등 DB 스키마 관련 수정·추가가 있으면, 커밋하기 전에 반드시 dbdiagram을
  최신 상태로 업데이트한다** (2026-09-09 추가 — 예전에 만든 dbdiagram.io ERD가 그 이후 추가된
  모델들을 반영 못 해서 오래 방치된 채 낡아있던 걸 발견함). `pnpm exec prisma generate`를 돌리면
  `prisma-dbml-generator`가 `prisma/dbml/schema.dbml`을 최신 스키마 기준으로 자동 생성함.
  **Claude Code는 dbdiagram.io에 직접 붙여넣지 않는다** — dbdiagram.io 로그인은 사용자 계정이라
  Claude가 대신 로그인할 수 없음(비밀번호 대신 입력 금지). 대신 매번: (1) `prisma generate`로
  `schema.dbml` 최신화 → (2) 그 파일을 열어서 내용을 보여줌 → (3) "이 내용을 dbdiagram.io
  (https://dbdiagram.io/d/inote-6a39fc895c789b8acbdd5d39)에 복사해서 붙여넣어달라"고 사용자에게
  명시적으로 안내 → (4) 사용자가 반영 완료했다고 확인하면 그때 커밋 진행.

## 개발 방식

- 모든 코드 작업은 Claude Code + AI로만 진행
- CLAUDE.md를 프로젝트 맥락 기준 문서로 유지
- 기능/스키마 확정 시 이 파일 업데이트
- 모듈 구현 시 서비스 단위 테스트 함께 작성

---

## 현재 단계

**회원 관리자 페이지(목록/상세/삭제) + AUTH_POLICY 1~6번 구현 완료** (2026-09-22 기준) —
role 기반 권한, `usesInote`/`usesInoteMoney` 컬럼, 이메일/구글 계정 분리(accountLinking),
계정 연결 실패 안내 메시지, 프로필 수정 API(닉네임/전화번호/이미지), 소셜 전용 계정 비밀번호
생성 API까지. 단위테스트 108개, e2e 5개 통과. AUTH_POLICY 7번(`inote`↔`inote-money` 연동
확인 화면)은 `inote-money` 쪽 회원 기능이 먼저 필요해서 보류 중. 상세: [`AUTH_POLICY.md`](AUTH_POLICY.md)

| 항목 | 상태 |
|------|------|
| NestJS 11 초기화 | ✅ 완료 |
| Swagger (`/api/docs`) | ✅ 완료 |
| CORS / ValidationPipe | ✅ 완료 |
| Prisma + Neon DB 연결 | ✅ 완료 |
| Better Auth (Google OAuth + 이메일/비밀번호) | ✅ 완료 |
| DB 다이어그램 (dbdiagram.io) | ✅ 완료 (스키마 바뀔 때마다 수동 갱신 필요) |
| Users 모듈 (프로필/비밀번호 생성/탈퇴) | ✅ 완료 |
| Money 모듈 (Expenses/Stocks/Settings/Reviews/MiniGame/Terms/Books) | ✅ 완료 (단위테스트 포함) |
| Blog 모듈 (`inote` 글쓰기, AI 요약 연동) | ✅ 완료 |
| Mandalart 모듈 (role 기반 권한) | ✅ 완료 |
| Admin 모듈 (회원 목록/상세/삭제) | ✅ 완료 |
| AUTH_POLICY 1~6번 | ✅ 완료 |
| AUTH_POLICY 7번 (타 서비스 연동 확인 화면) | 🔜 `inote-money` 회원 기능 대기 |
| 단위테스트 | ✅ 108개 통과 |
| E2E 테스트 | ✅ 5개 통과 |
| Render 배포 | ✅ 완료 (https://inote-server-5a63.onrender.com) |
| Sentry 연결 | 🔜 예정 |

---

## 미결정 항목

- [ ] 소셜 로그인 제공자 추가 여부 (Kakao 등)
- [ ] Sentry 프로젝트 생성
- [ ] 포인트 시스템 정책
- [ ] Expense API FE 연동 — `inote-money` 쪽에서 이미 붙었을 수도 있음, 실제 상태 재확인 필요
- [ ] **`API.md`/`DATABASE.md`/`TESTING_GUIDE.md`도 이 파일과 같은 이유로 몇 달째 낡아있음**
      (blog/mandalart/admin/terms/books 등 반영 안 됨) — 2026-09-22에 CLAUDE.md만 먼저
      정리하고 이건 별도 작업으로 미룸.
- [ ] **(고도화, 지금 착수 안 함) Kafka 도입 검토** — 서비스가 여러 개로 쪼개지고 "이벤트 하나가
      여러 곳에 영향을 줘야 하는" 상황이 될 때 고려. 예: `inote-blog` "글 발행" 이벤트 하나로
      검색 인덱싱·LLM 임베딩 생성·알림 발송이 서로 독립적으로 반응하게 만들기. 지금 규모(개인
      프로젝트, 서비스 몇 개)에서는 REST API 직접 호출이 더 맞고, Kafka는 클러스터 구성 등
      운영 부담이 커서 오버엔지니어링 — 실제 필요해질 때(서비스 분리, 이벤트 팬아웃 필요) 재검토.
