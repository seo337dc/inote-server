# 할 일 — 관리자 임베딩 목록 API 후속

> 2026-11-06 `GET /admin/embeddings`(1단계)를 만들면서 커밋 전 refactor-advisor 점검에서 **일부러 미룬 것**. 계약과 단계 계획은 `inote` 레포 `docs/todo/admin-embeddings.md`.
> 끝낸 항목은 완료일을 적고 아래 "완료"로 옮긴다.

## 지금 할 것
- [ ] **통합 확인** — 개발 DB(`scripts/dev-db.sh`)로 BE를 띄우고 `inote-ai`(개발 DB 5434)·FE와 함께 화면에서 확인한다. 계약대로 응답하는지(MSW 목과 같은지)가 목적이다. ⚠️ 로컬 BE의 기본 `DATABASE_URL`은 운영 DB다.

## 미룬 리팩토링 (급하지 않음)
- [ ] **`AdminEmbeddingsService.list` 분해(P1)** — 한 함수가 조회·AI 호출·판정·행 조립·정렬·필터·페이지·응답 조립을 한다(약 60줄). 행 조립(`NO_EMBEDDING` 폴백 포함)과 `summarize`(`this`를 쓰지 않는다)를 순수 함수로 빼면 Prisma·AI mock 없이 테스트할 수 있다. 정렬·필터·페이지는 한 흐름이라 더 쪼개면 읽기 어려울 수 있으니, 다음에 이 파일을 크게 고칠 때 같이 판단한다.
- [ ] **`totalPages` 계산 공통화(P1)** — `Math.max(1, Math.ceil(total / pageSize))`가 `admin-users.service.ts`와 `admin-embeddings.service.ts` 두 곳에 있다. 두 번째 복사본이라 그대로 뒀다. **세 번째 목록 API가 생기면 그 자리에서 공통 헬퍼로 뽑는다**(프로젝트 규칙).
- [ ] **필터 값을 한 곳에서 정의(P2)** — 상태 탭 값 5개가 DTO의 `EMBEDDING_FILTERS`(배열)와 `embedding-status.ts`의 `EmbeddingFilter`(유니언 타입)에 따로 있다. 배열에서 타입을 파생하면 어긋나지 않는다. 화면을 만들면서 탭이 바뀔 수 있어 그때 다시 정한다.

## 알아둘 점
- 대상 글(비공개·보관·임시저장 제외)이 하나도 없으면 상태 조회를 건너뛰어서 `aiAvailable`이 `true`로 나온다(실제 AI 응답 여부는 확인하지 않은 값).
- spec 맨 위 설명 주석 일부에 "구현 예정" 표현이 남아 있다(`admin-embeddings.service.spec.ts`, `inote-ai-embedding-status.spec.ts`, `admin-embeddings.api.spec.ts`) — 구현이 끝났으니 다음에 손볼 때 정리한다.
- `inote-ai-embeddings.spec.ts`·`similar-posts.spec.ts`의 `it.todo`가 채워지면 같은 `beforeEach/afterEach`(fetch spy, env 복원)가 spec 3개에 생긴다. 그때 공통 헬퍼로 모은다(세 번째 반복).
