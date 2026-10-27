# 개발 기록 로그 — iNote Server

> 다른 PC에서 작업을 이어받을 때 이 파일을 먼저 읽고 맥락을 파악합니다.
> 작업할 때마다 아래 로그에 날짜 + 내용을 추가합니다.

---

## 빠른 현황 파악

| 항목 | 상태 |
|------|------|
| 레포 위치 | https://github.com/seo337dc/inote-server |
| 실행 포트 (로컬) | `http://localhost:3200` |
| Swagger 문서 (로컬) | `http://localhost:3200/api/docs` |
| 서버 URL (dev) | `https://inote-server-5a63.onrender.com` |
| Swagger 문서 (dev) | `https://inote-server-5a63.onrender.com/api/docs` |
| 헬스체크 | `https://inote-server-5a63.onrender.com/api/v1/health` |
| 현재 진행 단계 | 금융지식(Term/Book) BE API + 단위테스트 완료 — E2E는 ESM 인프라 이슈로 보류, FE는 사람 목업 대기. 블로그(inote) — draft/발행 모델, 자동저장, AI 자동 요약(PostSummary), 대화 기록 접근 제어용 내부 API까지 완료 (2026-09-11) |

---

## 로컬 실행 방법

```bash
cd inote-server
npm install
npm run start:dev
```

---

## 작업 로그

### 2026-10-27 — 글 보관함(아카이브) BE

설계·계약은 `inote` 레포 `docs/adr/0007-archive-posts.md`, 남긴 것은 `inote` 레포 `docs/todo/archive-posts.md`. 여기는 BE에서 한 일과 이유.

- **`Post.archivedAt DateTime?`** (마이그레이션 `20261027000000_add_post_archived_at`): `null` = 일반 글, 값 = 보관한 시각. 보관 여부와 보관함 정렬을 한 컬럼이 맡아 `isArchived` 같은 중복 컬럼이 없다. 추가만 하는 마이그레이션이라 기존 글·기존 코드에 영향이 없다. `prisma migrate dev`는 운영 DB에 바로 적용돼서 쓰지 않고 SQL을 직접 만들었고, 배포 전 통합 테스트를 위해 로컬에서 `migrate deploy`로 먼저 적용했다(서버 시작 때 `migrate deploy`가 다시 돌지만 적용된 것은 건너뛴다).
- **`POST /blog/posts/archive`·`/unarchive`**: `{ ids }` 1~100개, 응답 `{ archivedIds }`·`{ unarchivedIds }`(200). **내 글이 아니거나 없거나 발행 전인 id는 오류 없이 건너뛴다** — 응답으로 남의 글 존재 여부를 알 수 없게. 이미 보관한 글은 시각을 바꾸지 않고(멱등) 응답에는 포함한다. 보관하면 `pinned`가 풀린다(해제해도 복원하지 않음).
- **보관한 글을 빼는 곳**(빠뜨리면 계속 노출된다): 홈·작성자별 목록(`findAll`), 작성자별 카테고리 개수, 나의 글(`findMine`)과 그 카테고리 개수, 내 글 트리(`findOutline`), 작성자 공개 글 트리, 글 이동 탭(`findMyOutline`), 공개 글 id 목록(`listPublicPostIds`). 서비스의 `NOT_ARCHIVED` 상수로 모아 두었다.
- **보관함**: `GET /blog/posts/mine?archived=true` — 보관한 글만 `archivedAt` 최신순(`ARCHIVE_ORDER`), `categoryCounts`도 보관한 글 기준. 공개 목록(`/blog/posts`)은 `archived`를 받아도 무시한다.
- **직접 주소**: `findOne`은 작성자만 200, 타인·비로그인은 404(비공개 글과 같은 방식).
- **계약에 없던데 보탠 것**: ① 비슷한 글(`findSimilar`)의 원본 글이 보관한 글이면 작성자 외 404(안 막으면 존재가 드러남) ② 보관한 글을 수정 저장할 때 `pinned: true`는 무시(보관 시 풀린 고정이 수정으로 다시 켜지지 않게) ③ 응답 코드 200(`@HttpCode(200)`).
- **하지 않은 것**: 임베딩 후보(`embedding-candidates.ts`)에서 보관한 글 제외 — 임베딩이 운영에서 꺼져 있어 보류(켜기 전에 반드시, `inote` 레포 `docs/todo/archive-posts.md`).
- **테스트**: `blog.service.archive.spec.ts`·`archive-posts.dto.spec.ts` 신규, 기존 테스트 7개는 `where`에 `archivedAt: null`이 들어간 것에 맞춰 기대값만 수정. 서비스 코드를 일부러 망가뜨려(보관 조건 제거·보관 여부 무시·고정 유지·userId 조건 제거) 테스트가 실패하는지 확인했다. 전체 327개 통과, `tsc`(빌드 설정)·ESLint 통과.
- **로컬 통합**: 로컬 FE·BE(운영 DB)에서 보관 → 목록에서 제외 → 보관함 → 직접 주소(작성자만) → 해제까지 사용자가 확인했다.
- **배포 순서**: BE 먼저(마이그레이션은 서버 시작 때 적용) → FE.

---

### 2026-10-27 — 로컬 BE가 운영 DB에 붙지 못함: Supabase 세션 풀러 한도 초과

- **증상**: 로컬 BE → 운영 DB에서 공개 API와 DB 조회는 되는데, 로그인 후 `나의 글`(`mine`)·`categories`만 500. BE 로그는 `EMAXCONNSESSION ... max clients are limited to pool_size: 15`, 응답은 500 "Failed to get session". 운영 BE는 같은 DB에서 정상이었다.
- **원인**: 연결은 세 층을 지난다 — Prisma 풀(클라이언트 쪽 한도) → Supabase 풀러(프로젝트 전체가 나눠 쓰는 슬롯 15, 세션 모드 5432) → Postgres. 세션 모드는 연결 하나가 `idle`이어도 슬롯을 계속 쥔다. 그런데 앱은 `connection_limit`을 정하지 않아 Prisma 기본값(물리 코어 × 2 + 1 = 13)을 쓰고, **PrismaClient가 둘**(`auth.ts` 하나, `PrismaService` 하나)이라 BE 하나가 최대 26개를 요구한다. 운영 BE가 9개를 쥔 상태에서 로컬 BE가 붙으면 6개밖에 못 받는다. 로그인이 필요한 API만 실패한 것은 `auth.ts`의 클라이언트가 `$connect()` 없이 첫 쿼리 때 처음 연결을 열기 때문으로 **추정**한다(미확정).
- **왜 전에는 괜찮았나**: 이전의 로컬 테스트는 `scripts/dev-db.sh`로 로컬 Docker DB에 붙어서 Supabase 슬롯을 쓰지 않았다. 이번에 처음 로컬 BE가 Supabase에 붙으면서 숨어 있던 한계(서버가 둘 이상 붙는 순간 한도를 넘는 구조)가 드러났다.
- **조치**: `DATABASE_URL` 끝에 `?connection_limit=2`(로컬)를 붙여 BE 하나의 요구량을 4개로 줄였다. 코드 변경 없이 환경변수만 — 로컬 `.env` 적용·확인함. **Render 환경변수에도 `?connection_limit=3`을 적용해야 한다**(운영 BE의 9개를 6개로 줄여 로컬과 합쳐 15 안에 들게).
- **후속(`docs/todo/db-connection.md`)**: PrismaClient 1개로 합치기, 트랜잭션 모드(6543 + `directUrl`) 전환, `start:prod`의 `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` 유지 여부, 개발 환경 분리, `session.cookieCache` 검토.
- **알게 된 것**: `start:prod`의 서버 시작 때 `migrate deploy`는 Railway 배포 설정에서, `ADVISORY_LOCK` 끄기는 Neon 풀러 시절에 생긴 것(둘 다 지금도 쓰임). Supabase 직접 연결 주소(`db.<ref>.supabase.co`)는 IPv6 전용이라 IPv6가 안 되는 네트워크에서는 DataGrip 등이 붙지 못하고, 풀러 주소(IPv4)로 붙어야 한다.

---

### 2026-10-27 — 구글 로그인 실패: 중복 account 행 + better-auth 버전 고정

- **증상**: 로컬 FE에서 구글 계정 선택 직후 "문제가 발생했습니다…" 토스트(FE가 모르는 에러 코드). 이메일/비밀번호 로그인은 정상.
- **원인(서버 로그)**: `Better auth was unable to query your database.` 바로 뒤의 `Multiple accounts match the same accountId for provider "google"`. `account`에 같은 사용자·같은 `accountId`의 구글 행이 2개(`issuer`가 `local:oauth:google` / `https://accounts.google.com`)였다. 이메일 로그인은 이 조회를 하지 않아 영향이 없었다.
- **왜 생겼나**: better-auth **1.7.2**는 `issuer`+`accountId`로 계정을 찾아서(옛 `issuer`와 달라 못 찾고 새 행을 추가) 중복이 조용히 쌓였고, **1.7.3 이상**은 `providerId`+`accountId`로 찾으며 2개 이상이면 에러를 낸다. 1.7.2/1.7.14 소스를 내려받아 비교해 확인. **Render의 실제 빌드 명령은 `render.yaml`이 아니라 대시보드에 직접 설정된 `npm install --include=dev && npx prisma generate && npm run build`**였다(Render 빌드 로그로 확인). npm은 `pnpm-lock.yaml`을 읽지 않아서 `package.json`의 범위(`^1.6.16`)대로 **배포 때마다 그 시점의 최신 버전**이 설치됐고(모든 의존성이 해당), 그래서 로컬 lock(1.7.2)과 달리 1.7.3 이상이 깔려 중복이 처음 드러났다. (로컬 재현: lockfile 있으면 1.7.2, 없으면 1.7.13)
- **데이터 조치(운영 DB, 사용자가 직접 실행)**: 중복 중 옛 `issuer`(`local:oauth:google`) 행만 삭제 — 조회로 대상 1행 확인 후 같은 조건으로 DELETE. 같은 사용자 소유라 사용자·글에는 영향 없음. 중복은 이 계정 하나뿐이었다. 이후 로그인 정상.
- **코드 조치**: `better-auth`를 `^1.6.16` → 정확한 `1.7.12`로 고정(lockfile 갱신) — `package.json` 자체의 값이라 npm 빌드에서도 효과가 있다. `render.yaml`에는 `--frozen-lockfile`을 넣었지만 **Render가 이 파일을 쓰지 않아(대시보드 명령 사용) 적용되지 않는다.** 또 `scripts/print-deps.js` + `prebuild`를 추가해 빌드 로그에 설치된 의존성 버전(`[deps] better-auth 1.7.12 -> …`)이 찍히게 했다(`npm run build` 앞에서 자동 실행, Render 설정 변경 불필요). 최신 1.7.14는 pnpm의 `minimumReleaseAge`(릴리스 후 1일 미만)에 걸려 `minimumReleaseAgeExclude` 우회가 필요해서, 우회하지 않고 며칠 지난 1.7.12로 정했다(10월 21일 배포 시점의 최신이라 배포본과 같을 가능성이 높음 — Render 빌드 로그로 확인 필요).
- 테스트: 단위 289개 통과, `pnpm run build` 통과. E2E·실제 구글 로그인은 이 변경에서 돌리지 않음.
- 글 초안: `inote` 레포 `docs/blog/better-auth-duplicate-account.md`

---

### 2026-10-21 — 글 에디터 이미지 업로드: tmp 업로드 + 저장 시 영구 위치로 승격

설계·계약은 `inote` 레포 `docs/EDITOR_IMAGE_UPLOAD.md`, 남긴 것은 `inote` 레포 `docs/todo/editor-image-upload.md`. 여기는 BE에서 한 일과 이유.

- **`POST /uploads/post-image`**: 로그인 필요, 5MB·jpeg/png/webp/gif(기존 `uploads/image`와 같은 파이프를 `imageFilePipe()`로 공유). 키는 `tmp/post/<userId>/<uuid>.<ext>`이고, 확장자는 **파일명이 아니라 검증된 MIME**에서 정한다(`evil.php`라도 PNG면 `.png`).
- **저장 때만 승격**(`BlogService.update`, `publish: true`): 본문의 내 tmp 이미지를 `post/<userId>/<postId>/<uuid>.<ext>`로 복사하고 본문 `src`를 바꿔 저장한 뒤 tmp 원본을 지운다. 자동 임시저장(publish 없음)은 tmp 주소 그대로 둔다. `publish: true`인데 `content`가 없으면 DB의 기존 본문 기준.
- **`R2Service.copy/delete`**: S3 API에는 "이동"이 없어 복사 + 삭제. 키는 서버가 만든 값만 들어와 `CopySource`를 따로 인코딩하지 않는다.
- **`post-images.ts`(순수 함수)**: `planPromotions`(승격 계획)·`applyPromotions`(본문 주소 교체). `<img>` 파싱은 정규식 — Tiptap 출력이 결정적이고, 대상은 `<공개URL>/tmp/post/<내 userId>/<uuid>.<허용확장자>`에 **정확히 맞는 것만**이라 `../` 조작·남의 폴더·외부 URL·`<a href>` 속 주소는 애초에 매칭되지 않는다(별도 HTML 파서는 얻는 게 없어 쓰지 않음).
- **복사 실패는 저장을 막지 않는다(fail-open)**: 그 이미지는 tmp 주소 그대로 저장하고 warn 로그만 남긴다(다음 저장 때 다시 시도). 이미지 문제로 글 저장이 실패하는 쪽이 더 나쁘다는 판단 — 요약·임베딩 호출과 같은 패턴.
- **tmp 원본 삭제는 DB 저장이 성공한 뒤에**: 저장이 실패했는데 먼저 지우면 임시저장본의 이미지가 깨진다. 삭제가 실패해도 저장은 성공(warn만).
- **알려진 한계**: 에디터에서 지운 이미지·저장 안 하고 나간 업로드는 `tmp/`에 남는다(정리 배치는 후속).

##### 같은 날 추가 — 로컬 통합 테스트에서 나온 문제 2건
- **글을 삭제해도 R2 이미지가 남았다**(임시저장 글·저장된 글 모두): `remove()`가 R2를 건드리지 않았다. DB 삭제 뒤에 (1) `post/<userId>/<postId>/` 폴더째(`R2Service.deletePrefix`, 목록 조회 → 1000개씩 `DeleteObjects`, 비었거나 `/`로 안 끝나는 접두어는 거절해 버킷 통째 삭제 방지) (2) 본문의 **내 tmp** 이미지 개별 삭제(승격과 같은 `planPromotions` 규칙)를 하고, 실패해도 글 삭제는 막지 않는다. 본문에서 지웠거나 저장 없이 나간 업로드는 못 지운다(정리 배치). 관리자 사용자 삭제·회원 탈퇴 때의 이미지 정리는 후속.
- **로컬 테스트가 운영 버킷에 섞였다**: `R2_KEY_PREFIX`를 추가 — 있으면 `R2Service`가 모든 키(업로드·복사·삭제·목록) 앞에 붙이고 `publicBaseUrl()`도 `<공개URL>/dev`가 된다. 호출하는 쪽은 접두어를 모르는 키만 다룬다. `.env`가 아니라 `scripts/dev-db.sh start`가 주입(DB 주소 덮어쓰기와 같은 방식)해서 로컬 BE에서는 빠질 수 없고, 운영(Render)은 설정하지 않으면 기존과 같다.
- 확인: 재현 A(임시저장→저장)는 정상 — `src`가 `post/<userId>/<postId>/`로 바뀌고 tmp 원본이 삭제됨, 경고 없음. 처음 "tmp에 남았다"고 본 것은 본문에 없던 파일(고아)이었다.

#### 테스트
- `post-images.spec`(15), `blog.service.post-images.spec`(10), `uploads.controller.spec`(5) 추가. 기존 `blog.service.spec`에는 `R2Service` mock provider 한 줄과 발행 시각 테스트 2개의 mock 글에 `content: ''`만 추가(실제 글은 항상 `content`가 있다).
- 컨트롤러 테스트는 `AuthGuard`가 `better-auth`(순수 ESM)를 import해 ts-jest에서 못 불러오므로 `jest.mock('../auth/auth.guard')`로 대체.
- 단위테스트 29 스위트 / 271개 통과, `pnpm run build` 통과. E2E는 로컬·운영이 같은 DB를 쓰는 구조라 돌리지 않음.

#### 로컬 통합 테스트 환경 메모
- `.env`의 `DATABASE_URL`은 운영(Supabase)이라 BE는 반드시 `scripts/dev-db.sh start`(로컬 Docker DB 5435)로 띄운다. R2는 개발용 버킷이 따로 없어 로컬 테스트도 운영 버킷(`inote-storage`)에 쓴다 — 새 경로(`tmp/post/`, `post/`)라 기존 파일은 덮어쓰지 않으며 테스트 객체는 끝나고 지운다.
- FE는 `inote/apps/web/.env.local`이 운영 BE를 가리켜서, 실행 시 `NEXT_PUBLIC_API_URL=http://localhost:3200 pnpm dev`로 덮어쓴다(파일은 그대로).
- `scripts/dev-db.sh seed`가 `Unknown argument id`로 실패한다 — 스키마 변경을 시드가 따라가지 못한 것으로 보이며 미조치.

---

### 2026-10-12 — KURE 임베딩: 글 벡터 동기화·후보 id·비슷한 글 API (A6·B2·B3)

설계·결정은 `inote` 레포 `docs/kure/PLAN.md`, 진행·실행법은 `docs/kure/HANDOFF.md`. 여기는 BE에서 한 일과 이유.

- **공개 여부는 BE가 판정한다(후보 id)**: 벡터는 AI DB에 있고 공개 여부·작성자는 복사해 두지 않는다(어긋나면 비공개 글이 샌다). 그래서 `embedding-candidates.ts`가 "이 요청자가 볼 수 있는 글 id"(발행됨 AND (공개 OR 내 글), 자기 제외)를 정해 넘기고, AI는 그 안에서만 순위를 매긴다. 조건을 만들 때 Prisma의 `userId: undefined`("조건 없음")와 `userId: null`(작성자 탈퇴 글)로 비로그인이 새지 않게 따로 처리한다 — 개발 DB에 작성자 없는 비공개 글을 임시로 넣어 가드를 빼면 실패하는 것까지 확인.
- **글 저장·삭제는 절대 막히지 않는다(fail-open)**: `inote-ai-embeddings.ts`는 일반 함수 모듈(`users/inote-ai-client.ts`와 같은 패턴 — 서비스 생성자·테스트 모듈을 안 바꿈). `EMBEDDINGS_ENABLED=true`일 때만 동작(기본 꺼짐 → 배포 순서가 안전), 저장 응답은 임베딩(약 5초)을 기다리지 않고 요약과 동시에 시작만 한다. **같은 글의 호출은 글 id별 큐로 순서대로** 처리해, 저장을 연달아 눌러도 오래된 벡터가 남지 않는다(연속 3번 저장 → 마지막 내용의 해시가 남는 것을 확인).
- **훅 범위**: `update`는 `publish: true`일 때만(임시저장·핀·비공개 전환은 벡터에 영향 없음), 제목·본문이 모두 빈 글만 제외하고 그때는 이전 벡터 삭제. `remove`와 관리자 사용자 삭제(글 id를 먼저 모으고 트랜잭션 성공 뒤 하나씩)도 처리. 본인 탈퇴(`deleteMe`)는 글을 지우지 않으므로 손대지 않음.
- **백필**: `scripts/backfill-embeddings.ts`(`scripts/dev-db.sh backfill`). 발행된 글을 하나씩, 다시 실행해도 안전(내용 같으면 inote-ai가 건너뜀), 연속 5번 실패하면 멈춤. **BE DB와 AI 서버의 짝이 어긋나면 항상 거절**(이 PC의 `.env`는 운영 DB라 그냥 돌리면 "운영 글→로컬 AI"가 되기 쉽다).
- **비슷한 글 `GET /blog/posts/:id/similar`(B3)**: 접근 확인(상세와 같은 규칙, 볼 수 없으면 404) → 후보 id → `findSimilarPosts`(3초 제한, 던지지 않음, **AI 응답을 후보·기준·중복으로 BE에서 다시 거름**) → 글 정보를 읽을 때 **읽기 규칙을 다시 걸어** 한 번 더 거름. 응답은 `Cache-Control: private, no-store`(요청자마다 다름), `Vary`는 `res.vary`로 덧붙여 CORS의 `Origin`을 지우지 않는다. 이메일·본문은 내려주지 않는다.
- **확인한 것**: 개발 DB(발행 글 26개 = 벡터 26개)·로컬 AI·로컬 임베더로 HTTP 확인 — 저장·재저장·삭제·관리자 삭제, AI/임베딩 서비스 장애·스위치 꺼짐, 비공개 글이 비로그인·타 사용자에게 안 나옴(기준 0.5에서 작성자 a에게만 자기 비공개 글이 나옴). 임시 기준 0.6에서는 그 비공개 글(0.551)이 빠지므로 A7 평가에서 기준을 정할 때 같이 본다.
- **테스트는 `it.todo` 목록**(사용자가 작성). 구현을 일부러 망가뜨려 보는 변이 검사로 목록에 필요한 항목을 걸러 두었다.

### 2026-09-14 — 회원 탈퇴 API 추가

`DELETE /api/v1/users/me` 신규 (`UsersController`/`UsersService`). `prisma.user.delete()`
호출 전에 `inote-ai`에 그 유저의 대화 세션/기록 삭제를 먼저 요청(내부 시크릿 헤더) —
실패해도 탈퇴 자체는 막지 않도록 try/catch로 격리(다른 서비스 장애로 탈퇴가 막히면
안 됨, 기존 요약 호출 실패 처리와 동일한 패턴).

스키마상 `session`/`account`/`UserSetting` 등은 전부 `onDelete: Cascade`라 유저 삭제 시
같이 정리되고, `Post.userId`만 `SetNull`이라 작성한 글은 삭제되지 않고 작성자 없음으로
남음(기존에 이미 그렇게 설계돼 있던 부분, 이번에 실제로 검증). 실제 계정으로 글 작성 →
inote-ai 대화 세션 생성 → 탈퇴 → BE(user/session/account 삭제, Post는 userId null로 유지)
+ AI(세션 삭제) 양쪽 다 curl/DB 직접 조회로 확인.

### 2026-09-11 — 블로그(inote) draft/발행 모델 + AI 자동 요약 + 대화 기록 접근 제어

`inote`(구 inote-blog) 글쓰기 기능에 LLM 챗(`inote-ai`)을 붙이는 작업 중, 그 챗 세션을 글마다
안정적으로 묶으려면 "저장 버튼 누르기 전"에도 고정된 postId가 있어야 한다는 문제에서 출발.
draft 개념을 새로 도입하고, 그 위에 자동저장·AI 요약·대화 기록 접근 제어까지 이어붙임.

#### ✅ draft/발행 모델 도입

- `Post.publishedAt DateTime?` 추가 (null = 아직 저장 안 한 draft). 기존 글은 전부
  `createdAt`으로 백필해서 계속 공개 목록에 남도록 처리 (`prisma db execute`로 안전하게 적용,
  마이그레이션 히스토리 drift 위험 때문에 `migrate dev` 안 씀 — 기존 관례 그대로 유지)
- `POST /blog/posts/draft`(로그인 필요) — 빈 글쓰기 화면 진입 시 호출, 즉시 빈 `Post` row 생성
- `GET /blog/posts`(목록)는 `publishedAt IS NOT NULL`인 글만 노출
- `GET /blog/posts/:id`(단건)는 draft면 요청자가 작성자 본인일 때만 보여주고, 그 외엔 404로
  존재 자체를 숨김 — 이걸 위해 `OptionalAuthGuard` 신설(로그인 안 해도 통과시키되, 했으면
  `request.user`를 채워줌 — 기존 `AuthGuard`는 비로그인 시 무조건 거부라 재사용 불가)
- `GET /blog/posts/mine/drafts`(로그인 필요) — 내 draft 목록. FE의 "지금 작성 중인 글이
  있습니다" 안내 모달 + 헤더 알림 벨 둘 다 이 엔드포인트를 공유해서 씀

#### ✅ 저장/자동저장 분리 (`UpdatePostDto.publish`)

- 처음엔 "저장(PATCH) = 곧 발행"이었는데, FE에서 실시간 자동저장(임시저장)을 붙이면서 이대로
  두면 타이핑 멈출 때마다 글이 발행돼버리는 문제가 생김
- `UpdatePostDto`에 `publish?: boolean` 추가 — `true`일 때만 `publishedAt` 채우고 `inote-ai`
  요약 호출, 없으면(자동저장) 내용만 갱신하고 발행 상태·요약은 그대로 둠

#### ✅ PostSummary — 저장 시 AI 자동 요약

- `PostSummary` 모델 신규 (`Post`와 1:1, `onDelete: Cascade`, `summary String[]`)
- `BlogService.update()`가 진짜 저장(`publish: true`) 성공 시 `inote-ai`의 `POST /summarize`를
  내부 시크릿 헤더(`x-internal-secret`)로 호출해 불릿 3~4개를 받아 upsert. 실패해도 글 저장
  자체는 막지 않도록 try/catch로 격리 (AI 서버 장애가 핵심 기능을 막으면 안 된다는 원칙)
- 빈 내용(`""`/`<p></p>`) 저장 시엔 호출 자체를 스킵

#### ✅ 대화 기록 접근 제어용 내부 API

- `GET /blog/posts/:id/owner`(내부 전용, `InternalSecretGuard`) — 글 작성자 id만 반환.
  `inote-ai`가 대화 기록 조회/저장 전에 "요청자가 진짜 이 글의 작성자인지" 확인하는 용도
- 작성자가 아니면: 채팅 자체(LLM 응답)는 그대로 되고, 그 글에 대화를 저장/조회만 안 됨 —
  "기능은 막지 않되 데이터만 격리"하는 패턴을 여기도 동일하게 적용

#### 신규/변경 파일

- `src/auth/optional-auth.guard.ts`, `src/auth/internal-secret.guard.ts` (신규)
- `src/blog/blog.controller.ts`, `src/blog/blog.service.ts`, `src/blog/dto/update-post.dto.ts`
- `prisma/schema.prisma` — `Post.publishedAt`, `PostSummary` 모델
- `.env` — `INOTE_AI_URL`, `INTERNAL_SECRET` 추가

#### 검증

- curl로 owner/other 두 계정 시나리오 직접 검증 (draft 목록 미노출, 타인 조회 404, 대화 기록
  조회 403, 타인이 보낸 채팅은 응답은 오되 저장 안 됨)
- 브라우저로 실제 가입 → draft 생성 → 자동저장(발행 상태 유지 확인) → 저장(발행+요약 생성) →
  상세 페이지 AI 개요 노출까지 전체 플로우 확인. 테스트 계정/글은 전부 정리함

#### 🐛 추가 발견 — 자동저장 400 Bad Request (`UpdatePostDto`)

`inote-ai`의 대화 세션 기능을 작업하다가 실제로 자동저장을 테스트하면서 발견한 버그.
`UpdatePostDto`가 `PartialType(CreatePostDto)`를 상속하면서 `title`/`content`의
`@MinLength(1)`도 그대로 물려받아, `publish` 없는 자동저장 요청에서 제목만 입력하고 본문이
비어 있으면 400이 발생했음. `@ValidateIf((o) => o.publish === true)`로 감싸서 `publish`가
`true`(진짜 저장)일 때만 최소 길이를 검증하도록 수정. curl로 401(인증 없음)만 나오고 400은
더 이상 안 나오는 것, DB에 빈 본문이 그대로 저장되고 `publishedAt`은 null로 유지되는 것 확인.

#### 📄 README 정리

`inote`/`inote-ai` 연결을 반영해 README 업데이트 — `blog` 모듈 API 목록 추가, 연결 서비스
표에 `inote`/`inote-ai` 추가, `INOTE_AI_URL`/`INTERNAL_SECRET` 환경변수 문서화.

#### 📄 콜드 스타트 방지 방식 기록

Render 무료 플랜 슬립 문제를 [cron-job.org](https://cron-job.org)로 `/api/v1/health`를
10분마다 호출해서 막고 있다는 걸 README 인프라 섹션에 명시 — 레포 안에는 관련 설정 파일이
없고 cron-job.org 자체 대시보드에서 설정된 것이라, 문서화 안 해두면 나중에 잊기 쉬움.

---

### 2026-08-07

#### ✅ MiniGameResult 모델 추가 — 미니게임(캐시플로우) 결과 저장 API

`inote-money` `/demo/mini-game`(쥐경주 탈출 보드게임) 플레이 결과를 기록해두면, 나중에 AI가 그 결과를 분석해서 조언해주는 기능의 기반 데이터로 쓸 목적. 한 유저가 여러 번 플레이 가능하므로 결과마다 새 row가 쌓이는 1:N 구조.

**Prisma 스키마**
- `MiniGameResult` 모델 신규 — 요약 컬럼(직업, 결과, 턴 수, 최종 현금/패시브인컴/월지출/월잉여현금, 은행대출, 총부채, 보유주식·부동산 개수, 자녀 수) + JSON 스냅샷(`finalStocks`, `finalRealEstates`, `liabilitiesSnapshot`, `gameLogs` — 전체 턴별 행동 로그까지 포함, AI 분석 원본용)
- `GameResult` enum: `WON` | `GAVE_UP`
- 요약 컬럼과 JSON 스냅샷을 한 테이블에 함께 저장하기로 결정 — 목적이 "이 한 판을 AI에게 통째로 넘겨 리뷰받는 것"이라 row 단위 SQL 집계가 필요 없어, 로그/보유자산을 별도 테이블로 정규화할 실익이 적다고 판단 (`UserSetting.savings`/`fixedExpenses` JSON 저장 방식과 동일 컨벤션)

**마이그레이션 이슈 — drift 발생**
- `prisma migrate dev` 실행 시 마이그레이션 히스토리와 실제 DB 간 drift 감지, `migrate reset`(전체 데이터 삭제) 제안받음 → 절대 실행하지 않음
- 임시 스키마 파일로 `prisma db pull` 읽기 전용 인트로스펙션 → 실제 DB가 이미 현재 `schema.prisma`와 필드 단위로 일치함을 확인 (과거 `memo`/`nickname`/`phone`/`SettingHistory`가 `db push`로만 반영되고 마이그레이션 파일이 안 남아서 생긴 히스토리 불일치, 실제 구조 문제는 아니었음)
- `prisma db push`로 `MiniGameResult` 테이블만 안전하게 추가 (기존 테이블/데이터 무영향) — `SettingHistory` 추가 때와 동일한 방식(2026-07-06 로그 참고)

**API**
- `POST /money/mini-game/results` — 결과 저장
- `GET /money/mini-game/results` — 이력 목록 (최신순)
- `GET /money/mini-game/results/:id` — 단건 조회 (본인 소유 확인)

**신규 파일**
- `src/money/mini-game/mini-game.controller.ts`, `mini-game.service.ts`
- `src/money/mini-game/dto/create-mini-game-result.dto.ts` — `GameLogDto`/`AssetStockDto`/`AssetRealEstateDto`/`LiabilityItemDto` 중첩 검증 포함
- `src/money/money.module.ts`에 등록

**검증**
- 타입체크·lint 통과, 로컬 서버 부팅 후 라우트 3개 정상 등록 확인, 미인증 요청 시 401 정상 응답
- 로그인 후 실제 저장/조회는 FE 연동 후 확인 예정

---

### 2026-08-07 (3차) — 금융지식(용어사전+추천도서) BE 구현 + 테스트 학습

실제 기업 사이클(기획→디자인→개발→인프라)을 흉내내며 진행. 기획은 Notion planning 문서에 반영 완료(용어/도서 CRUD, 카테고리, 공유 토글, 좋아요, 본인 게시물만 수정·삭제). 디자인은 사람이 Google AI Studio로 목업 제작 중 — FE 작업은 그거 나온 뒤 착수.

**Prisma 스키마**
- `Term`/`TermLike`, `Book`/`BookLike` 모델 + `FinanceCategory` enum(STOCK/REAL_ESTATE/TAX/SAVING/INSURANCE/ECONOMY/ETC) 공용
- `isShared` 토글로 공개 범위 결정 (공유 or 본인 소유일 때만 조회 가능)
- `prisma db push`로 Neon dev 브랜치 안전 반영 (순수 추가, 기존 테이블 무영향)

**API — `src/money/terms/`, `src/money/books/`**
- `GET/POST /money/terms`, `GET/PATCH/DELETE /money/terms/:id`, `POST /money/terms/:id/like`
- `GET/POST /money/books`, `GET/PATCH/DELETE /money/books/:id`, `POST /money/books/:id/like`
- 목록 조회 시 `likeCount`/`likedByMe`/`isOwner` 계산해서 응답에 포함
- 좋아요는 토글 방식 (`TermLike`/`BookLike` 유니크 제약으로 중복 방지)
- 로컬 서버 부팅 후 라우트 전체 등록 확인 + 미인증 401 curl 확인

**단위 테스트 (TESTING_GUIDE.md 학습 계획 실전 적용)**
- `terms.service.spec.ts`, `books.service.spec.ts` — 정상 케이스, 공유 필터링, 권한 체크(본인 아니면 수정/삭제/열람 불가), 좋아요 토글 로직까지 22개 테스트 작성, 전부 통과
- 진행 중 발견한 lint 이슈: `@typescript-eslint/no-unsafe-assignment` 등 unsafe-* 규칙이 Jest mock 객체와 충돌 → `eslint.config.mjs`에 `**/*.spec.ts`, `test/**/*.ts` 전용 완화 규칙 추가 (프로덕션 코드는 그대로 엄격하게 유지)
- 곁다리로 발견한 기존 버그: `app.controller.spec.ts`(NestJS 기본 생성 테스트)가 `AppController`에 `PrismaService`가 추가된 뒤로 계속 깨져 있었음(헬스체크 엔드포인트 추가 시 테스트 갱신 안 됨) → mock provider 추가해서 픽스. `npm run test` 전체 3 스위트 23개 테스트 통과.

**E2E 테스트 — 인프라 이슈로 보류**
- `test/financial-knowledge.e2e-spec.ts` 작성(미인증 401 검증) 자체는 완료
- 그런데 `npm run test:e2e`가 `AppModule` import 시점에 실패 — `better-auth` 패키지가 ESM 전용(.mjs)으로 배포되어 있고, 그 의존성 트리(`better-auth` → `@better-auth/core` → `better-auth/node_modules/@noble/hashes` ...)가 전부 ESM이라 Jest 기본 CommonJS 트랜스폼이 파싱 불가
- `transformIgnorePatterns`에 패키지를 하나씩 allowlist 추가해봤지만 계속 새로운 ESM 패키지가 나와서 밑빠진 독 — **이 프로젝트의 E2E 테스트는 better-auth 도입 이후 한 번도 정상 실행된 적이 없었던 것으로 보임** (기존 `test/app.e2e-spec.ts`도 동일하게 실패하는 것으로 확인)
- 근본 해결책은 Jest를 ESM 모드로 전환(`ts-jest` `useESM`, `NODE_OPTIONS=--experimental-vm-modules`)하는 것인데, 범위가 커서 즉흥적으로 계속 파지 않고 **CI/CD 인프라 구성(다음 Task) 때 제대로 시간 잡고 해결하기로 결정**. `test/jest-e2e.json`은 시도했던 변경 원복해서 클린한 상태로 유지.

**남은 작업**
- FE 데모(`/demo/financial-knowledge`) — Google AI Studio 목업 대기
- FE 실서비스(`/financial-knowledge`)
- CI/CD 파이프라인 구성 시 Jest ESM 이슈 함께 해결

---

### 2026-08-07 (2차)

#### 🐛 로컬 환경 Google 로그인 실패 — 쿠키 SameSite/Secure 설정 수정

미니게임 API 연동 후 사람이 로컬(`localhost:3000` ↔ `localhost:3200`)에서 로그인 테스트 중 Google OAuth 팝업이 로딩 화면에서 멈추는 문제 발견.

**원인 파악**
- CORS(`main.ts`)와 Better Auth `trustedOrigins`(`auth.ts`) 둘 다 `http://localhost:3000`이 이미 허용되어 있어 화이트리스트 문제는 아님
- `auth.ts`의 `defaultCookieAttributes`가 `sameSite: 'none', secure: true`로 고정 — `secure: true`는 HTTPS 전용 쿠키 속성인데, 프로덕션(Vercel↔Render, 서로 다른 도메인이라 `SameSite=None` 필수)에 맞춰 고정해둔 값이 로컬(`localhost:3000`↔`localhost:3200`, 포트만 다른 **같은 사이트**라 `SameSite=Lax`로 충분)에서는 브라우저별로 불안정하게 동작할 수 있음

**수정**
- `render.yaml`에 이미 설정된 `NODE_ENV=production`을 기준으로 `isProduction` 플래그 추가
- `defaultCookieAttributes`를 환경별로 분기: 프로덕션은 `sameSite: 'none', secure: true` 유지, 로컬은 `sameSite: 'lax', secure: false`

**검증**
- 타입체크·lint 통과. 실제 로그인 재확인은 사람이 로컬 BE 재기동 후 직접 진행 예정.

---

### 2026-07-06

#### ✅ SettingHistory 모델 추가 — 자산 설정 히스토리 기능

**Prisma 스키마 변경**
- `SettingHistory` 모델 신규: `userId`, `month("2026-07")`, `title?`, 설정값 스냅샷(`salary`, `dailyLimit`, `monthlySavingGoal`, `salaryDate?`, `assetUpdateDate?`), `savings Json`, `fixedExpenses Json`, `memo?`, `recordedAt`
- `UserSetting`에 `memo String?` 필드 추가
- `prisma db push` 사용 (migrate dev drift 방지 — 기존 마이그레이션과 충돌 없이 스키마 동기화)

**Settings 컨트롤러 확장 (5개 엔드포인트 추가)**
- `GET /money/settings/history` — 목록 조회 (최신순, userId 필터)
- `POST /money/settings/history` — 현재 설정값 스냅샷 저장
- `GET /money/settings/history/:id` — 단건 조회 (본인 소유 확인)
- `PATCH /money/settings/history/:id` — 제목 수정
- `DELETE /money/settings/history/:id` — 삭제

**신규 DTO**
- `create-setting-history.dto.ts` — `title?` + 설정값 스냅샷 전체
- `update-setting-history.dto.ts` — `title?` (제목만 수정 가능)

#### ✅ UpsertSettingsDto 재설계 — savings/fixedExpenses 배열 구조

기존 `savings Int`, `fixedExpense Int` 단일 값 → `SettingsItemDto[]` 배열로 변경
```ts
class SettingsItemDto {
  id: string;
  name: string;
  amount: number;
  day?: number; // 이체일
}
```
- `@ValidateNested({ each: true })` + `@Type(() => SettingsItemDto)` 적용
- FE UpsertSettingsDto와 구조 동기화 완료

---

### 2026-07-02

#### ✅ 로컬 서버 실행 불가 버그 수정 (`npm run start:dev` → dist not found)

**증상**
- `npm run start:dev` 실행 시 "Found 0 errors. Watching for file changes." 출력 후
- `Cannot find module '/dist/main'` 에러 발생
- `npm run build` 도 exit 1로 실패하나 오류 메시지 없음

**근본 원인**
`nest-cli.json`의 `deleteOutDir: true` + `tsconfig.json`의 `incremental: true` 조합 충돌

1. `nest start --watch` 실행 → dist 폴더 삭제 (`deleteOutDir: true`)
2. tsc watch가 `tsconfig.build.tsbuildinfo` 캐시를 발견 → "변경 없음"으로 판단 → 파일 emit 안 함
3. dist가 비어있는 채로 NestJS가 `dist/main` 실행 시도 → `MODULE_NOT_FOUND` 에러

**수정**
`tsconfig.json`에 `tsBuildInfoFile` 경로를 dist 내부로 지정:

```json
"tsBuildInfoFile": "./dist/.tsbuildinfo"
```

dist 삭제 시 `.tsbuildinfo` 캐시도 함께 삭제되어 tsc가 항상 정상 재컴파일함.

**주의사항**
- 기존에 `tsconfig.build.tsbuildinfo` 파일이 루트에 남아있다면 수동 삭제 필요:
  ```bash
  rm -f tsconfig.build.tsbuildinfo
  ```
- 이후 `npm run start:dev`만으로 정상 동작

---

### 2026-06-23 (2차)

#### ✅ Render 배포 완료

**배포 플랫폼 결정**
- Railway → Render로 변경 (Railway 무료 플랜 없음, Render 영구 무료)
- Render 무료 플랜: 512MB RAM, 0.1 CPU, 15분 비활성 시 슬립

**배포 설정**
- `render.yaml` 추가
- Build Command: `npm install --include=dev && npx prisma generate && npm run build`
- Start Command: `npm run start:prod` (`prisma migrate deploy && node dist/main`)
- Health Check: `/api/v1/health` 엔드포인트 추가 (`AppController`)

**트러블슈팅**

1. `nest: not found` — devDependencies 미설치 → `--include=dev` 추가로 해결
2. `dist/main` not found — `prisma.config.ts`가 루트에 있어 TypeScript의 rootDir이 `.`으로 추론됨 → 출력이 `dist/src/main.js`로 잘못 생성됨
   - `tsconfig.json`에 `"rootDir": "src"` 추가
   - `tsconfig.build.json`에 `prisma.config.ts` exclude 추가
3. OOM (heap out of memory) — Start Command에 빌드 중복 포함 → Start Command에서 빌드 제거로 해결

**결과**
- 서버 URL: https://inote-server-5a63.onrender.com
- `GET /api/v1/health` → `{ "status": "ok" }` 정상 응답 확인
- Google OAuth Redirect URI 업데이트 완료

#### 🔜 다음 작업
- Sentry 프로젝트 생성 및 DSN 연결
- FE + BE 연동 (3단계)

---

### 2026-07-03

#### ✅ Prisma 스키마 재설계 — inote-money API 모델 추가

기존 `Expense`, `Stock`, `UserSetting` 모델이 API 스펙과 맞지 않아 전면 재설계.

**변경 내용**

| 모델 | 변경 사항 |
|------|-----------|
| `UserSetting` | `dailyLimit`, `monthlySavingGoal`, `assetUpdateDate`, `salaryDate` 추가. `savings`/`fixedExpenses` `Int` → `Json` 배열로 변경 |
| `Expense` | `isWaste`, `description` 추가. `category` 문자열 → `Category` enum. 불필요한 `type` 필드 제거 |
| `Stock` → `StockHolding` | `market`(KR/US) 추가. `inputMode` 문자열 → `InputMode` enum. `ticker` optional로 변경 |
| `Review` | 신규 추가 — 주간/월간 리뷰 (rating, text). `(userId, type, year, period)` unique |

**추가된 enum**
- `Category`: FOOD / CAFE / TRANSPORT / SHOPPING / MEDICAL / CULTURE / SUBSCRIPTION / ETC
- `Market`: KR / US
- `InputMode`: QUANTITY / AMOUNT
- `ReviewType`: WEEKLY / MONTHLY

**마이그레이션 이슈**
- Neon 기본 샘플 테이블 `playing_with_neon`이 마이그레이션 히스토리에 없어 drift 감지
- `migrate dev` 대신 `db push --accept-data-loss`로 처리 (샘플 데이터라 무방)

#### ✅ user 모델 확장 — v2 회원가입 대비

v2에서 이메일 로그인, 핸드폰 OTP 등 다양한 인증 방식 추가를 고려해 모델만 선제적으로 확장.

```prisma
nickname      String?
phone         String?
phoneVerified Boolean  @default(false)
```

- 실제 기능(이메일 로그인, 이메일 인증, 핸드폰 등록)은 v2에서 구현 예정
- v1은 Google OAuth만 사용

#### ✅ Notion 서버 기획 문서 작성

- BE API 스펙 전체 정리 (Users, Expenses, StockHoldings, Reviews)
- DB 스키마 초안 포함
- v1/v2 범위 분리 명시 (v1: inote-money만, v2: 멀티앱 구조 개선)
- DB 확인 방법 (Prisma Studio, Neon 콘솔) 노션 메인 페이지에 추가

#### 🔜 다음 작업
- NestJS 모듈 구현 (Users 설정 → Expenses → Reviews → Stocks)
- Google 팝업 로그인 구현 (FE)

---

### 2026-06-23 (1차)

#### ✅ DB 다이어그램 생성

- Prisma 스키마 → DBML 변환
- dbdiagram.io에서 ERD 시각화 및 PNG export
- 노션 DB 문서 서브페이지에 등록 예정
- DBML 원본 + 테이블 한글 설명 문서 (`Downloads/inote-server-db-docs.md`) 작성

#### ✅ Users 모듈 구현

**신규 파일**
- `src/auth/auth.guard.ts` — Better Auth 세션 검증 가드 (`AuthGuard`)
  - `auth.api.getSession()` + `fromNodeHeaders`로 세션 확인
  - 실패 시 `401 UnauthorizedException` 반환
  - `request.user`에 유저 정보 주입
- `src/auth/current-user.decorator.ts` — `@CurrentUser()` 데코레이터 (컨트롤러에서 유저 추출)
- `src/users/dto/update-user.dto.ts` — 이름 / 이미지 URL 수정 DTO
- `src/users/users.service.ts` — `getMe` / `updateMe` (password 등 민감 필드 select 제외)
- `src/users/users.controller.ts` — `GET /users/me`, `PATCH /users/me`
- `src/users/users.module.ts`

**트러블슈팅**
- `npm install` 안 된 상태에서 빌드 시도 → `better-auth/node` 모듈 없음 오류 → `npm install` 후 해결
- Prisma Client 재생성 필요 (`npx prisma generate`) — `emailVerified` 컬럼 인식 못하던 문제 해결

#### ✅ Money 모듈 구현

**신규 파일**
- `src/money/expenses/` — 가계부 CRUD
  - `GET /money/expenses?year=&month=` — 월별 조회 (기본값: 현재 년/월)
  - `POST /money/expenses` — 항목 추가
  - `PATCH /money/expenses/:id` — 항목 수정
  - `DELETE /money/expenses/:id` — 항목 삭제
  - 본인 소유 확인 (`verifyOwner`) — 타인 데이터 접근 시 `403 Forbidden`
- `src/money/stocks/` — 주식 CRUD
  - `GET /money/stocks` — 전체 목록
  - `POST /money/stocks` — 종목 추가
  - `PATCH /money/stocks/:id` — 종목 수정
  - `DELETE /money/stocks/:id` — 종목 삭제
- `src/money/settings/` — 내 정보 설정
  - `GET /money/settings` — 설정 조회
  - `PUT /money/settings` — 설정 저장 (upsert — 없으면 생성, 있으면 수정)
- `src/money/money.module.ts`

**공통 패턴**
- 모든 라우트 `@UseGuards(AuthGuard)` 적용
- `@CurrentUser()` 데코레이터로 유저 ID 추출
- `@ApiTags` / `@ApiOperation` Swagger 데코레이터 적용

#### 🔜 다음 작업
- Railway 배포 (dev 환경 URL 확보)
- Sentry 연결

---

### 2026-06-10 (2차)

#### ✅ 완료 — Better Auth + Google OAuth 2.0 전체 연동

**환경변수 세팅**
- `.env` 파일 생성
- `DATABASE_URL` — Neon PostgreSQL 연결 문자열 설정
- `BETTER_AUTH_SECRET` — 랜덤 시크릿 키 생성
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud Console에서 발급

**Google Cloud Console 설정**
- OAuth 2.0 클라이언트 ID 생성
- 승인된 Redirect URI 등록:
  - `http://localhost:3200/api/v1/auth/callback/google`

**Better Auth BE 설치**
- `better-auth`, `better-auth/adapters/prisma` 설치
- `src/auth/auth.ts` 생성 — Prisma 어댑터 + Google 소셜 프로바이더 설정
- `main.ts` 수정:
  - CORS를 Better Auth 미들웨어보다 먼저 등록 (순서 중요)
  - `/api/v1/auth` 경로로 들어오는 요청을 `toNodeHandler(auth)`로 처리

**Prisma 스키마 마이그레이션**
- `User` → `user` (소문자) 로 테이블명 변경 (Better Auth 요구사항)
- `avatar` → `image`, `emailVerified` 컬럼 추가
- Better Auth 필수 테이블 추가: `session`, `account`, `verification`
- 마이그레이션 적용: `npx prisma migrate dev`

**Better Auth FE 연동 (inote-money)**
- `better-auth/react` 설치
- `src/lib/auth-client.ts` 생성 — `createAuthClient` 설정
- `src/app/login/page.tsx` 생성 — Google 로그인 버튼 UI

**트러블슈팅**
- `toNodeHandler(auth)(req, res, next)` → `next` 인자 제거 필요 (handler는 Express 미들웨어가 아님)
- CORS 오류: Better Auth 미들웨어를 `enableCors()` 이전에 등록했을 때 발생 → 순서 변경으로 해결
- `callbackURL: "/demo"` → 상대 경로 사용 시 BE 서버로 리다이렉트됨 → 절대 URL(`http://localhost:3100/demo`)로 수정

**검증**
- `GET /api/v1/auth/get-session` → `null` 응답 (세션 없음) 정상 확인
- Google 계정 선택 → FE(`localhost:3100/demo`)로 정상 리다이렉트 확인

#### 🔜 다음 작업
- Users 모듈 (GET /users/me, PATCH /users/me)
- Money 모듈 (가계부 CRUD, 주식 CRUD, 설정)
- Railway 배포

---

### 2026-06-10 (1차)

#### ✅ 완료
- GitHub 레포 생성 (`inote-server`)
- CLAUDE.md / DEV_LOG.md / NESTJS_GUIDE.md / LEARNING.md 추가
- 인프라 및 기술 스택 전체 결정 완료
- NestJS 11 프로젝트 초기화 (TypeScript strict, 포트 3200)
- Swagger UI 설정 (`/api/docs`)
- CORS / ValidationPipe / API prefix(`/api/v1`) 설정
- Prisma 설치 + Neon PostgreSQL 연결
- DB 스키마 확정 및 마이그레이션 적용 (User, Expense, Stock, UserSetting)
- PrismaModule (@Global) + PrismaService 구현

#### 🔜 다음 작업 (다른 노트북에서 이어서)
- Better Auth 설치 및 소셜 로그인 설정
- Users 모듈
- Money 모듈 (가계부, 주식, 설정)

---

## ⚡ 다른 노트북에서 작업 이어받기

```bash
# 1. 레포 클론
git clone https://github.com/seo337dc/inote-server
cd inote-server

# 2. 패키지 설치
npm install

# 3. 환경변수 설정 (.env 파일 생성)
cp .env.example .env
# .env 에 아래 값 입력 (별도 전달)
# DATABASE_URL = Neon 연결 문자열
# BETTER_AUTH_SECRET = (아직 미설정)

# 4. Prisma Client 생성
npx prisma generate

# 5. 서버 실행
npm run start:dev
```

> ⚠️ `.env` 파일은 git에 올라가지 않으므로 직접 만들어야 합니다.
> DATABASE_URL은 Neon 대시보드(https://neon.tech)에서 확인하세요.

---

## 다음 작업 예정

### 1단계 — BE 완성 + 배포

- [x] NestJS 프로젝트 초기화
- [x] Prisma 설치 및 Neon PostgreSQL 연결
- [x] Better Auth 설치 및 Google 소셜 로그인 연동
- [x] DB 다이어그램 생성 (dbdiagram.io)
- [x] Users 모듈 구현 (`GET /users/me`, `PATCH /users/me`)
- [x] Money 모듈 — Expenses 가계부 CRUD
- [x] Money 모듈 — Stocks(StockHolding) CRUD
- [x] Money 모듈 — Settings 내 자산 설정 GET/PUT
- [x] SettingHistory API 5개 + DTO 2개
- [x] MiniGameResult 모델 + 결과 저장 API 3개
- [x] Render 배포 완료
- [ ] Sentry 프로젝트 생성 및 DSN 연결

### 3단계 — FE + BE 연동 (Render 배포 완료)

- [x] 로그인 페이지 실제 연동 (Better Auth Google 소셜 로그인)
- [x] 내 자산 설정 API 연동 완료
- [x] 자산 설정 히스토리 API 연동
- [ ] 대시보드 내 자산 카드 → settings API 연동
- [ ] 가계부 localStorage → 실제 API 교체
- [ ] 주식 localStorage → 실제 API 교체

---

## 주요 기술 결정 사항

| 결정 | 선택 | 이유 |
|------|------|------|
| BE 프레임워크 | NestJS + TypeScript | 모듈 구조, DI, 데코레이터 — 대규모 서비스 확장에 유리 |
| ORM | Prisma | TypeScript 타입 자동 생성, 마이그레이션 관리 용이 |
| 인증 | Better Auth | Next.js 16 + Prisma 공식 지원, next-auth 대체, 소셜 로그인 내장 |
| DB | Neon PostgreSQL | 영구 무료, dev/prod 브랜치 분리 가능, 512MB 제공 |
| BE 배포 | Render | 영구 무료 (15분 슬립), GitHub 연동 자동 배포 |
| FE 배포 | AWS Amplify | Next.js SSR 공식 지원, GitHub 연동 CI/CD 자동화, 무료 플랜 |
| 에러 로그 | Sentry | 영구 무료 (5K 에러/월), 에러 추적 + 알림 |
| API 서버 로그 | Railway 내장 로그 | 별도 설정 불필요, 무료 |
| API 문서 | Swagger (@nestjs/swagger) | NestJS 공식 지원, 데코레이터로 자동 생성 |
| AWS EC2/RDS | 사용 안 함 | 12개월 후 과금 — 지속 가능한 무료 플랜 우선 |

---

## 인프라 결정 배경 (상세)

### DB — Neon 선택 이유
- Supabase vs Neon 비교 검토
- Supabase: 1주 비활성 시 슬립, Storage/Auth 등 부가 기능 많지만 지금은 불필요
- **Neon 선택**: 5분 슬립이지만 dev/prod 브랜치 분리 가능 → 개발환경과 운영환경 DB 분리하기 좋음

### BE 배포 — Render 선택 이유
- AWS EC2 t2.micro는 12개월 무료 후 과금 (~$9/월)
- Railway는 무료 플랜 없음 ($5/월 최소 과금)
- **Render 선택**: 영구 무료 (15분 슬립), GitHub 연동 자동 배포, 환경변수 관리 UI 제공

### FE 배포 — AWS Amplify 선택 이유
- Next.js App Router (SSR)는 S3+CloudFront만으로 불가
- Vercel은 무료이지만 AWS 경험 목적으로 Amplify 선택
- **AWS Amplify 선택**: Next.js SSR 공식 지원, GitHub Push 시 자동 배포, 무료 플랜 제공
