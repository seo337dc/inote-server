# 로컬 개발 DB (도커) — 운영 DB와 분리

> 지금까지 `.env`의 `DATABASE_URL`은 **운영 DB(Supabase)**였고, 로컬 BE도 그대로 써서 로컬에서 글·사용자를 만들거나 지우면 운영 데이터에 영향이 갔다.
> 이 문서의 개발 DB는 **이 PC 안의 Postgres**라서 마음대로 만들고 지워도 운영에 영향이 없다. (KURE 임베딩 작업 A6-1에서 만들었다 — inote 레포 `docs/kure/PLAN.md`)

## 구성
| 파일 | 역할 |
|---|---|
| `docker-compose.dev.yml` | Postgres 17(`pgvector/pgvector:pg17` 이미지를 재사용 — BE는 vector 확장을 쓰지 않는다), `127.0.0.1:5435`, DB `inote_dev`, 사용자 `inote` |
| `.env.dev` (gitignore) | 개발 DB 비밀번호 `INOTE_DEV_DB_PASSWORD`. `cp .env.dev.example .env.dev` 후 `openssl rand -hex 16` 값을 넣는다 |
| `scripts/dev-db.sh` | 위 DB를 다루는 도우미. **항상 로컬 개발 DB 주소를 스스로 만들어** `DATABASE_URL`을 덮어쓴다(운영 주소를 쓰지 않는다) |
| `prisma/seed-dev.ts` | 개발 DB 시드 |

## 사용
```bash
cp .env.dev.example .env.dev      # INOTE_DEV_DB_PASSWORD를 채운다
scripts/dev-db.sh up              # DB 시작 (5435)
scripts/dev-db.sh migrate         # prisma migrate deploy 를 개발 DB에 적용
scripts/dev-db.sh seed            # 시드 (여러 번 실행해도 안전)
scripts/dev-db.sh backfill        # 개발 DB 글을 로컬 AI 서버에 임베딩 (docs/runbooks/embeddings-backfill.md)
scripts/dev-db.sh start           # BE를 개발 DB로 실행 (pnpm run start:dev, 3200)
scripts/dev-db.sh psql            # DB 접속
scripts/dev-db.sh down | reset    # 정지(데이터 유지) | 삭제 후 다시 만들기
```
BE를 개발 DB로 띄웠는지 확인하려면 `GET /api/v1/blog/posts`의 `total`을 본다 — 시드가 만든 값(공개 글 23개)이면 개발 DB, 운영 글 수면 운영 DB다.

## 시드 내용
- **공개 글**: 배포된 사이트의 **공개 목록 API**에서 가져온 공개 글(글 id·제목·본문·카테고리 그대로). 비공개·임시저장 글은 이 API가 내려주지 않고, 스크립트가 한 번 더 걸러 넣지 않는다.
- **작성자는 가상 사용자**(`dev-user-a`, `dev-user-b`…, 이메일 `…@example.test`)로 바꿔 넣는다. 실제 사용자 정보는 개발 DB에 옮기지 않는다. 글이 많은 작성자부터 a, b 순서.
- **테스트용 글**(id가 `dev-seed-`로 시작) — 공개 범위 규칙을 로컬에서 실제 데이터로 확인하는 용도:
  | id | 상태 | 용도 |
  |---|---|---|
  | `dev-seed-a-private-docker` | A의 **비공개** | 공개 도커 글과 **내용이 비슷하다** → 비슷해도 남에게 후보로 나오면 안 된다 |
  | `dev-seed-a-private-career` | A의 비공개 | 내용이 다른 비공개 글 |
  | `dev-seed-a-draft` | A의 **임시저장** | 임베딩 대상이 아니다 |
  | `dev-seed-b-public` / `dev-seed-b-private` | B의 공개 / 비공개 | 다른 사용자 사이의 공개 범위 (B의 비공개는 B의 공개 글과 비슷하다) |
- **카테고리 트리**: 글의 `categoryPath`로 사용자별 트리를 만든다.
- 실행하면 `공개 23 · 비공개 3 · 임시저장 1`이 된다(운영 공개 글 수에 따라 달라질 수 있다).

## 안전장치와 주의 (중요)
- **시드는 운영 DB에 절대 실행되지 않는다.** `DATABASE_URL`의 호스트가 로컬(`127.0.0.1`/`localhost`)이 아니거나, DB 이름이 `_dev`로 끝나지 않거나, `NODE_ENV=production`이면 연결하기 전에 거절한다.
- ⚠️ **`@prisma/client`는 `DATABASE_URL`이 없으면 `.env`(운영 주소)를 자동으로 읽는다.** 그래서 `npx ts-node prisma/seed-dev.ts`처럼 직접 실행하면 운영 주소가 잡힌다 — 안전장치가 거절하지만, 항상 `scripts/dev-db.sh seed`로 실행한다. 같은 이유로 `npx prisma migrate …`도 직접 부르지 말고 `scripts/dev-db.sh migrate`를 쓴다.
- 로컬 BE를 개발 DB로 띄워도 `.env`의 다른 값(인증 시크릿, `INOTE_AI_URL=http://localhost:8000` 등)은 그대로다. 로그인(구글)이나 AI 호출이 필요한 시험은 그 값을 확인하고 한다.
- `prisma/seed-dev.ts`는 **운영 빌드 대상에서 제외**했다(`tsconfig.build.json`의 `exclude`, 기존 `seed-mandalart.ts`와 같은 방식). 빼지 않으면 `nest build`가 `rootDir` 오류로 실패한다.
- 개발 DB 포트: 5435 (참고: 5433은 `inote-embedder` 실험 DB, 5434는 `inote-ai` 개발 DB).
