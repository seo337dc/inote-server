# 기존 글 임베딩 백필

이미 발행된 글의 벡터를 inote-ai(AI DB)에 한 번에 채우는 스크립트입니다. 저장·삭제 훅(`EMBEDDINGS_ENABLED`)은 **앞으로 저장하는 글**만 다루므로, 기존 글은 이 스크립트로 채웁니다.
설계: inote 레포 `docs/kure/PLAN.md` (A6-5).

## 무엇을 하나

- **발행된 글만**(비공개 포함) 하나씩 `PUT {INOTE_AI_URL}/embeddings/posts/{id}`로 보냅니다. 임시저장 글은 저장 훅도 임베딩하지 않으므로 제외입니다.
- 제목·본문이 모두 빈 글은 건너뜁니다.
- 글 하나씩 차례로 보냅니다(동시 실행 없음). **다시 실행해도 안전합니다** — 내용·모델이 같으면 inote-ai가 "변경 없음"으로 건너뜁니다.
- `EMBEDDINGS_ENABLED` 스위치와 무관하게 동작합니다(스위치를 켜기 전에 채워 두는 작업이기도 합니다).
- 출력에는 글 id만 나옵니다(제목·본문 없음). 연속 5번 실패하면 서버 문제로 보고 멈춥니다. Ctrl+C는 지금 글까지만 하고 멈추며(종료 코드 130), 한 번 더 누르면 즉시 종료합니다.

## 로컬 (개발 DB → 로컬 AI 서버)

```bash
scripts/dev-db.sh backfill --dry-run      # 무엇을 보낼지만 확인 (아무것도 보내지 않음)
scripts/dev-db.sh backfill                # 실행
scripts/dev-db.sh backfill --limit 3      # 앞의 3개만
scripts/dev-db.sh backfill --only 글ID    # 글 하나만
```

`INOTE_AI_URL`(기본 `.env`의 `http://localhost:8000`)과 `INTERNAL_SECRET`은 로컬 AI 서버와 맞아야 합니다.
로컬 AI 서버는 **개발 AI DB**에 붙여 띄우세요(`inote-ai/README.md`의 "이 DB로 서버 띄우기"). 그냥 띄우면 `inote-ai/.env`의 운영 `DATABASE_URL`을 읽습니다.

## 안전장치 — 짝이 어긋난 대상은 실행하지 않는다

로컬 AI 서버가 DB에 붙는 것 자체는 문제가 아닙니다. 막는 것은 **BE DB와 AI 서버의 짝이 어긋나는 경우**입니다.

| BE DB | AI 서버 | 동작 | 왜 |
|---|---|---|---|
| 로컬 | 로컬 | 실행 | 개발 |
| 운영 | 로컬 | **항상 거절** | 운영 글(비공개 포함)이 이 PC의 AI 서버로 가서, 그 서버가 가리키는 DB에 쌓인다 |
| 로컬 | 운영 | **항상 거절** | 개발용 시드 글의 벡터가 운영 AI DB에 섞인다 |
| 운영 | 운영 | `--allow-remote`가 있을 때만 | 실제 백필 |

이 PC의 `.env`는 `DATABASE_URL`이 운영 DB, `INOTE_AI_URL`이 `localhost`라서 그대로 `pnpm embeddings:backfill`을 실행하면 "운영 → 로컬" 조합으로 거절됩니다. 실행 전에 항상 `대상: BE DB … → AI 서버 …` 줄이 출력되니 확인하세요.

## 운영 백필 (배포 순서 ⑤)

PLAN 8절 순서에서 AI DB 테이블·AI 서버·BE 훅 배포가 끝난 뒤에 합니다.

1. 운영 값을 가진 환경에서 먼저 `--dry-run`으로 대상 확인:
   `DATABASE_URL=<운영 BE DB> INOTE_AI_URL=<운영 AI> INTERNAL_SECRET=<…> pnpm embeddings:backfill --dry-run --allow-remote`
2. 소량으로 시험: `… --limit 3 --allow-remote`
3. 전체 실행: `… --allow-remote` — 실패 목록이 나오면 원인(AI 서버·임베딩 서비스)을 고치고 **그대로 다시 실행**하면 이미 된 글은 건너뛰고 나머지를 채웁니다.
