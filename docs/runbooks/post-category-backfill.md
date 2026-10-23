# 기존 글의 categoryId 채우기 (백필)

> 글(`Post`)이 카테고리를 이름 문자열(`category`)로만 가리키던 시절의 글에 `categoryId`를 채운다. 설계: inote 레포 `docs/CATEGORY_ID.md`.

## 규칙 (자동으로 잇는 조건)
글 **작성자의** 카테고리 중 이름이 **정확히 하나** 맞는 글만 `categoryId`를 채운다.

| 경우 | 처리 |
|---|---|
| 이름이 하나 맞음 | 그 카테고리 id로 잇는다 (`--apply`일 때만 쓴다) |
| 같은 이름이 둘 이상 (예: `학습 > AI`, `사이드프로젝트 기록 > AI`) | 잇지 않고 **후보(경로·id)와 함께 목록으로** 보여준다 → 글 이동 기능으로 직접 지정 |
| 맞는 이름이 없음 (카테고리를 지웠거나 이름을 바꾼 글) | 잇지 않고 목록으로 보여준다 |
| 작성자 없음 / 카테고리 이름이 빈 글 | 대상에서 뺀다(개수만 표시) |

이미 `categoryId`가 있는 글은 대상이 아니라서 **여러 번 실행해도 안전**하다. 쓰기는 `categoryId`가 아직 null인 글에만 걸린다(그 사이 사용자가 저장해 지정된 글은 덮어쓰지 않는다).

## 사용
```bash
# 로컬 개발 DB (항상 개발 DB 주소를 스스로 만들어 쓴다 — scripts/dev-db.sh)
scripts/dev-db.sh backfill-category                 # dry-run: 무엇을 이을지·직접 지정할 글만 보여준다 (아무것도 쓰지 않음)
scripts/dev-db.sh backfill-category --apply         # 실제로 채운다
scripts/dev-db.sh backfill-category --user 사용자ID  # 한 사용자만

# .env의 DB (운영일 수 있음) — 원격이라 --allow-remote가 꼭 필요하다
pnpm post-category:backfill --allow-remote          # dry-run
pnpm post-category:backfill --allow-remote --apply  # 실제로 채운다
```

## 안전장치
- **기본은 dry-run** — `--apply`를 줘야만 쓴다.
- **원격 DB는 `--allow-remote` 없이는 연결하지 않는다.** 실행 첫 줄에 `대상 DB: host/db`가 출력된다(비밀번호는 출력하지 않음).
- 추가 전용: `categoryId` 컬럼 하나만 채운다. 글 내용·카테고리·다른 컬럼은 건드리지 않는다.

## 운영에 적용하는 순서
1. 마이그레이션 `20261016000000_add_post_category_id`가 적용돼 있어야 한다 (Render 배포 때 `prisma migrate deploy`가 자동 실행).
2. **dry-run으로 결과를 먼저 본다** → `자동으로 이을 수 있음` 개수와 `직접 지정 필요` 목록이 기대와 맞는지 확인.
3. 맞으면 `--apply`.
4. 남은 글(같은 이름이 둘 이상)은 FE의 글 이동 기능으로 직접 지정한다. 지정 전까지 그 글은 "연결 안 된 글"(`unassigned`)로 보인다.
5. FE(`inote`의 `feat/category-id`)를 배포한다 — 옛 FE는 새 응답 모양과 맞지 않는다.

## 코드
- 판정·안전장치·요약: `src/categories/post-category-backfill.ts` (테스트 `post-category-backfill.spec.ts`)
- 실행 스크립트: `scripts/backfill-post-category-id.ts`
