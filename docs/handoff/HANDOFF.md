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
| 날짜 | 2026-07-16 |
| 작성자 | Cursor |
| 브랜치 | `main` |
| 다음 수신자 | 사람 (Notion OAuth) → Cursor (연결 검증) |

### 완료된 단계

- BE Cursor 지침: `CURSOR.md`, `.cursor/rules/` (`cursor-role`, `qa-handoff`, `be-context`, `handoff-session`)
- `docs/handoff/HANDOFF.md` + `CLAUDE.md` 상단 HANDOFF 필독
- BE Notion URL 6개 정리 (`CURSOR.md`, `CLAUDE.md` 문서 관리)
- Notion MCP: `.cursor/mcp.json` → `https://mcp.notion.com/mcp`
- (기존) Money Expenses/Stocks/Settings/SettingHistory/Reviews, Better Auth, Render 배포

### 진행 중 / 다음 Task

1. **사람:** Cursor Settings → Tools & MCP → `notion` → Connect / OAuth 완료
2. OAuth 후 Cursor가 BE Notion 본문 읽기 테스트 (+ 선택: CLAUDE.md ↔ Notion 동기화)
3. 미커밋 문서 commit/push — 사람 요청 시
4. 이후 본업: `CLAUDE.md` 현재 단계 기준 다음 기능 Task — 사람 확정 후 Claude Code

### 이번 범위

**해도 됨**
- Notion MCP 세팅·BE Notion URL 문서화·OAuth 안내·연결 검증 ✅ (OAuth는 사람)

**하지 말 것**
- FE Notion을 BE 본문으로 사용
- NestJS/API 기능 구현
- 커밋/push (사람 요청 전)
- FE 레포 수정

### 변경·참고 파일

- `.cursor/mcp.json` (신규)
- `CURSOR.md` (Notion URL + MCP 안내)
- `CLAUDE.md` (문서 관리 Notion 표)
- `docs/handoff/HANDOFF.md`
- `.cursor/rules/handoff-session.mdc` (신규)
- `.cursor/rules/be-context.mdc` (Notion 안내)

### 알려진 이슈

- Notion MCP는 **OAuth 완료 전** 페이지를 읽을 수 없음
- 관련 파일 **미커밋** — `git status` 확인 필요

### 다음 수신자에게 기대하는 것

**사람:**
1. Cursor Settings → Tools & MCP → `notion` → Connect / Authenticate
2. Notion 로그인 후 **inote-server** 관련 페이지 접근 허용
3. 완료되면 채팅에 "연결됨"이라고 알려주기

**Cursor (OAuth 후):**
- BE Notion 본문 fetch 테스트 후 결과 보고
- (선택) CLAUDE.md ↔ Notion 본문 동기화

### QA 판정

해당 없음 (문서·MCP 세팅 Task)
