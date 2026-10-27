# 할 일 — DB 연결(커넥션 풀) 후속

> 2026-10-27 로컬 BE가 운영 DB에 붙지 못한 일(`EMAXCONNSESSION ... pool_size: 15`)을 분석한 뒤 남긴 것.
> 끝낸 항목은 완료일을 적고 아래 "완료"로 옮긴다.

## 배경 (한 줄 요약)
Supabase 세션 모드 풀러(5432)는 프로젝트 전체가 **슬롯 15개**를 나눠 쓰고, 연결이 `idle`이어도 슬롯을 붙잡는다. 그런데 앱은 풀 크기를 정하지 않아(`connection_limit` 없음) Prisma 기본값(물리 코어 × 2 + 1)을 쓰고, PrismaClient가 2개(`src/auth/auth.ts`, `src/prisma/prisma.service.ts`)라 BE 하나가 최대 코어 6 기준 26개를 요구한다. 운영 BE가 9개를 쥔 상태에서 로컬 BE가 붙으면 6개밖에 못 받아 `EMAXCONNSESSION`으로 거절된다. 로그인이 필요한 API만 실패한 것은 `auth.ts`의 클라이언트가 `$connect()` 없이 첫 쿼리 때 처음 연결을 열기 때문일 가능성이 크다(추정, 미확정).

## 지금 할 것
- [x] **로컬 `.env`에 `connection_limit=2` 적용** (2026-10-27) — 로컬 BE가 운영 DB에서 정상 동작하는 것을 확인했다.
- [ ] **Render 환경변수 `DATABASE_URL` 끝에 `?connection_limit=3` 적용** — PrismaClient가 2개라 BE 하나가 최대 6개 → 운영 6 + 로컬 4 = 10 ≤ 15. 환경변수를 바꾸면 서비스가 재시작된다. 적용 뒤 Supabase SQL Editor에서 `select usename, state, count(*) from pg_stat_activity group by 1, 2`로 운영 BE의 연결 수가 줄었는지 센다(로컬을 껐을 때 9개였음). 값은 풀이 모자라 요청이 줄 서는 일(`P2024`)이 없는지 보고 조정한다.

## 후속 (보관함 배포 이후)
- [ ] **PrismaClient를 1개로 합치기** — `auth.ts`(모듈 로드 시 생성)와 `PrismaService`(Nest DI)가 따로 만든다. `main.ts`가 `auth`를 먼저 import하는 순서와 DI 순서를 함께 정리해야 해서 범위가 크다. 합치면 풀도 1벌이 되어 요구량이 절반. 합친 뒤 `auth` 쪽도 `$connect()`/종료 처리를 같이 한다.
- [ ] **트랜잭션 모드 풀러(6543)로 전환** — `DATABASE_URL`을 6543 + `?pgbouncer=true&connection_limit=N`으로, 마이그레이션용 `DIRECT_URL`(지금의 5432 풀러 주소)을 `schema.prisma`의 `directUrl`로 추가한다. Supabase 직접 연결 주소는 IPv6 전용이라 Render에서 안 붙을 수 있어 5432 풀러를 쓴다. 서버가 3개 이상으로 늘거나 BE를 여러 개 띄울 때 필요하다. **배포 순서**: ① Render에 `DIRECT_URL` 먼저 추가(현재 코드는 무시) → ② `directUrl`이 들어간 코드 배포 → ③ `DATABASE_URL`을 6543으로 변경. (start:prod의 `prisma migrate deploy`가 6543에서는 동작하지 않으므로 ②가 먼저여야 한다)
- [ ] **`start:prod`의 `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` 유지 여부 확인** — Neon 풀러 시절(2026-09-29, `1d7f34e`)에 migrate deploy가 락 타임아웃(P1002)으로 죽던 것을 피하려던 우회책. 지금은 Supabase 5432 풀러라 둬도 해가 없다. `directUrl`을 도입한 뒤 필요 없는지 확인한다(`docs/adr/0001-neon-to-supabase.md`에도 같은 열린 항목이 있다).
- [ ] **개발 환경 분리** — 지금은 운영 DB가 개발 DB를 겸한다(혼자 쓰는 프로젝트라 의도한 선택). 여러 명이 쓰거나 로컬 DB에 쓰기 부담이 생기면 로컬→로컬 DB, 개발 서버→개발 DB, 운영 서버→운영 DB로 나눈다. Supabase 무료 프로젝트 수 한도(BE + AI 서버가 이미 사용)를 먼저 확인한다.
- [ ] **better-auth `session.cookieCache` 검토** — 지금은 인증이 필요한 요청마다 세션을 DB에서 조회한다(`AuthGuard` → `getSession` → `prisma.session.findFirst`). 쿠키 캐시를 켜면 조회 횟수와 연결 사용이 줄지만, 세션 취소 반영이 늦어지는 부작용을 먼저 정한다.
- [ ] **운영 BE가 쥔 연결 수 확인** — 로컬을 껐을 때 9개가 남았다(`pg_stat_activity`). Render의 CPU 코어 수가 로컬과 다르므로 `connection_limit`을 적용한 뒤 다시 센다.

## 완료
(아직 없음)
