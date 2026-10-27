# 할 일 — 인증(better-auth) 후속

> 2026-10-27 구글 로그인 실패(중복 account 행) 대응 후 남긴 것. 끝낸 항목은 완료일을 적고 아래 "완료"로 옮긴다.

- [ ] **Render 대시보드 빌드 명령을 pnpm으로 바꿀지 결정** — 지금은 `npm install --include=dev && npx prisma generate && npm run build`라서 `pnpm-lock.yaml`을 무시하고 **모든 의존성이 배포 때마다 범위 안 최신으로** 설치된다(better-auth만 정확히 고정한 상태). lockfile을 따르게 하려면 대시보드 Build Command를 `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm exec prisma generate && pnpm run build`로(`render.yaml`과 같게) 바꾸고, Start Command도 맞는지 확인한다. 바꾸면 처음 배포에서 버전이 한꺼번에 바뀔 수 있으니 로컬 lock 기준(현재 lock 버전들)으로 올라가는 것을 확인한다.
- [ ] **배포 빌드 로그에서 `[deps] better-auth 1.7.12 -> 1.7.12` 확인** — `prebuild`(`scripts/print-deps.js`)가 찍는 줄. 다른 의존성도 같은 방식으로 확인할 수 있다.
- [ ] **`render.yaml`이 실제로 쓰이는지 정리** — 지금은 대시보드 설정이 우선이라 파일과 서비스 설정이 어긋나 있다. Blueprint로 연결하거나, 파일을 지우거나, 파일 내용을 대시보드와 맞춘다.
- [ ] **고정 배포 후 구글 로그인 확인** — 새로 로그인하는 사용자와 기존 사용자 모두. `account`에 같은 `providerId`+`accountId` 행이 또 생기지 않는지(`select "accountId", count(*) from account where "providerId"='google' group by 1 having count(*) > 1`).
- [ ] **better-auth 업그레이드 절차 정하기** — 올릴 때는 릴리스 노트·업그레이드 가이드에서 DB 컬럼 의미(예: `account.issuer`) 변경을 확인하고, 로컬에서 구글·이메일 로그인을 해 본 뒤 올린다.
- [ ] **`account.issuer` 컬럼 정리 검토** — 1.7.3 이상은 쓰지 않는다. nullable이라 해롭지 않지만, 남겨 둘지 마이그레이션으로 뺄지 정한다.
- [ ] **로컬 개발 DB 컨테이너가 깨져 있음** — `docker compose up` 시 `RWLayer of container … is unexpectedly nil`. 데이터 볼륨을 건드리지 않고 컨테이너만 다시 만드는 방법을 정해서 고친다.
- [ ] **FE `.env.local`이 운영 BE를 가리킴** — 로컬 구글 로그인 테스트 때 의도치 않게 운영 BE에 붙는다. `NEXT_PUBLIC_API_URL=http://localhost:3200 pnpm dev`로 덮어쓰는 안내를 `inote` README에 둔다(`inote/docs/todo/readme-update.md` 참고).
- [ ] **Safari에서 로그인 후 로그인 상태가 되지 않음 — 원인 확정, 해결 방안 결정 대기** (2026-10-27) — 운영(`inote-main.vercel.app`)에서 Safari로 **이메일·구글 로그인 모두** 로그인되지 않은 상태가 된다. **원인 확정**: FE(`vercel.app`)와 BE(`onrender.com`)가 서로 다른 사이트라, BE가 발급한 세션 쿠키(운영 `SameSite=None; Secure`, `auth.ts`의 `defaultCookieAttributes`)를 Safari의 크로스 사이트 추적 방지(ITP)가 서드파티 쿠키로 막는다. Safari 설정에서 "크로스 사이트 추적 방지"를 끄고 다시 로그인하면 **구글·이메일 모두 정상**이라 확인했다(웹 인스펙터로 쿠키 저장 여부까지 본 것은 아니다). 구글만 안 되는 게 아니라 이메일도 안 되므로 OAuth `state` 문제가 아니라 세션 쿠키 전반의 문제다. 로컬(`localhost` ↔ `localhost`)은 같은 사이트라 재현되지 않는다. **iPhone·iPad는 모든 브라우저가 WebKit이라 브라우저를 바꿔도 같은 증상일 것으로 예상**(직접 확인 못 함). 설정을 끄는 것은 진단용일 뿐 해결이 아니다.
  - **해결 방안(사용자 결정 필요)** — 공통 원리는 쿠키를 FE와 같은 사이트의 것으로 만드는 것:
    - A. **FE 프록시**: Vercel rewrites로 `/api/v1/*`를 BE로 넘긴다(무료). 구글 OAuth 리디렉션 URI·`BETTER_AUTH_URL`을 FE 도메인으로 바꾸고 FE 앱마다(inote, inote-money) 설정해야 한다. Render 콜드 스타트(30~50초)와 프록시 타임아웃의 상호작용은 먼저 실험으로 확인한다.
    - B. **커스텀 도메인**: `app.<도메인>`·`api.<도메인>`처럼 같은 상위 도메인 + `crossSubDomainCookies`. 도메인 비용(연 1만원 안팎). 가장 정석이고 모바일 앱(WebView)·다른 FE에도 같은 구조로 통한다. CLAUDE.md의 "추후 Cloudflare 도메인" 계획과도 맞는다.
    - C. **토큰 방식**(쿠키 대신 `Authorization` 헤더): 변경 범위가 가장 크고 HttpOnly 보호를 잃는다. 지금은 선택할 이유가 약하다.
  - 결정 뒤: 변경 목록·환경변수·배포 순서·롤백을 먼저 정리 → 적용 → **Safari(Mac)와 iPhone에서 이메일·구글 로그인 확인**.
  - 모바일 앱(RN WebView, `apps/app`)의 로그인 플로우(쿠키 교환)도 같은 제약(iOS WKWebView의 서드파티 쿠키 차단)을 받으므로, 쿠키 구조를 한 번에 정리한다.
  - 글 초안: 이 이슈를 글로 정리할 때 `inote` 레포 `docs/blog/`에 둔다.
- [ ] **`state_security_mismatch`("State not persisted correctly") 별도 확인** — 구글 로그인이 연달아 재시도될 때 한 번 찍힌 다른 에러. 중복 문제 해결 후 재현되는지 본다. (Safari의 서드파티 쿠키 차단과 같은 쿠키 구조에서 나올 수 있는 증상이라, 위 Safari 이슈를 해결한 뒤에 함께 사라지는지 확인한다 — 가설.)

## 완료
(아직 없음)
