# 0002 — BE 요청/응답 로깅·모니터링 전략

> 상태: **결정됨 (2026-10-23, D1~D5 — 아래 "결정 결과" 참고), 구현 미착수**
> 작성: 2026-10-23 · 짝 문서: [`docs/learning/MONITORING.md`](../learning/MONITORING.md) (개념 학습)
> 범위: `inote-server`(BE)만. FE(Next.js + Sentry)는 `inote`·`inote-money` 레포 작업이라 제외.

## 1. 목표
모든 API 통신의 요청·응답(성공/실패 포함)을 JSON 로그로 남기고, 에러는 스택까지 남겨서 검색·모니터링한다. 비용은 0원.

## 2. 원래 요구와 이 레포의 현실

| 원래 요구 | 이 레포에서 확인한 사실 | 영향 |
|---|---|---|
| 전역 인터셉터로 **모든** API 로그 | Better Auth `/api/v1/auth/*`는 Express 미들웨어가 직접 처리하고 `next()`를 부르지 않음 ([main.ts:24-29](../../src/main.ts)) | 인터셉터는 로그인·세션·소셜 로그인을 **못 본다** |
| Request/Response **Body 전체** | 비밀번호·전화번호·이메일·금융 정보·세션 토큰이 오감. 글/독서 `content`는 길이 상한이 없고 목록 응답에도 전체가 실림 | 마스킹과 길이 제한 없이는 비밀이 로그에 쌓임 |
| Prometheus로 모니터링 | `prom-client`·`/metrics` 없음 ([package.json](../../package.json)). 요구된 인터셉터는 로그만 만든다 | Prometheus가 **긁어갈 것이 없다** |
| Promtail로 로그 수집 | Promtail은 **2026-03-02 EOL**(공식 문서), 후속은 Grafana Alloy. 그리고 Render 무료 서비스 안의 로그 파일에는 접근할 수 없음 | Promtail 방식 불가. 앱이 직접 보내거나 Render 로그만 사용 |
| docker-compose로 자체 호스팅 | Render 무료(512MB, 15분 슬립)에는 못 올림. 돌릴 상시 서버가 따로 필요 | 운영용이 아니라 **로컬 개발용**으로만 현실적 |

기존 상태: 전역 가드·필터·인터셉터 없음, 로거는 서비스별 `new Logger(...)`뿐, 요청 로깅 없음, `SENTRY_DSN`은 문서에만 있고 코드엔 없음. 전역 설정은 `ValidationPipe` 하나([main.ts:33](../../src/main.ts)).

## 3. 사용자가 정할 결정

**D1. 로그를 어디서 볼 것인가**
| 선택지 | 장점 | 단점 |
|---|---|---|
| A. Render 대시보드만 (stdout JSON) | 추가 비용·인프라 0, 즉시 가능. 텍스트·정규식·HTTP 필터 검색 | 보관 기간이 짧다(Hobby 7일, 무료는 미확인). 그래프·대시보드 없음 |
| B. Grafana Cloud 무료(Loki) 푸시 | 영구 무료(로그 50GB/월·14일), LogQL 검색, 대시보드 | 앱에 전송 코드 필요. Loki 불통 시 해당 배치 유실. 50GB 초과 시 그 달 신규 로그 버려짐(포럼 근거) |
| C. 자체 호스팅 compose | 오픈소스 그대로 학습 | 상시 서버 필요 → 무료로는 로컬 개발용 한정 |
- 추천: **A로 시작 → 쓸 만하면 B 추가**, C는 학습·로컬용. (추천일 뿐 결정은 사용자)

**D2. 본문을 어디까지 남길 것인가**
| 선택지 | 비고 |
|---|---|
| A. 마스킹 + 길이 제한 | 민감 필드는 `***`, 큰 필드는 잘라서 기록. 인증·업로드는 본문 제외 |
| B. 민감 경로(인증·money·users)는 본문 전체 제외 | 가장 안전, 디버깅 정보 적음 |
| C. 전체 기록(비밀번호·토큰류만 마스킹) | 디버깅은 쉽지만 금융·개인정보가 로그에 남음 |
- 추천: **A**. 마스킹은 허용 목록(allowlist)과 차단 목록(denylist) 중 무엇으로 할지도 같이 결정(학습 문서 6절).

**D3. 인증 경로 `/auth/*`를 기록할 것인가**
- 기록 안 함 / **메타만**(경로·상태·소요시간, 본문 제외) / 본문까지 → 본문은 비밀번호가 있어 비추천.
- 메타만 기록하려면 [main.ts:24](../../src/main.ts)의 Better Auth 미들웨어 **앞**에 로그 미들웨어가 필요하다. 본문 스트림을 읽으면 Better Auth가 본문을 못 받을 위험이 있어 "본문은 읽지 않는다"가 전제(추측, 구현 때 실제 요청으로 검증).

**D4. 메트릭(Prometheus)이 필요한가**
- 요청 수·지연·에러율 그래프가 필요하면 `prom-client`와 `/metrics`를 추가. 로그 검색이 목적이면 불필요(Loki 쿼리로 대체 가능).
- 추천: **이번 범위에서 제외**, 로그가 자리 잡은 뒤 재검토.

**D5. 이번 작업 범위**: 1단계만 / 1+2단계 / 설계 문서만 (아래 단계 참고).

### 결정 결과 (2026-10-23)

| 결정 | 선택 | 비고 |
|---|---|---|
| D1 | stdout JSON 유지 + Grafana Cloud Loki 푸시 | Render는 임시 호스트(실무에선 안 씀)라 호스트와 무관한 앱 직접 푸시. Loki 전송은 환경변수가 있을 때만 켠다. S1·S2는 목적지와 무관하게 먼저 가능 |
| D2 | 마스킹 + 길이 제한, **차단 목록(denylist)** | 허용 목록은 채택하지 않음 |
| D3 | `/api/v1/auth/*`는 **메타만** 기록 | 경로·상태·소요시간. 본문은 읽지 않음(S3) |
| D4 | 메트릭(Prometheus, S6) **이번 범위 제외** | 로그가 자리 잡은 뒤 재검토 |
| D5 | 이번 작업은 **S1만** | 이후 단계는 그때 다시 정함. S4(Loki 전송)는 Grafana 학습 후 |

**S1 설계안 (사용자 확인 대기 중 — 아래 3개 질문에 답하면 구현 시작)**
- 파일: `src/common/logging/redact.ts`, `redact.spec.ts` (외부 의존성 없는 순수 함수, 사용처 없음 → 배포 영향 없음). 브랜치는 main에서 `feat/log-redact`.
- 인터페이스: `redact(value: unknown, options?: { maxStringLength?: number; maxDepth?: number }): unknown` — 입력을 변경하지 않고 복사본 반환.
- 규칙: 차단 키는 대소문자·`_`·`-` 무시 비교 후 값을 `"***"`로, 재귀(중첩 객체·배열). 문자열 상한 초과는 앞부분 + `…(+N자)`. 깊이 초과 `"[깊이 초과]"`, 배열은 앞 N개만. 순환 참조 `"[순환]"`. `Buffer`·업로드 파일 `"[바이너리 N바이트]"`, `Date`는 ISO, `Error`는 `{name, message}`.
- 차단 키 초안: `password`, `newPassword`, `currentPassword`, `token`, `accessToken`, `refreshToken`, `idToken`, `secret`, `authorization`, `cookie`, `set-cookie`, `phone`, `email`, `x-internal-secret`, `internalSecret`.
- 임시값: 문자열 500자, 배열 20개, 깊이 5.
- 미결 질문: (1) `email`을 차단 목록에 넣을지(추천: 넣음, 추적은 `userId`로) (2) 금융 필드는 키로 차단하지 않고 S2에서 `/money/*` 본문 제외 방식으로 다룰지 (3) 임시값 괜찮은지.

## 4. 단계별 작업 분할 (제안 — 파일명은 스케치)

| 단계 | 내용 | 건드릴 파일(제안) | 테스트 | 배포 시 주의 |
|---|---|---|---|---|
| S1 | **마스킹·잘라내기 순수 함수** — 민감 키 목록, 중첩 객체, 배열, 순환 참조, 길이 제한 | `src/common/logging/redact.ts` + `redact.spec.ts` | 비밀번호·토큰·phone·중첩·큰 문자열·multipart 케이스 | 없음(사용처 없음) |
| S2 | **요청 로그 인터셉터** + 요청 ID, 에러 스택 로그(`catchError`), JSON 한 줄 출력, 업로드 본문 제외 | `src/common/logging/logging.interceptor.ts`, `app.module.ts`(`APP_INTERCEPTOR`) | 성공/실패/예외/마스킹 적용 | 로그량 증가. Render 로그에서 확인 |
| S3 | **인증 경로 메타 미들웨어**(D3 결정 시) | `src/main.ts`(Better Auth 앞) | 본문을 읽지 않는지, 로그인이 여전히 되는지 수동 확인 | 로그인 영향 여부를 로컬에서 먼저 확인 |
| S4 | **Loki 전송**(D1=B 결정 시) — 환경변수가 없으면 꺼짐 | 로거 설정, `.env.example`, `render.yaml` | 전송 실패 시 요청이 영향받지 않는지 | `GRAFANA_*` 환경변수를 Render에 추가. **빌드 메모리**(최근 OOM 사례) 확인 |
| S5 | **로컬 compose**(Loki+Grafana+Alloy) 학습용 | `docker-compose.monitoring.yml`, `docs/runbooks/` | 로컬에서 로그가 보이는지 | 운영 영향 없음 |
| S6 | (선택) 메트릭 | `prom-client`, `/metrics` | — | D4 결정 시 |

원칙: 한 단계 = 한 브랜치/커밋 단위, 커밋 전 체크리스트(`pnpm test` → `pnpm run build`; e2e는 운영 DB에 닿으므로 보류).

## 5. 위험과 미확인
- **민감정보 유출**이 최대 위험. 마스킹 누락은 코드 리뷰만으로 놓치기 쉬워 S1의 테스트가 핵심 안전장치.
- **로그 유실**: Loki 푸시 실패 배치는 버려지고, Render 무료는 슬립 직전 로그가 날아갈 수 있음 → 감사용이 아니라 디버깅용.
- **한 줄 256KB(Loki)·한도 50GB**: 큰 `content` 때문에 빠르게 소진될 수 있어 잘라내기가 필수.
- **빌드 메모리**: 의존성 추가는 Render 512MB 빌드에 영향. 2026-10-23 배포가 힙 부족으로 실패한 이력이 있음(원인은 미확정).
- 미확인: Render 무료의 정확한 로그 보관 기간, pino-loki가 워커 스레드로 도는지, Alloy 최신 버전, 본문 스트림 순서 영향(실제 검증 필요).

## 6. 조사 출처 (2026-10-23, 서브에이전트 조사 — 모두 공식 확인은 아님)
- Promtail EOL: https://grafana.com/docs/loki/latest/send-data/promtail/
- Grafana Cloud 무료 한도: https://grafana.com/pricing/ · 초과 시 동작은 포럼 답변(공식 아님): https://community.grafana.com/t/what-happens-when-my-usage-exceed-the-free-plan-limitations/102795
- Loki 한도(한 줄 256KB): https://grafana.com/docs/grafana-cloud/cost-management-and-billing/understand-your-invoice/usage-limits/
- Render 로그·무료: https://render.com/docs/free · https://render.com/docs/log-streams · https://render.com/docs/logging
- pino-loki: https://github.com/Julien-R44/pino-loki
- Sentry 무료(FE 쪽 참고): https://sentry.io/pricing/
