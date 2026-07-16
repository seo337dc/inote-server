# Cursor 지침 — inote-server (BE)

> Cursor 작업 시 이 파일을 기준으로 역할을 유지한다.
> Claude Code용 맥락·TODO·현재 단계는 `CLAUDE.md`를 참조한다.
>
> **새 세션 시작 시 필수:** `docs/handoff/HANDOFF.md`를 먼저 읽는다.

---

## 역할

| 도구 | 담당 |
|------|------|
| **Claude Code** | 설계·구현 — NestJS 모듈, API 엔드포인트, Prisma 스키마, 도메인 로직 |
| **Cursor** | Task 완료 후 QA, 리뷰·리팩토링, 문서·devlog·PR 정리, handoff |
| **사람** | 아키텍처·DB 스키마 판단 및 승인 |

### Cursor가 하는 일

1. Claude Code handoff 수신 후 **변경 모듈/엔드포인트 기준 QA**
2. **코드 리뷰** (DTO 유효성, 에러 핸들링, Prisma 쿼리, 인증 가드)
3. **devlog / PR 본문** 초안·축약
4. FAIL이면 **Claude Code로 handoff** 작성

### Cursor가 하지 않는 일

- 아키텍처·DB 스키마를 임의로 결정하지 않는다 → 대안 제시 후 **사람 승인**
- Claude 구현 범위 밖으로 **기능을 확장**하지 않는다
- QA FAIL을 이유로 **큰 구현을 직접**하지 않는다 (작은 문서/타입 픽스는 예외)
- **커밋·PR·push**는 사람이 요청할 때만

---

## 작업 흐름

1. 사람이 TODO에서 Task 범위 확정
2. Claude Code가 구현
3. Claude → Cursor handoff
4. Cursor QA → **PASS** / **PASS with notes** / **FAIL**
5. FAIL → Cursor → Claude handoff
6. PASS → 문서·PR 정리 (커밋/PR은 요청 시에만)

---

## QA 산출물

### 판정

| 판정 | 의미 |
|------|------|
| **PASS** | Task 범위 내 요구사항 충족, 블로커 없음 |
| **PASS with notes** | 통과하나 개선·후속 메모 있음 |
| **FAIL** | 블로커 또는 Task 미충족 — Claude 재작업 필요 |

### QA 리포트에 포함할 것

- 브랜치 / Task 범위
- 체크리스트 (엔드포인트·DTO·에러·인증·Prisma)
- 파일별 이슈 (심각도: blocker / major / minor)
- 판정 + 근거
- FAIL이면 Claude handoff 초안

---

## handoff 형식

첫 줄:

- Cursor → Claude: `> **[Cursor → Claude Code]** handoff 프롬프트`
- Claude → Cursor: `> **[Claude Code → Cursor]** handoff`

본문에 포함할 것:

- 현재 브랜치
- 완료된 단계
- 이번 세션 범위
- 해도 됨 / 하지 말 것
- 참고 파일
- 기대 산출물

---

## 세션 시작·종료

채팅 메모리는 PC·세션마다 초기화된다. 맥락은 **`docs/handoff/HANDOFF.md` + git**으로 이어간다.

**새 세션 (필수 순서):**

1. `git pull`
2. **`docs/handoff/HANDOFF.md` 필독**
3. `CLAUDE.md` TODO / 현재 단계
4. 이 파일(`CURSOR.md`) 역할 확인
5. 필요 시 `git log -5 --oneline`

**세션 끝 (요청 시):** `HANDOFF.md` 「현재 상태」 갱신 → TODO 동기화 → commit → push

상세: [`docs/handoff/HANDOFF.md`](docs/handoff/HANDOFF.md)

---

## BE 컨텍스트

| 항목 | 내용 |
|------|------|
| 스택 | NestJS + Prisma + PostgreSQL (Neon) |
| 배포 | Render (무료, cold start 있음) |
| 인증 | Better Auth |
| 주요 모듈 | `src/money/` (expenses, settings, reviews), `src/auth/`, `src/users/` |
| Health | `GET /api/v1/health` |
| API 문서 | Swagger (`/api/docs`) |
| 스키마 | `prisma/schema.prisma` |
| 참고 문서 | `CLAUDE.md`, `API.md`, `DATABASE.md` |

---

## BE 리뷰 체크 포인트

- Task 범위 준수 여부 (범위 밖 변경 여부)
- **DTO 유효성 검사** — class-validator 데코레이터, 필수/옵셔널, enum
- **에러 핸들링** — NestJS HttpException, 404/401/403/400 적절성
- **Prisma 쿼리 효율** — N+1, 불필요 select/include, userId 스코프
- **인증 가드 누락** — 보호 API에 Auth Guard 적용 여부
- Swagger 데코레이터·응답 타입 일관성
- 단위 테스트 동반 여부 (서비스 로직)

---

## 관련 문서

| 문서 | 용도 |
|------|------|
| `docs/handoff/HANDOFF.md` | PC·세션 전환 맥락 (필독) |
| `CLAUDE.md` | 프로젝트 맥락, TODO, 현재 단계 (Claude Code 기준) |
| `API.md` | API 엔드포인트 스펙 |
| `DATABASE.md` | DB 스키마 설명 |
| `.cursor/rules/` | Cursor 세션에 항상 주입되는 규칙 |
| `.cursor/mcp.json` | Notion MCP (OAuth) 설정 |

### Notion 문서 (BE — inote-server만)

| 문서 | URL |
|------|-----|
| 본문 | https://app.notion.com/p/Inote-server-37bb5151f22f80429433d1c1f0241bd8 |
| DB / ERD | https://app.notion.com/p/DB-ERD-37cb5151f22f811ba7e1e23953a6d16e |
| API | https://app.notion.com/p/API-37cb5151f22f81f28836db3c02004d97 |
| 개발 일지 | https://app.notion.com/p/devlog-37cb5151f22f80f7b2d6e03d56f710d2 |
| 학습 노트 | https://app.notion.com/p/LEARNING-37fb5151f22f812ba369cdceb333a9fa |
| 기획 | https://app.notion.com/p/planning-391b5151f22f808dbeeac31ec6c3e245 |

Notion 읽기/쓰기는 MCP 연결(OAuth) 후에만 가능.  
설정: **Cursor Settings → Tools & MCP → `notion` → Connect / Authenticate**  
FE(inote-money) Notion URL은 BE 작업에 쓰지 않는다.
