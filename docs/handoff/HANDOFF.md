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
| 다음 수신자 | Claude Code (inote-money) — FE에서 `/money/mini-game/results` 연동 |

### 완료된 단계

- **MiniGameResult 모델 + 결과 저장 API 구현** — `inote-money`의 `/demo/mini-game`(쥐경주 탈출 보드게임) 플레이 결과를 기록해, 추후 AI가 결과를 분석해 조언하는 기능의 기반 데이터로 사용할 목적
  - Prisma: `MiniGameResult` 모델(요약 컬럼 + JSON 스냅샷 `finalStocks`/`finalRealEstates`/`liabilitiesSnapshot`/`gameLogs`) + `GameResult` enum(`WON`/`GAVE_UP`), 한 테이블에 정리(요약+상세 JSON) — row 단위 SQL 집계가 필요 없는 용도라 정규화 대신 이 방식 선택
  - API 3개: `GET /money/mini-game/results`, `GET /money/mini-game/results/:id`, `POST /money/mini-game/results`
  - `src/money/mini-game/` (controller/service/dto), `money.module.ts` 등록
- **마이그레이션 drift 발생 → 안전하게 우회** — `prisma migrate dev`가 히스토리 drift 감지 후 `migrate reset`(전체 데이터 삭제)을 제안 → 실행하지 않음. `prisma db pull`로 읽기 전용 인트로스펙션 먼저 해서 실제 DB가 이미 schema.prisma와 일치함을 확인 후, `prisma db push`로 `MiniGameResult`만 안전하게 추가 (2026-07-06 SettingHistory 때와 동일 방식)
- 타입체크·lint 통과, 로컬 서버 부팅 후 라우트 정상 등록·미인증 401 확인

### 진행 중 / 다음 Task

1. **Claude Code (inote-money):** `/demo/mini-game`에서 로그인 세션 체크 → 로그인 시에만 승리(`WON`)/중도포기(`GAVE_UP`) 시점에 `POST /money/mini-game/results` 호출
2. FE 연동 후 사람이 실제 저장/조회 확인

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
```

### 알려진 이슈

- 마이그레이션 히스토리(`prisma/migrations/`)와 실제 DB 간 drift가 이미 존재함 (memo/nickname/phone/SettingHistory가 과거 `db push`로만 반영되고 마이그레이션 파일이 없음). 실제 스키마 구조는 서로 일치해서 당장 문제는 없지만, `migrate dev`를 쓰면 계속 이 경고가 뜸 — 근본 해결(베이스라인 마이그레이션 생성)은 이번 범위 밖이라 하지 않음.

### 다음 수신자에게 기대하는 것

**Claude Code (inote-money 세션):**
- FE에서 위 API 연동, 승리/포기 시점 판단 로직 확인 필요
- 연동 후 사람이 로그인해서 실제 저장/조회 테스트

### QA 판정

BE: 라우트 등록·401 응답 확인 (PASS). 로그인 후 실제 CRUD는 FE 연동 후 사람 확인 예정 — 미수행.
