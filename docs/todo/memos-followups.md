# 할 일 — 메모 여러 장(1:N) 후속

> 2026-11-10 메모를 대상당 여러 장으로 확장하면서 일부러 미룬 것. 계약은 `inote` 레포 `docs/todo/memo.md`의 "2차".

## 지금 할 것
- [ ] **개발 DB 통합 확인** — `scripts/dev-db.sh`로 BE를 띄우고 FE와 함께 확인한다. 손으로 쓴 마이그레이션(`20261110000000_add_memo_title`)이 적용되는지, `+`가 `{targetType, targetId}`만 보내 201이 되는지, 11장째 409, `DELETE` 204. ⚠️ 로컬 BE 기본 `DATABASE_URL`은 운영 DB다.

## 알려진 한계 (일부러 허용)
- [ ] **동시에 `POST`하면 10장을 넘을 수 있다** — `count`와 `create`를 한 트랜잭션에 묶었지만 기본 격리 수준(Read Committed)이라 같은 대상에 거의 동시에 두 요청이 오면 둘 다 9장으로 읽어 11장이 된다. 개인 앱의 UX 상한이라 허용했다. 보장이 필요해지면 `Serializable` 격리 수준(실패 시 재시도·409 매핑) 또는 대상 행 잠금(`SELECT ... FOR UPDATE`/advisory lock)을 사람이 정한다.
