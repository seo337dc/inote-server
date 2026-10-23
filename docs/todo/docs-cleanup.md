# 할 일 — md 문서 정리 (제거 / 수정 / 완료 처리)

> 2026-10-23 점검. 문서 내용을 실제 코드(`src/`, `prisma/schema.prisma`, `.env.example`, `git log`)와 대조한 결과.
> 아직 아무것도 지우거나 고치지 않았다. 항목마다 승인받고 한 단위씩 진행한다.
> 같은 날 완료: 파일 위치 정리(`docs/learning`, `docs/runbooks`, `docs/adr`, `AUTH_POLICY`·`CURSOR` → `docs/`).

## A. 제거 (코드·다른 문서와 중복이거나 쓸모가 끝남)

- [ ] **`API.md` 삭제** — 컨트롤러 15개 중 users·money 일부만 있고 blog·categories·reading-logs·todos·uploads·mandalart·admin 등 대부분 없음. Swagger(`/api/docs`)가 진짜 소스. README·CLAUDE.md·CURSOR.md의 `API.md` 링크는 Swagger로 교체.
- [ ] **`DATABASE.md` 삭제** — 모델 20개 중 9개만 있고 `Review`를 "예정"으로 적음, DB도 Neon. `prisma/schema.prisma` + `prisma/dbml/schema.dbml`이 소스. 링크는 schema.prisma로 교체.
- [ ] **`DEV_LOG.md`의 낡은 상단부 제거** — "빠른 현황 파악"(현재 단계가 2026-09-11 기준), "다음 작업 예정"(체크박스가 거의 완료인데 낡음), "다른 노트북에서 작업 이어받기"(`DATABASE_URL = Neon`), "주요 기술 결정/인프라 결정 배경"(Neon·Amplify·Railway — 실제와 다름). 결정 배경은 ADR로 옮기고 나머지는 삭제.
- [ ] **HANDOFF.md의 끝난 섹션 제거** — "진행 중: 카테고리 이름 수정 API (#6)"(a6cc584로 구현·테스트 통과), "알려진 이슈"의 `rename` 실패 20건(해결됨).

## B. 수정 (사실과 다름)

- [ ] **Neon → Supabase** — 남은 곳: `README.md`(기술 스택·환경변수 주석·`channel_binding` 경고·인프라), `CLAUDE.md`(32·45·179·215·332행), `docs/CURSOR.md`(BE 컨텍스트), `docs/learning/TESTING_GUIDE.md`(E2E 표). 상세 목록은 `readme-update.md` 참고.
- [ ] **README.md** — `docs/todo/readme-update.md`의 체크리스트를 처리 (Users 완료 표시, `points/` 삭제, 구조·환경변수 보강, `migrate dev` 위험 안내 교체, `dev-db.sh` 기준 로컬 실행).
- [ ] **CLAUDE.md** — ① "현재 단계" 본문이 2026-09-22 기준이라 낡음(Users/Admin/AUTH_POLICY 중심) → 현황 표만 남기고 본문 삭제, ② 모듈 목록·레포 구조에 `categories/`·`todos/` 추가(`reading-logs`는 현황 표에만 있음), ③ 모델 목록에 `ReadingLog`·`ReadingLogSummary`·`Todo`·`PostCategory` 추가, ④ 환경변수에 `NODE_ENV`·`CF_*`·`R2_KEY_PREFIX` 추가, ⑤ 단위테스트 289개는 재측정 필요, ⑥ 미결정 항목의 `API.md/DATABASE.md/TESTING_GUIDE.md` 줄 삭제(A에서 처리됨).
- [ ] **`docs/adr/0001-neon-to-supabase.md`** — 상태가 "🟡 준비 중(아직 이전 시작 전)"인데 이전 완료됨. "Neon은 롤백용으로 보존" 사실과 함께 상태를 "✅ 완료"로. 파일 앞에 ADR 형식(상태·결정·이유·결과) 요약 추가.
- [ ] **HANDOFF.md** — 날짜 2026-10-12 → 갱신. 카테고리 이름 수정·`Post.categoryId`·이미지 업로드·글 삭제 이미지 정리가 빠져 있음. "다음 BE 작업"의 #8 이동 API(`categories.move.spec.ts` todo)만 남기기.
- [ ] **`docs/CURSOR.md`** — 주요 모듈이 money/auth/users뿐. 참고 문서의 `API.md`/`DATABASE.md` 줄 교체.
- [ ] **`docs/AUTH_POLICY.md`** — 1~6번 완료·7번 보류 상태를 문서 맨 위에 한 줄로 명시(지금은 CLAUDE.md에만 있음).
- [ ] **`docs/learning/TESTING_GUIDE.md`** — "실제 서비스 코드에 대한 테스트는 아직 없음(2026-08-07)"은 사실과 다름(단위테스트 289개).

## C. 완료 처리 (끝났으니 기록만 남기고 목록에서 뺀다)

- [x] 카테고리 이름 수정 API (#6) — `a6cc584`
- [x] 글이 카테고리를 id로 가리킴 (`Post.categoryId`) + 읽기 전환 + 백필 스크립트 — `cbd0588`·`999aa0a`·`d5f7797`·`ce9525f`
- [x] 카테고리 추가 시 같은 부모 아래 중복 이름 409 — `c206486` (HANDOFF의 "BE가 중복을 막지 않는다"는 낡은 문장 → 수정 필요)
- [x] 글 이미지 업로드·삭제 시 R2 정리 — `99ba0a6`·`69fc95a`
- [x] KURE 임베딩 A6·B2·B3 — HANDOFF에 기록됨
- [x] Neon → Supabase 이전
- [x] DEV_LOG "다음 작업 예정" 1단계 체크박스 대부분 (Sentry만 미완)

## D. 확인이 필요한 것 (사람이 판단)

- [ ] `DEV_LOG.md` 전체를 레포에 둘지, `docs/archive/`로 보낼지, Notion에만 둘지. 최근 항목(2026-09~10)만 남기고 앞부분을 archive하는 절충도 가능.
- [ ] `HANDOFF.md`를 계속 쓸지 — "현재 상태를 덮어쓰는 파일"은 금방 낡는다. 폐기하면 `.cursor/rules/handoff-session.mdc`·CLAUDE.md 상단 "새 세션 시작 시 필수" 문구도 같이 바꿔야 함.
- [ ] `docs/learning/LEARNING.md`(1,764줄)가 Notion 원본과 같은지. 같다면 레포에서는 빼도 됨.
- [ ] `docs/todo/readme-update.md`의 "확인이 필요한 것" 2건(cron-job 유효성, AI 서버 위치).
