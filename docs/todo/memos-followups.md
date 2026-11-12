# 할 일 — 메모 여러 장(1:N) 후속

> 2026-11-10 메모를 대상당 여러 장으로 확장하면서 일부러 미룬 것. 계약은 `inote` 레포 `docs/todo/memo.md`의 "2차".

## 완료
- [x] **개발 DB 통합 확인 (2026-11-10)** — 새 빈 개발 DB(도커)에 마이그레이션을 처음부터 적용해 `20261110000000_add_memo_title`이 적용되고 `prisma migrate diff`가 "No difference detected"인 것을 확인했다. 개발 DB로 띄운 BE에 HTTP 24개 시나리오(대상만 보낸 POST 201, title 수정·지우기, `{}`·31자 400, 타인 404·403, 10장 상한 409, DELETE 204·재삭제 404, 비로그인 401)가 모두 통과했고, 실제 FE(글쓰기 화면)에서도 첫 입력 POST·`+`·이름 변경 PATCH·새로고침 복원·DELETE·10장에서 `+` 비활성이 계약대로 동작했다.

## 알려진 한계 (일부러 허용)
- [ ] **동시에 `POST`하면 10장을 넘을 수 있다** — `count`와 `create`를 한 트랜잭션에 묶었지만 기본 격리 수준(Read Committed)이라 같은 대상에 거의 동시에 두 요청이 오면 둘 다 9장으로 읽어 11장이 된다. 개인 앱의 UX 상한이라 허용했다. **실측(2026-11-10): 같은 대상에 POST 14개를 동시에 보내면 201이 12개(실제 12장 저장), 409가 2개**였다 — 상한을 넘을 수 있다는 게 확인됐다. 보장이 필요해지면 `Serializable` 격리 수준(실패 시 재시도·409 매핑) 또는 대상 행 잠금(`SELECT ... FOR UPDATE`/advisory lock)을 사람이 정한다.

## 3차(일반 메모·전체 조회) 후속 — 커밋 전 refactor-advisor 점검(2026-11-12)
> 계약은 `inote` 레포 `docs/todo/memo.md`의 "3차". 정렬은 항상 최근 수정순이고, 대상별 조회로 탭을 그리는 FE가 `createdAt`으로 다시 정렬한다.
- [ ] general 판정(`=== 'general'` → `GENERAL_TARGET_ID`)이 서비스 `create`·`targetWhere` 두 곳과 DTO 검증에 있다 — 세 번째 사용처가 생기면 `memo-target.ts`에 `resolveTargetId(type, id?)`로 모은다 (`create`는 소유 검증 생략도 함께라 지금은 그대로)
- [ ] `targetTitles`·`assertOwnTarget`이 post/reading 두 종류를 하드코딩 — 메모 종류가 세 번째로 늘 때 종류 → (조회 delegate, 오류 문구) 테이블로 묶는다
- [ ] `memos.service.spec.ts`가 800줄에 가깝다 — 다음에 이 파일을 크게 고칠 때 메서드별 파일로 나누는 것을 검토
- [ ] `GENERAL_TARGET_ID`가 빈 문자열이라 `targetId: ''` 쿼리와 구분이 안 된다(DTO가 `@IsNotEmpty`로 막고 있어 지금은 문제 없음)
- [ ] 배포: FE와 같은 시기에 — 정렬이 생성순 → 수정순으로 바뀌어 FE 정렬이 먼저 나가지 않으면 글쓰기 메모장 탭 순서가 달라진다
