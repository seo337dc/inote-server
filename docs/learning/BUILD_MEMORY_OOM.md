# 빌드 메모리 부족(OOM)과 TypeScript 빌드 — Render 무료 플랜 사례

> 2026-11-11 Render 배포 중 `JavaScript heap out of memory`로 빌드가 실패한 일을 조사한 기록.
> "무엇이 문제였고 → 어떻게 확인했고 → 무엇을 알게 됐고 → 어떻게 해결할지"를 순서대로 적는다.
> 같은 증상은 2026-10-23에도 한 번 있었다 ([`docs/adr/0002-backend-monitoring.md`](../adr/0002-backend-monitoring.md)에 "원인 미확정"으로 남아 있음 — 이 문서가 그 원인이다).

---

## 1. 무엇이 문제였나

기능(관리자 임베딩 상태 목록 API)을 추가하고 Render에 배포했더니 **빌드 단계에서** 실패했다.

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
...
Aborted (core dumped)
==> Build failed
```

로그에서 읽을 수 있는 것:
- 실패한 곳은 **서버 실행이 아니라 빌드(Build)**다. 앱이 죽은 게 아니라 배포 파이프라인이 중간에 멈춘 것.
- `395.5 (403.3) MB` — Node의 **힙 한도가 약 400MB**였고, 그 근처에서 메모리를 회수(Mark-Compact)해도 줄지 않아 터졌다.
- Render 무료 플랜은 **RAM 512MB** ([`docs/devlog/be.md`](../devlog/be.md)). Node는 컨테이너 메모리를 보고 힙 한도를 스스로 정한다.

### 용어 정리

| 용어 | 뜻 |
|------|----|
| 힙(heap) | Node(V8)가 JS 객체를 올려두는 메모리 영역. 한도를 넘으면 위 오류가 난다 |
| `--max-old-space-size=N` | 힙 상한을 N MB로 지정하는 Node 옵션. **상한일 뿐 메모리를 확보해 주지 않는다** |
| RSS | 프로세스가 실제로 차지한 물리 메모리. 힙 + Node 자체 + 네이티브 메모리 |
| Mark-Compact | V8의 가비지 컬렉션. "ineffective"는 회수해도 여유가 안 생겼다는 뜻 |

---

## 2. 처음 의심했던 것 vs 실제

| 의심 | 실제 |
|------|------|
| "빌드에서 테스트도 같이 돌려서 메모리를 많이 쓰나?" | **아니다.** Render 빌드는 `install → prisma generate → build`뿐이고 jest는 돌지 않는다. spec 파일은 `tsconfig.build.json`에서 컴파일 대상에서도 빠진다 |
| "이번에 추가한 코드가 많아서?" | 추가된 건 파일 14개·약 1,200줄이지만 대부분이 spec(빌드 제외). **제품 코드 증가분은 작다** |
| "Prisma 모델이 늘어서?" | 이번 변경에는 **스키마 변경이 없었다.** 다만 장기적으로는 모델이 늘수록 Prisma 타입도 커진다(아래 4절) |

핵심: **우리 코드가 커져서 터졌다기보다, 이미 한계에 있던 빌드가 이번 증분으로 선을 넘은 것**이다.

---

## 3. 어떻게 확인했나 (재현 방법)

### 3-1. 힙 한도를 낮춰 가며 빌드

로컬에서 `NODE_OPTIONS`로 힙 상한을 바꿔 `nest build`를 돌렸다.

```bash
NODE_OPTIONS="--max-old-space-size=400" pnpm exec nest build   # 성공
NODE_OPTIONS="--max-old-space-size=300" pnpm exec nest build   # SIGABRT (OOM)
NODE_OPTIONS="--max-old-space-size=250" pnpm exec nest build   # SIGABRT (OOM)
```

→ 이 빌드는 **힙 300MB 초과 ~ 400MB 이하**가 필요하다. Render의 한도(~400MB)와 겹친다.
최대 RSS는 `/usr/bin/time -l pnpm exec nest build`로 쟀을 때 약 557MB (로컬 값이라 Render와 직접 비교는 못 한다).

> 로컬 Mac은 기본 힙 한도가 훨씬 커서(수 GB) 같은 코드가 아무 문제 없이 빌드된다.
> **"내 PC에서는 되는데 배포 환경에서만 실패"하는 전형적인 사례.**

### 3-2. `tsc --extendedDiagnostics`로 무엇이 메모리를 쓰는지 보기

```bash
pnpm exec tsc -p tsconfig.build.json --noEmit --incremental false --extendedDiagnostics
```

결과(발췌):

| 항목 | 값 |
|------|----|
| Files | 2,451개 |
| Lines of TypeScript (우리 코드) | **6,570줄** |
| Lines of Definitions (`.d.ts`, 라이브러리 타입) | **261,849줄** (우리 코드의 약 40배) |
| Types / Instantiations | 40,051 / 128,987 |
| **Memory used** | **약 379MB** |
| Total time | 5.74초 |

→ **타입 체크 메모리 379MB가 Render 힙 한도(~400MB)에 거의 붙어 있다.**

### 3-3. 어떤 패키지가 큰가 (정의 파일 줄 수)

`tsc --listFiles`로 읽힌 파일을 패키지별로 줄 수를 합산했다.

| 줄 수 | 패키지 | 메모 |
|---|---|---|
| 55.6k | `@types/node` | 불가피 |
| 52.7k | `typescript` lib | 불가피 |
| 46.0k | `@prisma/client` | 모델·쿼리 타입. **모델이 늘수록 커진다** |
| 42.1k | `@aws-sdk/client-s3` | 이미지 업로드용. 쓰는 기능에 비해 큼 |
| 24.3k | `kysely` | 우리가 직접 import하진 않음. better-auth 쪽에서 끌려오는 것으로 **추정**(미확인) |
| 22.9k + 10.8k | `better-auth` + core | 인증 |
| **6.5k** | **우리 `src`** | 전체의 약 2% |

> 주의: 위 표는 **줄 수**이지 메모리 측정값이 아니다. 줄 수가 많다고 메모리가 정확히 비례하는 건 아니다(타입 복잡도·인스턴스화 횟수도 영향). "어디가 큰 덩어리인가"를 보는 대략적 지표로만 쓴다.

---

## 4. 알게 된 것

1. **TypeScript 타입 체크는 라이브러리 타입을 전부 메모리에 올린다.** 우리 코드가 6.5k줄이든 65k줄이든 고정 비용(`@types/node`, TS lib, Prisma, AWS SDK, better-auth)이 이미 크다.
2. **빌드 메모리는 시간이 갈수록 올라간다.** 기능이 늘면 모델·서비스·DTO·의존성이 늘고, Prisma 생성 타입도 같이 커진다. 그래서 한 번 고쳐도 또 걸릴 수 있다.
3. **`nest build`(= `tsc`)는 "타입 검사 + JS 변환"을 한 번에 한다.** 배포에 꼭 필요한 건 JS 변환뿐이고, 타입 검사는 배포 서버가 아니라 **개발 중에 하면 되는 일**이다.
4. 힙 한도를 올리는 건 **상한만 올리는 것**이다. 물리 메모리 512MB는 그대로라서, 힙 + 네이티브 합계가 넘으면 OOM 에러 대신 컨테이너가 강제 종료될 수 있다.

---

## 5. 해결 선택지

| 방법 | 내용 | 장점 | 한계 |
|---|---|---|---|
| A. 힙 상한 올리기 | `render.yaml` buildCommand에 `NODE_OPTIONS=--max-old-space-size=460` 추가 (Render 빌드에만 적용, 로컬은 그대로) | 한 줄, 즉시 | 물리 한계는 그대로. 코드가 늘면 또 걸릴 수 있음 |
| **B. SWC 빌드 (선택)** | `nest-cli.json`에 `"builder": "swc"`. 타입 분석 없이 문법만 변환 | 빌드 메모리 대폭 감소. `@swc/core`가 이미 devDependency에 있음 | Render 빌드에서 **타입 체크가 사라진다** → 로컬/CI에서 별도로 보장해야 함 |
| C. 유료 플랜 | 메모리가 더 큰 플랜 | 코드 변경 없음 | 비용. 지금 구조엔 과함 |

### 선택: B (SWC)

이유: 의존성 타입이 고정 비용으로 이미 한계라서 A는 임시방편이다. 기능이 계속 늘 프로젝트라면 "배포 빌드에서 타입 분석을 아예 없애는" 쪽이 오래 간다.

### SWC로 바꿀 때 지켜야 할 것

1. **타입 체크는 사라지는 게 아니라 옮겨 가는 것이다.** 커밋 전 체크리스트에 `pnpm exec tsc --noEmit -p tsconfig.build.json`(또는 `lint` + 이 명령)을 넣어서 **로컬에서** 타입 오류를 잡는다. 이걸 빼면 타입 오류가 있는 코드가 그대로 배포된다.
2. **데코레이터 메타데이터 확인.** NestJS는 `emitDecoratorMetadata`로 DI 정보를 얻는다. SWC에서 이 설정이 제대로 나가는지(앱이 부팅되고 주입이 되는지) 확인해야 한다.
3. **`incremental` / `tsBuildInfoFile` 설정 영향 확인.** SWC 빌더에서는 tsconfig의 일부 설정이 무시될 수 있다.
4. **검증 방법:** 낮은 힙 한도(예: `--max-old-space-size=250`)로 빌드가 통과하는지 확인한다. 기존 한도에서 실패하던 걸 통과시키는 것이 성공 기준이다.
5. **로컬에서 `pnpm build` 결과로 서버를 실제로 띄워** 헬스체크(`/api/v1/health`)와 주요 API가 동작하는지 본다.

---

## 6. 더 공부할 것 (학습 과제)

- [ ] V8 힙 구조(young/old generation)와 `--max-old-space-size`가 무엇을 제한하는지
- [ ] Node가 컨테이너 메모리를 보고 기본 힙 한도를 정하는 방식 (cgroup)
- [ ] TypeScript가 타입 체크 때 어떤 데이터를 메모리에 올리는지 (Symbols, Types, Instantiations)
- [ ] `tsc` vs SWC vs esbuild 차이 — "타입 검사"와 "코드 변환"의 분리
- [ ] `isolatedModules`가 SWC·esbuild류 도구와 왜 짝인지 (이 프로젝트 tsconfig에 이미 켜져 있음)
- [ ] 모노레포·CI에서 타입 체크를 별도 단계로 두는 일반적인 패턴
- [ ] (선택) `@aws-sdk/client-s3`를 더 작은 구성으로 쓸 수 있는지, `kysely`가 왜 올라오는지

## 7. 참고

- 이 사례의 재현 명령은 3절에 그대로 있다 — 한도를 바꿔 가며 직접 돌려 보면 감이 온다.
- 관련 이전 기록: [`docs/devlog/be.md`](../devlog/be.md)의 Render 첫 배포 OOM(Start Command에 빌드가 중복 포함되어 있던 별개 원인), [`docs/learning/LEARNING.md`](./LEARNING.md)의 "OOM" 항목.

---

## 8. 적용 결과 (2026-11-11, 브랜치 `fix/render-build-swc`)

### 바꾼 것
- `nest-cli.json`: `builder: swc`, `typeCheck: false`, `swcrcPath: .swcrc.build`, `stripLeadingPaths: true`
- `.swcrc.build` 신규 — **빌드 전용** SWC 설정(`module: commonjs`, 데코레이터·메타데이터 켬, `*.spec.ts` 제외). 기존 `.swcrc`는 E2E(jest, ESM)용이라 그대로 둔다.
- `@swc/cli` devDependency 추가 — Nest의 SWC 빌더가 `@swc/core`와 함께 요구한다(없으면 "Failed to load @swc/cli" 오류).
- `package.json`: `typecheck` 스크립트(`tsc -p tsconfig.build.json --noEmit`) 추가
- `CLAUDE.md` 커밋 전 체크리스트: 빌드 항목을 "타입 체크 + 빌드"로 변경

### 측정 결과 (같은 코드, 로컬)
| | tsc (`nest build`) | SWC |
|---|---|---|
| 통과하는 최소 힙 | 300MB 초과 ~ 400MB | **100MB에서도 통과** (더 낮게는 시도 안 함) |
| 최대 RSS | 약 557MB | 약 209MB |
| 시간 | 약 11~13초 | 약 0.3초(컴파일 부분) |

### 겪은 함정 (학습 포인트)
1. **`@swc/cli` 없음** — `@swc/core`만으로는 Nest SWC 빌더가 안 돈다.
2. **출력이 `dist/src/`로 나옴** — `start:prod`는 `node dist/main`이라 깨진다. `stripLeadingPaths: true`로 해결.
3. **spec 파일이 dist에 컴파일됨** — SWC 빌더는 `tsconfig.build.json`의 `exclude`를 보지 않는다. `.swcrc.build`의 `exclude`로 막았다.
4. **ESM/CJS** — 기존 `.swcrc`는 `module: es6`(E2E용)이라 그대로 쓰면 `node dist/main`이 실패한다. 빌드용을 따로 둔 이유.
5. **타입 체크가 빌드에서 빠진다** — `pnpm typecheck`를 커밋 전에 꼭 돌린다. 스키마가 바뀐 뒤엔 `prisma generate`가 먼저다(안 하면 `Memo.title` 같은 오래된 타입 오류가 난다 — 이번에 실제로 겪음).

### 검증한 것 / 안 한 것
- [x] 힙 100MB로 빌드 성공, `dist/main.js` 생성, spec 0개
- [x] 빌드 결과(`node dist/main`)를 **개발 DB**로 부팅 → `/api/v1/health` `ok`, `/api/v1/blog/posts` 응답 (Nest DI·데코레이터 메타데이터 정상)
- [x] `pnpm typecheck` 통과, `pnpm test` 35개 스위트 통과
- [ ] **Render 실제 배포 성공 여부** — push 후 확인해서 여기에 적는다
- [ ] `pnpm test:e2e` — 이번 변경에서 돌리지 않았다
- 린트 28건(오류 23)은 변경 전 `origin/main`에서도 똑같이 나오는 기존 문제다
