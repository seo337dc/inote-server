# 테스트 학습 가이드 — iNote Server 기준

> API를 어떻게 테스트하는지 정리한 문서.
> Jest, supertest는 NestJS 생성 시 이미 세팅되어 있지만, 실제 서비스 코드에 대한 테스트는 아직 없음(2026-08-07 기준).
> **금융 지식(용어/도서) CRUD를 만들면서 이 문서 순서대로 하나씩 직접 작성해보는 게 목표.**

---

## 테스트를 3단계로 나눠서 생각하기

| 단계 | 방법 | 언제 쓰나 | DB 연결 |
|------|------|-----------|---------|
| 1. 수동 테스트 | Swagger UI, curl | 개발 중 눈으로 빠르게 확인 | 실제 DB |
| 2. 단위 테스트 (Unit) | Jest + mock | 서비스 로직(계산·필터·검증)만 격리해서 검증 | ❌ 가짜(mock) |
| 3. E2E 테스트 | Jest + supertest | 실제 HTTP 요청으로 API 전체 흐름 검증 | ✅ 실제 DB (Neon dev 브랜치) |

이 프로젝트 컨벤션(CLAUDE.md 기준): 단위 테스트는 서비스 파일 옆에, E2E는 `test/` 폴더에.

```
src/money/expenses/
├── expenses.service.ts
├── expenses.service.spec.ts   ← 단위 테스트
└── expenses.controller.ts

test/
└── expenses.e2e-spec.ts       ← E2E 테스트
```

---

## 1단계 — 수동 테스트

### Swagger UI
- 로컬: `http://localhost:3200/api/docs`
- 각 엔드포인트에서 "Try it out" → 요청 값 입력 → 바로 실행 결과 확인
- 이 프로젝트는 쿠키 기반 인증이라, 브라우저에서 로그인한 상태로 Swagger를 열면 쿠키가 자동으로 붙어서 인증 필요한 API도 바로 테스트 가능

### curl
```bash
curl -s http://localhost:3200/api/v1/health
curl -s http://localhost:3200/api/v1/money/mini-game/results
```

이 단계는 "테스트 코드"는 아니고, 개발하면서 즉시 눈으로 확인하는 용도.

---

## 2단계 — 단위 테스트 (Jest)

### 핵심 개념
`PrismaService`를 진짜 DB 대신 **가짜 객체(mock)**로 바꿔치기해서, 서비스 클래스 안의 로직만 검증한다. DB가 실제로 어떻게 동작하는지가 아니라, **"이 함수가 Prisma를 올바른 인자로 호출했는가", "반환값을 올바르게 가공했는가"**를 확인하는 것.

### 예시 — `StocksService` 기준
```ts
// src/money/stocks/stocks.service.spec.ts
import { Test } from '@nestjs/testing';
import { StocksService } from './stocks.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StocksService', () => {
  let service: StocksService;
  const mockPrisma = {
    stockHolding: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StocksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(StocksService);
  });

  it('findAll은 해당 유저의 종목만 조회한다', async () => {
    mockPrisma.stockHolding.findMany.mockResolvedValue([{ id: '1' }]);
    const result = await service.findAll('user-1');

    expect(mockPrisma.stockHolding.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([{ id: '1' }]);
  });
});
```

### 체크리스트 — 어떤 걸 테스트해야 하나
- [ ] 정상 케이스: 올바른 입력 → 올바른 Prisma 호출 + 올바른 반환값
- [ ] 권한 체크: 본인 데이터가 아니면 `ForbiddenException`
- [ ] 존재하지 않는 리소스: `NotFoundException`
- [ ] 계산 로직이 있다면(예: 합계, 낭비 비율 등) 값이 정확한지

### 실행
```bash
npm run test                          # 전체 단위 테스트
npm run test -- stocks.service        # 특정 파일만
npm run test:watch                    # 저장할 때마다 자동 재실행
```

---

## 3단계 — E2E 테스트 (supertest)

### 핵심 개념
앱을 통째로 띄워서, 진짜 HTTP 요청을 라우트에 보낸다. DB도 실제로 씀(Neon dev 브랜치). "이 API가 실제로 200을 주는가", "인증 없이 호출하면 401이 뜨는가" 같은 걸 검증.

### 예시 — 인증 없는 라우트
```ts
// test/health.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /api/v1/health → 200', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  afterAll(() => app.close());
});
```

### 인증이 필요한 라우트는?
쿠키를 실제로 발급받아서 `.set('Cookie', ...)`로 붙여야 함 — 이건 조금 더 복잡해서, 처음엔 **"인증 없이 호출하면 401이 뜨는지"**부터 검증하고, 로그인 흐름까지 붙이는 건 익숙해진 다음에.

```ts
it('GET /money/stocks — 미인증 시 401', () => {
  return request(app.getHttpServer())
    .get('/api/v1/money/stocks')
    .expect(401);
});
```

### 실행
```bash
npm run test:e2e
```

---

## 이번 주말 연습 계획 — 금융 지식(Term/Book) CRUD로 실전

금융 지식 기능(용어 사전 + 추천 도서, 공유 토글 구조)을 만들면서 아래 순서로 하나씩 직접 작성해보기.

- [ ] **0. 구현**: `TermsService`/`BooksService` 기본 CRUD 구현 (Claude Code와 함께)
- [ ] **1. 수동 테스트**: Swagger에서 등록 → 조회 → 검색 흘러가는지 눈으로 확인
- [ ] **2. 단위 테스트 — 정상 케이스**: `create()` 호출 시 Prisma가 올바른 데이터로 호출되는지
- [ ] **3. 단위 테스트 — 권한 체크**: 공유 안 한(비공유) 용어를 다른 유저가 조회하면 어떻게 되는지 (필터링 로직 검증)
- [ ] **4. 단위 테스트 — 삭제 권한**: 본인 등록이 아닌 항목 삭제 시도 시 `ForbiddenException`
- [ ] **5. E2E — 미인증 401**: 로그인 없이 등록 API 호출 시 401
- [ ] **6. E2E — 정상 흐름**: (로그인 붙이는 법 익힌 후) 등록 → 목록 조회 → 삭제까지 실제 HTTP로

막히는 부분 생기면 그 지점부터 Claude Code한테 다시 물어보면 됨 — 처음부터 다 이해하고 시작할 필요 없음.

---

## 참고

- Jest 공식 문서: https://jestjs.io/docs/getting-started
- NestJS 테스트 공식 가이드: https://docs.nestjs.com/fundamentals/testing
- 이 프로젝트 테스트 전략 원본: `CLAUDE.md` → "테스트 전략" 섹션
