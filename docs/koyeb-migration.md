# inote-server 호스팅 이전 — Render → Koyeb

> 이 레포(`inote-server`, NestJS BE)의 이전 기록. 전체 배경·원인·결정은 `inote` 레포의
> `docs/infra/hosting-migration.md` 참고. Notion 정리용 원본.
> 시작: 2026-09-30 / 상태: 🟡 준비 중 (이전 작업 시작 전)

---

## 1. 왜 옮기나 (요약)

Render 무료 웹 서비스 2개를 10분마다 깨워 두다가 월 750시간 한도를 넘겨 **정지(Suspended)** 됐다
(BE 응답 `503 Service Suspended`). BE는 NestJS + Prisma라 Cloudflare Workers로는 사실상 재작성이 필요해서,
Docker 그대로 올릴 수 있는 **Koyeb 무료 인스턴스**를 선택했다.

## 2. Koyeb 무료 인스턴스 조건 (2026-09 검색 기준, 가입 전 공식 페이지 재확인)

| 항목 | 내용 |
|---|---|
| 사양 | 0.1 vCPU, 512MB RAM, 2GB SSD (조직당 1개) |
| 리전 | 프랑크푸르트 또는 워싱턴 D.C. → **워싱턴 D.C.**(Neon `us-east-1`과 가까움) |
| 슬립 | 1시간 무트래픽 시 0으로 축소(끌 수 없음), 다음 요청에서 1~5초 안에 깨어남 |
| 카드 | 유효한 카드 필요. 가입 기본 플랜이 월 $29 Pro → **무료로 내려야 함** |

## 3. 작업 체크리스트

- [ ] Koyeb 가입(카드 등록, 가입 기본 플랜 Pro → 무료 다운그레이드 확인)
- [x] `Dockerfile`·`.dockerignore` 작성 — Debian(slim) + OpenSSL, `pnpm install --frozen-lockfile --prod=false`, 빌드 시 `DATABASE_URL` 자리표시자로 `prisma generate`, 시작은 `prisma migrate deploy && node dist/main`, 포트 8000. 깨끗한 복사본에서 설치·generate·build 순서를 검증(로컬에 Docker가 없어 이미지 빌드는 Koyeb 첫 배포에서 확인) (2026-09-30)
- [x] 시작 시 `prisma migrate deploy` 유지, `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1`은 Dockerfile `ENV`로 포함
- [ ] 환경 변수 이전 (아래 표)
- [ ] 헬스체크 경로 `/api/v1/health` 지정
- [ ] Better Auth 쿠키(`SameSite=None; Secure`) 도메인이 새 BE 주소로 바뀌는 영향 점검, Google OAuth 리디렉션 URI 추가, `trustedOrigins`/CORS 갱신
- [ ] FE의 `NEXT_PUBLIC_API_URL`을 새 BE 주소로 교체
- [ ] 슬립 시 첫 요청 지연(1~5초) 체감 확인, cron-job 핑 유지 여부 결정
- [ ] 마무리: `render.yaml` 정리, `README.md`·`CLAUDE.md`의 배포 정보 최신화

## 4. 환경 변수 (값은 적지 않는다)

| 변수 | 비고 |
|---|---|
| `PORT` | `8000` (Dockerfile 기본값, Koyeb 노출 포트와 일치) |
| `NODE_ENV` | `production` (Dockerfile 기본값) |
| `BETTER_AUTH_URL` | **새 BE 주소**(Koyeb가 발급). 첫 배포로 주소를 받은 뒤 입력하고 재배포 |
| `AUTH_ERROR_FALLBACK_URL` | `https://inote-main.vercel.app/login` |
| `DATABASE_URL` | Neon pooled 주소 (Supabase 이전은 별도 문서 `supabase-migration.md`) |
| `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` | `1` (start:prod에도 포함되어 있음) |
| `INTERNAL_SECRET` | AI 서버와 동일한 값 |
| `INOTE_AI_URL` | AI 서버(Vercel) 주소 — 아래 5번 참고 |
| `BETTER_AUTH_SECRET` | 기존 값 그대로 (바꾸면 기존 로그인 세션이 모두 무효) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 기존 값 |
| `CF_ACCOUNT_ID`, `CF_ACCESS_KEY_ID`, `CF_SECRET_ACCESS_KEY`, `CF_R2_BUCKET`, `CF_R2_PUBLIC_URL` | 이미지 업로드(R2)용 — `render.yaml`에는 없지만 Render 대시보드에 있을 수 있으니 확인 |
| `SENTRY_DSN` | 쓰고 있다면 |

## 5. inote-ai 연동 (일부만)

- BE는 AI 서버를 `INOTE_AI_URL`로 호출한다 (글 저장 시 AI 요약, AI 다시 요약하기, 채팅 세션 삭제).
- AI 서버가 Vercel로 이전되면 **`INOTE_AI_URL`을 새 Vercel 주소로 교체**해야 한다.
- 두 서버는 `INTERNAL_SECRET`(같은 값)으로 서로를 확인한다.
- AI 서버의 이전 과정·Vercel 제한·환경 변수는 **`inote-ai` 레포의 `docs/vercel-migration.md` 참고**.

## 6. Koyeb 배포 절차 (사용자가 대시보드에서)

1. Koyeb 가입 → **플랜을 무료로 내리기**(가입 기본이 유료 Pro) → 카드 등록
2. Create Service → GitHub `inote-server` 저장소, 브랜치 `main` 선택
3. Builder: **Dockerfile** 선택 (이 레포 루트의 `Dockerfile`)
4. Instance: **Free**, 리전 **Washington D.C.**
5. Exposed port: **8000**(HTTP), 경로 `/`. Health check: HTTP `/api/v1/health`
6. Environment variables: 위 4번 표의 값을 입력 (비밀 값은 Secret으로)
7. Deploy → 주소(`https://<이름>-<조직>.koyeb.app`)를 확인
8. 그 주소로 `BETTER_AUTH_URL`을 설정하고 재배포
9. **Google Cloud Console**의 OAuth 클라이언트에 승인된 리디렉션 URI 추가: `https://<새 BE 주소>/api/v1/auth/callback/google`
10. `inote-ai`(Vercel)의 `INOTE_SERVER_URL`을 `https://<새 BE 주소>/api/v1`로, FE(Vercel)의 `NEXT_PUBLIC_API_URL`을 새 주소로 교체 후 재배포

## 7. 진행 로그

| 날짜 | 한 일 | 결과·메모 |
|---|---|---|
| 2026-09-30 | 문서 작성 | 이전 작업은 AI 서버(Vercel) 이후 시작 |
| 2026-09-30 | `Dockerfile`·`.dockerignore` 작성, 깨끗한 복사본에서 install/generate/build 검증 | 이미지 빌드는 Koyeb 첫 배포에서 확인 |

## 8. 트러블슈팅 (겪으면 채우기)

-

## 9. 참고 자료

- Koyeb 스케일 투 제로: https://www.koyeb.com/docs/run-and-scale/scale-to-zero
- Render 무료 플랜: https://render.com/docs/free
