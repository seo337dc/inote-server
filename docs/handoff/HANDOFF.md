# HANDOFF — inote-server

> PC·채팅·AI 메모리가 바뀌어도 이 파일 + git이 맥락의 단일 소스다.
> **Claude Code / Cursor는 새 세션 시작 시 반드시 이 파일을 먼저 읽는다.**

관련: `CLAUDE.md` (TODO·현재 단계) · `docs/CURSOR.md` (Cursor 역할) · `.cursor/rules/`

---

## 규칙 (항상 적용)

### 왜 필요한가

채팅 메모리는 PC·세션마다 초기화된다. 구현/QA 맥락은 **이 문서에 쓰고 push**해서 이어간다.

### 새 세션 시작 순서 (필수)

1. `git pull`
2. **`docs/handoff/HANDOFF.md` 읽기** ← 이 파일
3. `CLAUDE.md`의 TODO / 현재 단계
4. `docs/CURSOR.md` (Cursor만) 또는 역할 확인
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
> **레포 3개에 걸친 최신 handoff는 `inote` 레포의 `docs/handoff/HANDOFF.md`를 먼저 읽는다.** 진행 중인 작업은 `inote` 레포 `docs/todo/<기능>.md`(작업 지시서), 미룬 일은 `inote` 레포 `docs/todo/backlog.md`에 있다(2026-11-13 정리, `inote` ADR 0008). 이 섹션에는 BE에서만 쓰는 **오래 가는 정보**만 둔다.

### 메타

| 항목 | 값 |
|------|-----|
| 날짜 | 2026-11-13 |
| 작성자 | Claude Code |
| 브랜치 | `main` 기준(이 정리는 `docs/handoff-cleanup` 브랜치) |
| 다음 수신자 | 사람 |

### BE에서 오래 가는 정보
- 운영 BE는 Render 무료, DB는 Supabase(Session pooler 5432, 단일 baseline 마이그레이션). 상태·환경변수·주의는 `inote` 레포의 `docs/handoff/HANDOFF.md`가 기준이다.
- 기능·API 목록은 여기에 옮겨 적지 않는다 — Swagger(`/api/docs`)와 `docs/devlog/be.md`, `src/`가 소스다.
- **임베딩(KURE)**: 전체 상태·로컬 실행법은 `inote` 레포 `docs/kure/HANDOFF.md`. `EMBEDDINGS_ENABLED`는 기본 **꺼짐**이고 운영에 설정하지 않았다(꺼져 있으면 `GET /blog/posts/:id/similar`는 `200 {"items":[]}`, 볼 수 없는 글은 404). `SIMILAR_MIN_SCORE`는 기본 0.6(임시 — A7 평가로 확정). **켜기 전에 반드시 할 일**(보관한 글 제외)은 `inote` 레포 `docs/todo/backlog.md` 1절. 운영에서 켜는 순서는 `docs/kure/PLAN.md` 8절.
- **로컬 개발 DB**: `scripts/dev-db.sh up|migrate|seed|backfill|psql|url`(개발 DB는 localhost:5435, 비밀번호는 gitignore된 `.env.dev`). 시드 사용자 `dev-user-a`·`dev-user-b`. 백필은 BE DB·AI 서버의 짝이 어긋나면 거절한다(`docs/runbooks/embeddings-backfill.md`).
- **테스트**: 전체 `pnpm test`(2026-11-13 실행) — 41개 스위트, 535 통과 / 124 `it.todo` / 실패 0. `it.todo`는 사용자가 직접 작성한다(각 spec 맨 위 주석에 준비·약속·함정).
- **주의 — `prisma-dbml-generator` 버그**: `schema.prisma`에 새 `///` 주석을 넣으면 길이에 따라 `schema.dbml`의 관련 없는 한글이 깨질 수 있다. 스키마를 바꾼 뒤 `schema.dbml`에 `�`가 없는지, diff가 추가한 줄뿐인지 확인한다.

### 알려진 이슈
- 로컬과 운영이 같은 Supabase DB를 쓴다 (dev/prod 분리 없음) — 로컬 BE는 `DATABASE_URL`에 `?connection_limit=2&pool_timeout=20`을 붙여 실행해야 풀러(최대 15)가 차지 않는다
