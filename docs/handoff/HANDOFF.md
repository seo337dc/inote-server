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
> **레포 3개에 걸친 최신 handoff는 `inote` 레포의 `docs/handoff/HANDOFF.md`를 먼저 읽는다.** 아래는 BE 관점 요약.

### 메타

| 항목 | 값 |
|------|-----|
| 날짜 | 2026-09-30 |
| 작성자 | Claude Code |
| 브랜치 | `main` |
| 다음 수신자 | 사람(다른 PC에서 이어감) |

### BE 상태 요약
- 운영 BE는 Render 무료(서비스 1개만 상시, 월 750시간 한도에 거의 붙어 있음), DB는 **Supabase**(Session pooler 5432, 단일 baseline 마이그레이션)로 이전 완료 — 자세한 상태·환경 변수·주의는 `inote` 레포의 `docs/handoff/HANDOFF.md`가 기준. cron-job의 Inote Server 작업 켜기 확인 필요
- Koyeb 이전은 취소(신규 무료 플랜 없음) — `Dockerfile`·관련 문서는 제거함
- 이번에 추가된 BE 기능: `thumbnailUrl`, 고정 글 별도 페이지네이션(`pinnedPage`), AI 다시 요약하기(`POST /blog/posts/:id/summarize`), 카테고리 트리용 글 목록(`GET /blog/posts/outline`), 목록 검색(`q`)·수정 시각(`lastEditedAt`)
- **2026-10-07 추가**: 글 상세·목록 응답의 `categoryPath`(작성자 카테고리 트리 기준 경로), 목록 `category` 필터가 하위 카테고리 글까지 포함(`categoryFilter`, 검색과는 `combineWhere`로 AND), 내 글 목록 `GET /blog/posts/mine/outline`(#7). **테스트는 아직 없고 목록이 `src/blog/blog.service.spec.ts`의 `TODO(테스트)` 주석에 있다**; 공개 글 목록 작성자 필터 `GET /blog/posts?userId=`(그 작성자의 공개 글만, 응답에 `author {id,name}` — 없는 사용자면 null). **카테고리 이름 중복은 BE `create`가 막지 않는다**(FE에서만 막음)

### 진행 중: 카테고리 이름 수정 API (#6)
- 테스트 작성 완료(**구현 전이라 일부러 실패 상태**): `src/categories/categories.rename.spec.ts`(12), `src/categories/dto/rename-category.dto.spec.ts`(7)
- 자리표시자: `dto/rename-category.dto.ts`(규칙 없음), `categories.service.ts`의 `rename`(항상 오류)
- 다음: DTO(`@Transform` 공백 정리 + 1~50자) → 서비스 `rename` → 컨트롤러 `PATCH /categories/:id` 구현해 테스트를 통과시킨다

### 이어질 BE 작업
- ✅ #7 `GET /blog/posts/mine/outline` — 구현 완료(10/7), 테스트만 남음
- #8 카테고리 위치 이동 `PATCH /categories/:id/move` — 골격 `categories.move.spec.ts`(38 todo), `position` 컬럼 필요 → Supabase 기준선과 함께
- Neon → Supabase 이전은 끝남(`docs/supabase-migration.md`). Neon은 롤백용으로 아직 삭제하지 않음

### 알려진 이슈
- 전체 `npx jest`는 #6 구현 전까지 실패(정상)
- 로컬과 운영이 같은 Supabase DB를 쓴다 (dev/prod 분리 없음) — 로컬 BE는 `DATABASE_URL`에 `?connection_limit=2&pool_timeout=20`을 붙여 실행해야 풀러(최대 15)가 차지 않는다
