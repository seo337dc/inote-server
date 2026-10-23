# DB 이전 — Neon → Supabase

> `inote-server`(Prisma) 기준의 DB 이전 기록·작업 리스트. Notion·블로그 정리용 원본.
> AI 서버(`inote-ai`)에 해당하는 부분은 `inote-ai` 레포의 `docs/supabase-migration.md` 참고.
> 전체 호스팅 정리(AI → Vercel, BE는 Render 유지)는 `inote` 레포의 `docs/infra/hosting-migration.md` 참고.
> 작성: 2026-09-30 / 상태: 🟡 준비 중 (아직 이전 시작 전)

---

## 1. 결정 사항

| 항목 | 결정 |
|---|---|
| 이전 대상 | Neon PostgreSQL 2개 → Supabase |
| 프로젝트 개수 | ~~2개로 분리(`inote-prod`·`inote-dev`)~~ → **2026-10-02 변경: 프로젝트 1개만 사용** (`wgtywtbmpwrtjzvknhwa`, 리전 East US (Ohio)). 로컬과 운영이 다시 같은 DB를 쓰게 되므로 통합 테스트용 DB가 필요해지면 두 번째 프로젝트를 만든다(무료 2개 한도) |
| AI DB | **BE DB에 합친다** (별도 프로젝트를 만들지 않음) |
| 리전 | **East US (Ohio, us-east-2)** — Render BE가 Ohio, Vercel(FE·AI) 서버 코드가 `iad1`(워싱턴)이라 모두 미국 동부 |
| 진행 시점 | BE가 Render 정지로 내려가 있어 사용자 영향 없음 → 지금 전환하기에 좋은 시점 |

### 왜 2개로 나누나
- 지금은 로컬 개발과 운영이 **같은 Neon DB**를 써서, 통합 테스트를 돌리면 운영 데이터를 건드릴 수 있었다.
- dev 프로젝트가 생기면 이 위험이 사라지고, 통합 테스트용 DB도 함께 해결된다.

### 왜 AI DB를 합치나
- 현재 DB 2개: BE용 약 9.4MB(테이블 22개), AI용 약 7.8MB(테이블 2개, 행 21개) → 합쳐도 약 17MB.
- 관리할 DB·비밀번호·환경 변수가 1세트로 줄어든다.

## 2. 현재 상태 (2026-09-30 측정)

| DB | 호스트(Neon) | 크기 | 테이블 | 확장 |
|---|---|---|---|---|
| BE (`inote-server`) | `ep-fancy-bar-...us-east-1` | 9.4MB | 22개 | 기본(plpgsql)만 |
| AI (`inote-ai`) | `ep-wispy-moon-...us-east-2` | 7.8MB | 2개 (`conversation_sessions`, `conversations`) | 기본만 |

- 특수 확장(pgvector 등)을 쓰지 않아 호환 문제가 적다.
- Prisma 마이그레이션 폴더에는 3개(init, better_auth, money_models)만 있고, 이후 모델(PostCategory, Todo, ReadingLog, Post.isPrivate/pinned/thumbnailUrl 등)은 `db push`로 반영해 왔다. → **`migrate deploy`만으로는 새 DB에 최신 스키마가 만들어지지 않는다** (아래 4-2 참고).

## 3. Supabase 연결 방식 정리

| 사용처 | 배포 형태 | 연결 주소 | 비고 |
|---|---|---|---|
| BE (Render, Prisma) | 상시 서버 | **Session pooler**, 포트 5432 | 서버 배포는 세션 풀러가 공식 권장 |
| BE 마이그레이션(CLI) | 로컬/배포 시 | Session pooler 5432 (또는 직접 연결) | |
| AI (Vercel, psycopg) | 서버리스 | **Transaction pooler**, 포트 6543 | `prepare_threshold=None` 이미 적용됨 |

- 주소 형식(공식 문서): `postgres://[사용자].[프로젝트REF]:[비밀번호]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
  (트랜잭션 모드는 포트 6543 + Prisma 사용 시 `?pgbouncer=true`).
- Supabase 직접 연결(`db.xxx.supabase.co`)은 IPv6 전용이라 Render·Vercel에서 못 붙을 수 있다 → **풀러 주소를 쓴다**.
- 세션 풀러는 동시 연결 수가 제한적이므로 Prisma `connection_limit`을 작게(예: 5) 둔다.
- Prisma 전용 DB 사용자(`prisma`)를 만들어 쓰는 것이 공식 권장: `create user "prisma" with password '...' bypassrls createdb;` + `public` 스키마 권한 부여.
- (확인 필요) 이 레포는 Prisma **6.19**이고 `prisma.config.ts`에 `datasource.url`이 있다. CLI가 어느 주소를 쓰는지, `schema.prisma`의 `directUrl`이 필요한지는 실제로 돌려 보며 확인.

## 4. 작업 리스트

### 4-1. 준비
- [ ] Supabase 가입, **프로젝트 2개 생성** (`inote-prod`, `inote-dev`), 리전 us-east-1, 강한 DB 비밀번호 (비밀번호는 문서·채팅에 붙이지 않는다)
- [ ] 두 프로젝트에서 Prisma용 DB 사용자(`prisma`) 생성·권한 부여
- [ ] 연결 주소 확보(값은 적지 않음): prod·dev 각각 Session pooler 5432(BE), Transaction pooler 6543(AI)
- [ ] 로컬에 `pg_dump`/`psql` 설치 (현재 없음 — 예: `brew install libpq`). **버전은 Neon 서버 버전 이상**이어야 덤프 가능
- [ ] Neon 서버 버전 확인 (`show server_version`)
- [x] **Neon 전체 백업 완료 (2026-10-02)** — 이 PC의 `~/inote-backups/2026-10-02/`(저장소 밖, 폴더 700·파일 600, 커밋 금지). 방식: `pg_dump` 없이 Python(psycopg)으로 읽기 전용 연결 후 테이블별 `COPY ... TO STDOUT` 텍스트 파일 + `manifest.json`(행 수). BE DB 22개 테이블·198행, AI DB 2개 테이블·21행(세션 5·대화 16). 복원은 새 DB에 스키마를 만든 뒤 `COPY ... FROM STDIN`으로 같은 파일을 넣고 `manifest.json`의 행 수와 대조
- [ ] Neon 데이터 행 수 기록 (이전 후 대조용): 테이블별 `count(*)`

### 4-2. 스키마 (BE)
- [ ] **마이그레이션 기준선 정리**: 기존 3개 마이그레이션은 최신 스키마를 못 만든다. 현재 `schema.prisma`로부터 새 기준선(baseline) 마이그레이션을 생성해 기존 것을 대체하고, 기존 DB에는 "적용됨"으로 표시하는 방식을 정한다 (`prisma migrate diff --from-empty --to-schema-datamodel ... --script`). → 별도 결정 필요
- [ ] `inote-dev`에서 먼저 스키마 생성·`migrate deploy` 검증
- [ ] `inote-prod`에 같은 방식으로 스키마 생성
- [ ] `start:prod`의 `prisma migrate deploy`와 `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` 유지 여부 확인 (풀러 환경에서 lock 타임아웃이 재현되는지)

### 4-3. 데이터 이전
- [ ] BE 데이터: Neon(`ep-fancy-bar`) → `inote-prod` (`pg_dump --data-only --no-owner --no-acl` → 복원, 또는 테이블 순서(FK)를 지켜 복원)
- [ ] 시퀀스·제약 조건 확인 (id는 cuid 문자열이라 시퀀스 문제는 적음)
- [ ] 행 수 대조: 이전 전·후 테이블별 `count(*)` 비교
- [ ] 세션(Better Auth `session` 테이블) 처리 방침: 그대로 옮기면 로그인 유지, 안 옮기면 모두 재로그인 (둘 다 문제 없음 — 결정만)
- [ ] dev 프로젝트에는 **운영 데이터를 복사하지 않거나**, 복사한다면 개인 정보(이메일 등)를 비우는 정책을 정한다

### 4-4. AI 테이블 합치기 (상세는 inote-ai 문서)
- [ ] prod DB에 **별도 스키마 `ai`**를 만들고 그 안에 AI 테이블 2개를 생성
- [ ] Neon AI DB(`ep-wispy-moon`)의 데이터(세션 5, 대화 16)를 이전
- 이유: Prisma `db push`는 스키마에 없는 테이블을 지우려 할 수 있다. AI 테이블을 `public`에 두면 BE에서 `db push`를 돌릴 때 위험 → 별도 스키마로 격리

### 4-5. 보안 (Supabase 특성)
- [ ] `public` 테이블이 REST(Data API)로 자동 노출되는지 확인, **RLS 활성화 또는 Data API 노출 끄기**
- [ ] `ai` 스키마는 API 노출 대상에서 제외 확인
- [ ] anon/service 키는 사용하지 않으므로 어디에도 노출되지 않게 함 (프로젝트는 DB 직접 연결만 사용)
- [ ] 비밀번호 재설정: Neon 비밀번호는 채팅에 노출된 적이 있으니 Neon은 전환 후 삭제(또는 비밀번호 폐기)

### 4-6. 환경 변수 교체 (값은 적지 않는다)
| 서비스 | 변수 | 교체 내용 |
|---|---|---|
| BE (Render) | `DATABASE_URL` | `inote-prod` Session pooler 주소 (5432) |
| AI (Vercel) | `DATABASE_URL` | `inote-prod` Transaction pooler 주소 (6543) |
| 로컬 BE | `inote-server/.env`의 `DATABASE_URL` | `inote-dev` 주소 |
| 로컬 AI | `inote-ai/.env`의 `DATABASE_URL` | `inote-dev` 주소 (`ai` 스키마) |

- [ ] 위 값 교체 후 BE·AI 재배포
- [ ] 로컬과 운영이 **서로 다른 DB**를 쓰는지 최종 확인

### 4-7. 검증
- [ ] BE 헬스체크(`/api/v1/health`), 로그인(Google OAuth), 글 작성·저장·목록·상세, 카테고리, 이미지 업로드
- [ ] AI `/health/db` = ok(테이블 존재 확인 포함), 요약·채팅 저장·세션 조회
- [ ] 글에 연결된 채팅(BE 작성자 확인) 동작
- [ ] BE 단위 테스트, FE 테스트 전체 통과
- [ ] 행 수 대조 결과 일치
- [ ] Supabase 대시보드에서 연결 수·에러 로그 확인

### 4-8. 전환(컷오버)과 롤백
1. 쓰기 중단 안내(개인 앱이라 본인만 안 쓰면 됨) — 현재는 BE 정지 상태라 자동으로 충족
2. Neon 최종 덤프 → `inote-prod` 복원 → 행 수 대조
3. 환경 변수를 Supabase 주소로 교체 → 재배포 → 검증(4-7)
4. **롤백**: 문제가 생기면 환경 변수를 Neon 주소로 되돌린다(전환 후 새로 쌓인 데이터는 별도 이전 필요). 안정화될 때까지 **Neon은 삭제하지 않고 유지**
5. 1~2주 안정 운영 후 Neon 정리

### 4-9. 마무리
- [ ] `inote-server`/`inote-ai` README·CLAUDE.md의 DB 정보(Neon → Supabase) 최신화, `DATABASE.md`·`docs/` 갱신
- [ ] Supabase 무료 플랜 **일시정지 정책**(1주 무활동 시 정지) 대응 방안 결정 — 정기 호출 또는 주기적 접속
- [ ] 통합 테스트를 `inote-dev`에서 돌릴 수 있게 설정 (`inote` CLAUDE.md의 "테스트 전용 DB" 항목 충족)
- [ ] Notion·블로그 정리 (이 문서 기준)

## 5. 위험 요소와 대응

| 위험 | 대응 |
|---|---|
| Supabase 무료 프로젝트가 1주 무활동 시 **일시정지** | 정기 호출(예: BE 헬스체크가 DB를 조회), 정지되면 수동 재개 |
| 세션 풀러 연결 수 제한으로 "max clients" 에러 | Prisma `connection_limit` 축소, 풀러 크기 확인 |
| 새 DB에서 `migrate deploy`가 최신 스키마를 못 만듦(마이그레이션 기록이 `db push`와 어긋남) | 기준선 마이그레이션 재생성 (4-2) |
| `prisma db push`가 `public`의 미등록 테이블을 지우려 함 | AI 테이블을 `ai` 스키마로 격리 (4-4) |
| 테이블이 REST API로 공개 노출 | RLS 활성화 또는 Data API 노출 끄기 (4-5) |
| 덤프/복원 도구 버전 불일치 | `pg_dump` 버전을 Neon 서버 버전 이상으로 설치 (4-1) |
| 이전 후 문제 발견 | Neon을 유지해 두고 환경 변수로 즉시 롤백 (4-8) |

## 6. 예상 소요 (데이터 약 17MB)

| 단계 | 시간 |
|---|---|
| 프로젝트 생성·권한 설정 | 약 30분 |
| 스키마 기준선 정리·검증 | 1시간 전후 |
| 데이터 이전·대조 | 30분 이내 |
| AI 스키마 분리·코드 수정·검증 | 1시간 전후 |
| 환경 변수 교체·재배포·전체 검증 | 1시간 전후 |
| 합계 | **약 반나절(3~5시간)** |

## 7. 진행 로그

| 날짜 | 한 일 | 결과·메모 |
|---|---|---|
| 2026-09-30 | 데이터 규모 측정, 결정(프로젝트 2개·AI DB 합치기), 이 문서 작성 | 준비 완료, 이전 시작 전 |
| 2026-10-02 | Render BE가 시작 단계 `prisma migrate deploy`에서 `P1001: Can't reach database server`로 반복 재시작 — Neon 컴퓨트가 깨어나는 데 5~6초 걸려 Prisma 기본 연결 대기(약 5초)를 넘김 | 연결 주소에 `connect_timeout=30` 추가 권장. Neon 한도·콜드 스타트가 이전의 직접 이유 |
| 2026-10-02 | Neon 데이터 백업 완료(COPY 파일, 행 수 목록) | 이전 시작 준비 완료 |
| 2026-10-02 | Supabase 프로젝트 1개 생성(Ohio), 접속 확인(Session pooler 5432, PostgreSQL 17.11). 연결 주소는 로컬 전용 `inote-server/.env.supabase.local`(gitignore) | 따옴표·`pgbouncer=true`·6543 포트를 정리해야 접속됨, 비밀번호 불일치는 재설정으로 해결 |
| 2026-10-02 | **스키마 기준선 적용**: 기존 마이그레이션 3개를 `20261002000000_baseline` 하나로 교체(로컬 작업 트리, **아직 커밋·푸시 안 함**) → `migrate deploy`로 Supabase에 적용 → `migrate diff`로 Prisma 스키마·Neon과 비교해 **차이 없음** 확인 | 테이블 21개 + `_prisma_migrations` |
| 2026-10-02 | 모든 `public` 테이블(22개)에 행 수준 보안(RLS) 활성화 | Prisma 접속 사용자는 RLS를 우회하므로 앱 동작에는 영향 없음, API로의 공개 접근은 차단 |
| 2026-09-30 | Neon BE DB 비밀번호 재설정(채팅 노출 대응), 로컬 `.env` 교체·BE 재시작·접속 확인 | 정상. Neon BE 프로젝트에 무료 한도 일시정지 경고 확인 → 백업을 최우선 항목으로 표시, 실행은 보류 |

## 8. 트러블슈팅 (겪으면 채우기)

- **Supabase 연결 주소 정리**: Connect 화면의 주소를 그대로 쓰면 접속이 안 된다. ① 문서·메모의 생략 표시 `…`가 들어간 호스트를 복사하지 말 것(실제 호스트는 `aws-0-us-east-2.pooler.supabase.com`) ② 큰따옴표 제거 ③ BE(상시 서버)는 **Session pooler 5432** — Transaction pooler(6543)용 `?pgbouncer=true`는 psycopg 등 일부 도구에서 오류(`invalid URI query parameter`)이므로 세션 풀러에선 뺀다 ④ 비밀번호는 특수문자 없는 영문+숫자 24자로(연결 주소에 퍼센트 인코딩 문제 회피). 비밀번호 불일치(`password authentication failed`)는 대시보드에서 재설정으로 해결.
- **Supabase 비밀번호 강도 거부**: "Password not secure enough" — 직접 만든 값이 짧거나 단순하면 거부됨. 터미널에서 `openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 24 | pbcopy`로 만든 값은 통과.
- **기준선 마이그레이션은 Render가 Supabase를 가리키기 전에 `main`에 올리지 않는다**: Render가 시작 때 `prisma migrate deploy`를 실행하는데, 아직 Neon(옛 마이그레이션 3개 기록)을 쓰는 상태에서 baseline이 올라가면 "이미 테이블이 있다"며 시작에 실패한다.
- **오류 메시지에 연결 주소가 그대로 찍힌다**: psycopg 연결 오류 메시지에 `postgresql://user:비밀번호@...`가 포함되어 한 번 노출됐다. 진단 스크립트는 예외 메시지를 정규식으로 가려서(`<연결주소 생략>`) 출력한다.

-

## 9. 참고 자료

- Supabase × Prisma 연결 가이드: https://supabase.com/docs/guides/database/prisma
- Supabase 요금·무료 한도: https://supabase.com/pricing
- 무료 플랜 제한 정리: https://www.itpathsolutions.com/supabase-free-tier-limits
