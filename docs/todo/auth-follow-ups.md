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
- [ ] **`state_security_mismatch`("State not persisted correctly") 별도 확인** — 구글 로그인이 연달아 재시도될 때 한 번 찍힌 다른 에러. 중복 문제 해결 후 재현되는지 본다.

## 완료
(아직 없음)
