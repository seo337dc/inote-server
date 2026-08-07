# HANDOFF — inote-server

> PC·채팅·AI 메모리가 바뀌어도 이 파일 + git이 맥락의 단일 소스다.
> **Claude Code / Cursor는 새 세션 시작 시 반드시 이 파일을 먼저 읽는다.**

관련: `CLAUDE.md` (TODO·현재 단계) · `CURSOR.md` (Cursor 역할) · `.cursor/rules/`

---

## 규칙 (항상 적용)

### 왜 필요한가

채팅 메모리는 PC·세션마다 초기화된다. 구현/QA 맥락은 **이 문서에 쓰고 push**해서 이어간다.

### 새 세션 시작 순서 (필수)

1. `git pull`
2. **`docs/handoff/HANDOFF.md` 읽기** ← 이 파일
3. `CLAUDE.md`의 TODO / 현재 단계
4. `CURSOR.md` (Cursor만) 또는 역할 확인
5. 필요 시 `git log -5 --oneline`, 최근 변경 파일

이 순서를 건너뛰고 추측으로 작업하지 않는다.

### 세션 종료 시 (사람 요청 또는 Task 경계에서)

1. 아래 **「현재 상태」** 섹션을 최신으로 갱신
2. 필요 시 `CLAUDE.md` TODO / 현재 단계 동기화
3. commit → push (사람이 요청할 때만)

### 누가 언제 갱신하는가

| 시점 | 작성자 | 할 일 |
|------|--------|------|
| Claude 구현 Task 끝 | Claude Code | 「현재 상태」+ Cursor용 넘김 항목 작성 |
| Cursor QA 끝 | Cursor | 판정 기록 + FAIL이면 Claude 넘김 항목 작성 |
| PC/세션 전환 직전 | 작업 중이던 AI | 「현재 상태」를 반드시 최신화 후 push 요청 |

### handoff 채팅 프롬프트 첫 줄

채팅으로 넘길 때도 동일 형식을 쓴다. **문서(`HANDOFF.md`)가 우선**, 채팅은 보조다.

- Cursor → Claude: `> **[Cursor → Claude Code]** handoff 프롬프트`
- Claude → Cursor: `> **[Claude Code → Cursor]** handoff`

### 「현재 상태」에 반드시 넣을 것

- 날짜 / 작성자 (Claude | Cursor | 사람)
- 브랜치
- 완료된 단계
- 진행 중 / 다음 Task
- 이번 범위 (해도 됨 / 하지 말 것)
- 변경·참고 파일
- 알려진 이슈
- 상대 AI에게 기대하는 산출물
- QA 판정 (해당 시: PASS / PASS with notes / FAIL)

### 금지

- handoff 없이 PC·세션을 바꾸고 “이전 대화 기억”에 의존하기
- 「현재 상태」를 갱신하지 않은 채 다음 Task 시작하기
- 상대 역할 범위의 작업을 임의로 가져가기

---

## 현재 상태

> 세션이 바뀔 때마다 **이 섹션만** 덮어쓴다. 위 규칙은 유지한다.

### 메타

| 항목 | 값 |
|------|-----|
| 날짜 | 2026-08-07 |
| 작성자 | Claude Code |
| 브랜치 | `main` |
| 다음 수신자 | 사람 — 로컬 BE 재기동 후 Google 로그인 재확인 |

### 완료된 단계

- **MiniGameResult 모델 + 결과 저장 API 구현** — `inote-money`의 `/demo/mini-game`(쥐경주 탈출 보드게임) 플레이 결과를 기록해, 추후 AI가 결과를 분석해 조언하는 기능의 기반 데이터로 사용할 목적
  - Prisma: `MiniGameResult` 모델(요약 컬럼 + JSON 스냅샷 `finalStocks`/`finalRealEstates`/`liabilitiesSnapshot`/`gameLogs`) + `GameResult` enum(`WON`/`GAVE_UP`), 한 테이블에 정리(요약+상세 JSON) — row 단위 SQL 집계가 필요 없는 용도라 정규화 대신 이 방식 선택
  - API 3개: `GET /money/mini-game/results`, `GET /money/mini-game/results/:id`, `POST /money/mini-game/results`
  - `src/money/mini-game/` (controller/service/dto), `money.module.ts` 등록
- **마이그레이션 drift 발생 → 안전하게 우회** — `prisma migrate dev`가 히스토리 drift 감지 후 `migrate reset`(전체 데이터 삭제)을 제안 → 실행하지 않음. `prisma db pull`로 읽기 전용 인트로스펙션 먼저 해서 실제 DB가 이미 schema.prisma와 일치함을 확인 후, `prisma db push`로 `MiniGameResult`만 안전하게 추가 (2026-07-06 SettingHistory 때와 동일 방식)
- 타입체크·lint 통과, 로컬 서버 부팅 후 라우트 정상 등록·미인증 401 확인
- **FE 연동 완료** (inote-money `/demo/mini-game`) — 로그인 세션 체크 후 승리(`WON`)/중도포기(`GAVE_UP`) 시점에 자동 저장. 타입체크 통과, 사람 실 테스트 대기.
- **로컬 로그인 실패 버그 픽스** — `auth.ts`의 `defaultCookieAttributes`(`sameSite`/`secure`)를 `NODE_ENV` 기준으로 환경별 분기 (프로덕션: `none`/`true`, 로컬: `lax`/`false`). 로컬 BE↔FE가 서로 다른 포트라 `SameSite=None`(HTTPS 전용) 고정값이 로컬에서 불안정했던 문제.

### 진행 중 / 다음 Task

1. **사람:** 로컬 BE 재기동 후 Google 로그인 재확인
2. 로그인 확인되면 `/demo/mini-game`에서 실제 승리/포기 결과 저장·조회 테스트

### 이번 범위

**해도 됨**
- BE 스키마·API 구현, `db push`로 안전한 스키마 반영

**하지 말 것**
- `prisma migrate reset` 등 데이터 삭제를 동반하는 작업 (drift 발생 시에도 금지)
- FE 구현 (다음 Task)

### 변경·참고 파일

```
prisma/schema.prisma                              ← MiniGameResult 모델 + GameResult enum
src/money/mini-game/
├── mini-game.controller.ts
├── mini-game.service.ts
└── dto/create-mini-game-result.dto.ts            ← 중첩 DTO 4종 (GameLog/AssetStock/AssetRealEstate/LiabilityItem)
src/money/money.module.ts                          ← 컨트롤러/서비스 등록
src/auth/auth.ts                                    ← defaultCookieAttributes NODE_ENV 분기
```

### 알려진 이슈

- 마이그레이션 히스토리(`prisma/migrations/`)와 실제 DB 간 drift가 이미 존재함 (memo/nickname/phone/SettingHistory가 과거 `db push`로만 반영되고 마이그레이션 파일이 없음). 실제 스키마 구조는 서로 일치해서 당장 문제는 없지만, `migrate dev`를 쓰면 계속 이 경고가 뜸 — 근본 해결(베이스라인 마이그레이션 생성)은 이번 범위 밖이라 하지 않음.

### 메타

- 날짜: 2026-08-07
- 작성: Claude Code (inote-server 세션)
- 브랜치: main
- 다음 수신자: 사람 본인 (내일부터 주말, 다른 노트북에서 이어서 작업 — 이 문서가 유일한 맥락 소스)

### 완료된 단계 (금융 지식 — Term/Book, BE만)

"금융 지식" 기능을 기획→설계→개발→인프라→QA 실제 기업 사이클처럼 진행 중. 이번 세션에서 BE 쪽 Task #1~#3 완료:

1. **Prisma 스키마** (`prisma/schema.prisma`)
   - `enum FinanceCategory { STOCK REAL_ESTATE TAX SAVING INSURANCE ECONOMY ETC }`
   - `model Term` (용어사전): `term`, `description`, `category`, `isShared`(공유 여부), `likes TermLike[]`
   - `model TermLike`: `@@unique([userId, termId])` — 좋아요 토글용
   - `model Book` (추천도서): `title`, `author`, `comment`, `category`, `isShared`, `likes BookLike[]`
   - `model BookLike`: `@@unique([userId, bookId])`
   - `model user`에 `terms`/`termLikes`/`books`/`bookLikes` 관계 추가
   - `npx prisma generate` + `npx prisma db push`로 안전하게 반영 완료 (마이그레이션 히스토리 drift 없었음, reset 불필요)

2. **API** — `src/money/terms/`, `src/money/books/` (구조 동일, 완전 대칭)
   - `GET /money/terms`, `GET /money/terms/:id`, `POST /money/terms`, `PATCH /money/terms/:id`, `DELETE /money/terms/:id`, `POST /money/terms/:id/like`
   - `/money/books`도 동일 라우트 구조
   - 조회 조건: `isShared === true` 이거나 본인 글이면 노출 (`OR` 쿼리)
   - 수정/삭제: 작성자 본인만 가능 (`verifyOwner`, 기존 `StocksService` 패턴 재사용)
   - 좋아요: `TermLike`/`BookLike` unique 키로 토글 (있으면 삭제=취소, 없으면 생성)
   - 응답에 `likeCount`, `likedByMe`, `isOwner` 계산 필드 포함 (`toResponse` 헬퍼)
   - `src/money/money.module.ts`에 `TermsController`/`TermsService`/`BooksController`/`BooksService` 등록 완료

3. **단위 테스트** — `src/money/terms/terms.service.spec.ts`, `src/money/books/books.service.spec.ts`
   - `PrismaService`를 plain object + `jest.fn()`으로 mock
   - findAll(OR 조건/category/q 필터), findOne(NotFound/Forbidden/공유글 접근), create, update/remove(소유권 검증), toggleLike(생성/삭제/비공개글 접근 차단) 전부 커버
   - `npx jest src/money/terms/terms.service.spec.ts src/money/books/books.service.spec.ts` → **22 passed, 22 total**
   - 부수적으로 발견/수정한 것 2건:
     - `eslint.config.mjs`: `**/*.spec.ts`, `test/**/*.ts`에 한해 `no-unsafe-assignment`/`no-unsafe-member-access`/`no-unsafe-call` off (Jest mock 객체 타입 추론 한계 때문 — 운영 코드는 그대로 strict 유지)
     - `src/app.controller.spec.ts`: 기존에 깨져 있던 보일러플레이트 테스트 수정 (`AppController`가 `/health`용 `PrismaService`를 주입받도록 바뀌었는데 spec은 그대로였음 → `{ provide: PrismaService, useValue: {} }` 추가)

### 진행 중 / 막힌 것 — Task #4 (E2E 테스트)

`test/financial-knowledge.e2e-spec.ts` 파일 자체는 작성 완료 (미인증 GET/POST가 `/money/terms`, `/money/books` 양쪽 다 401 반환하는지 검증). **하지만 실행이 안 됨.** 아래 "알려진 이슈" 참조. 사람이 명시적으로 "지금은 보류, Task #7(CI/CD)에서 제대로 고치기"로 결정함 (AskUserQuestion으로 확인받음).

### 이번 세션 범위 (해도 됨 / 하지 말 것)

- **하지 말 것**: `prisma migrate reset` 등 **데이터 삭제를 동반하는 어떤 작업도 절대 금지**. drift 경고가 떠도 reset 제안을 따르지 말고, `prisma db pull`(임시 스키마 파일로 read-only 확인) → `prisma db push`(안전한 추가 변경)만 사용할 것. 이번 세션에서도 이 패턴으로 안전하게 처리함.
- **해도 됨**: BE 스키마/API/테스트 확장, 문서(Notion/DEV_LOG/HANDOFF) 동기화.
- **FE 작업은 보류 상태**: 사람이 Google AI Studio 목업을 먼저 만들기로 함(원칙대로 — 목업 없이 FE 먼저 만들지 않기).

### 변경/신규 파일 (커밋 대상)

- `prisma/schema.prisma` (FinanceCategory, Term, TermLike, Book, BookLike, user 관계 추가)
- `src/money/terms/` (controller, service, dto/create-term.dto.ts, dto/update-term.dto.ts, terms.service.spec.ts) — 신규
- `src/money/books/` (동일 구조) — 신규
- `src/money/money.module.ts` (Terms/Books 등록)
- `eslint.config.mjs` (spec 파일 unsafe-* 규칙 완화)
- `src/app.controller.spec.ts` (PrismaService mock 추가 — 기존 버그 수정)
- `test/financial-knowledge.e2e-spec.ts` (신규, 현재 실행 불가 — 아래 알려진 이슈 참조)
- `DEV_LOG.md` (금융 지식 BE 세션 로그 추가)
- `docs/handoff/HANDOFF.md` (이 파일 — 이번 업데이트)

### 알려진 이슈 (반드시 먼저 읽을 것) — E2E 테스트가 프로젝트 전체적으로 실행 불가

`better-auth` 패키지가 **ESM 전용**(`.mjs`)으로 배포되고, 의존성 트리 전체가 ESM(`better-auth` → `@better-auth/core` → `better-auth/node_modules/@noble/hashes` 등)이라, Jest 기본 CJS 트랜스폼으로는 `AppModule`을 import하는 순간(= 인증 가드를 거치는 모든 e2e 테스트) 파싱 에러가 난다.

- **새로 만든** `test/financial-knowledge.e2e-spec.ts`뿐 아니라 **기존에 있던** `test/app.e2e-spec.ts`(보일러플레이트, 단순 `/` GET 테스트)도 **똑같이 깨짐** → Better Auth 도입 이후로 이 프로젝트에서 e2e 테스트가 사실상 한 번도 제대로 동작한 적이 없었다는 뜻.
- `test/jest-e2e.json`의 `transformIgnorePatterns`를 점진적으로 확장해봤지만(`better-auth|better-call` → `+@better-auth|@better-fetch` → ...) 새 ESM 패키지가 계속 튀어나와서 스케일이 안 됨. **이 방식은 포기.**
- 제대로 된 해결책은 Jest/ts-jest를 **완전 ESM 모드**로 전환(`useESM`, `NODE_OPTIONS=--experimental-vm-modules`)하는 것인데, 손댈 게 많아서 지금 임시로 고치지 않기로 함.
- `test/jest-e2e.json`은 `git checkout`으로 **원본 그대로 되돌려놓음** (반쯤 고친 상태로 남겨두지 않음). 현재 내용:
  ```json
  {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": ".",
    "testEnvironment": "node",
    "testRegex": ".e2e-spec.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" }
  }
  ```
- **사람이 명시적으로 결정**: 지금 더 파지 말고 **Task #7(CI/CD 인프라 구성)에서 Jest ESM 전환까지 묶어서 제대로 고치기**로 함. 다음 세션에서 이 이슈를 처음부터 다시 조사하지 말 것 — 위 내용이 이미 결론.

### 다음 수신자에게 기대하는 것

**주말/다른 노트북에서 이어갈 때:**
1. `git pull` → 이 문서 → `CLAUDE.md` TODO 순서로 확인.
2. 진행 경로는 둘 중 하나:
   - (A) 사람이 Google AI Studio 목업을 완성했으면 → Task #5(`/demo/financial-knowledge` FE 데모) 착수.
   - (B) 목업이 아직이면 → Task #7(CI/CD 파이프라인 + Jest ESM 전환)을 먼저 진행해도 됨. 위 "알려진 이슈" 섹션을 그대로 시작점으로 사용.
3. Task #4(BE E2E)는 파일은 이미 있으니, Task #7에서 ESM 전환이 끝나면 바로 실행/검증만 하면 됨 — 새로 작성할 필요 없음.
4. `TESTING_GUIDE.md`에 주말 연습 체크리스트(금융 지식 CRUD 기준)가 이미 있으니 테스트 연습용으로 참고 가능.

### QA 판정

BE: 단위 테스트 22개 전부 통과 (PASS). 라우트 등록·소유권/공유 로직은 단위 테스트로 검증됨. E2E는 인프라 이슈로 미실행 (보류, Task #7로 이관). FE/실사용 시나리오 테스트는 미착수 (목업 대기).
