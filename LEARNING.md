# 백엔드 기초 학습 문서

> Node.js → NestJS → Prisma 순서로 개념을 쌓아가는 문서입니다.
> 코드보다 **"왜, 무엇인지"** 위주로 설명합니다.

---

## 1. 서버가 뭔가?

### 클라이언트 - 서버 구조

```
사용자 (브라우저/앱)
       ↓ 요청 (Request)
     서버
       ↓ 응답 (Response)
사용자 (브라우저/앱)
```

- **클라이언트**: 요청을 보내는 쪽 (Next.js, React Native, 브라우저)
- **서버**: 요청을 받아 처리하고 데이터를 돌려주는 쪽

### 서버가 하는 일

1. 클라이언트가 "내 가계부 목록 줘" 요청
2. 서버가 DB에서 데이터 조회
3. 서버가 데이터를 JSON 형태로 응답
4. 클라이언트가 받아서 화면에 표시

---

## 2. Node.js란?

### 자바스크립트는 원래 브라우저 전용이었다

브라우저에서만 실행되던 자바스크립트를 **서버(컴퓨터)에서도 실행할 수 있게** 만든 것이 Node.js.

```
Before: 자바스크립트 → 브라우저에서만 실행
After:  자바스크립트 → 브라우저 + 서버(Node.js) 둘 다 실행
```

### Node.js로 만든 가장 단순한 서버

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.write('Hello World');
  res.end();
});

server.listen(3000);
```

이게 전부. 근데 이걸로 실제 서비스를 만들면 코드가 엄청 복잡해짐.
→ 그래서 **Express**, **NestJS** 같은 프레임워크가 등장.

---

## 3. Express vs NestJS

### Express

Node.js 위에서 동작하는 가장 기본적인 프레임워크.
자유롭지만 구조가 없어서 사람마다 코드 스타일이 다 다름.

```javascript
// Express 방식
const express = require('express');
const app = express();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

### NestJS

Express 위에서 동작하되, **Angular에서 영감받은 구조**를 강제함.
- 모듈 / 컨트롤러 / 서비스로 역할 분리
- TypeScript 기본 지원
- 데코레이터(`@`) 문법 사용

```typescript
// NestJS 방식
@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return [];
  }
}
```

### 언제 뭘 쓰나?

| 상황 | 선택 |
|------|------|
| 빠르게 프로토타입 | Express |
| 팀 프로젝트, 규모 있는 서비스 | NestJS |
| TypeScript + 구조화된 코드 | NestJS |

→ iNote Server는 여러 서비스(money, daily, goal)를 통합하므로 **NestJS 선택**.

---

## 4. NestJS 핵심 개념

### 4-1. 모듈 (Module)

기능 단위로 코드를 **묶는 상자**.

```
AppModule (루트)
├── PrismaModule    ← DB 연결 담당
├── UsersModule     ← 유저 기능 담당
└── MoneyModule     ← 가계부/주식 담당
    ├── ExpensesModule
    └── StocksModule
```

각 모듈은 자기 컨트롤러, 서비스를 가짐.
다른 모듈의 서비스를 쓰려면 `exports` / `imports` 로 공유.

### 4-2. 컨트롤러 (Controller)

**HTTP 요청을 받는 창구**. 라우팅 담당.
비즈니스 로직은 여기 없고, 서비스에 위임만 함.

```
GET /api/v1/expenses   → ExpensesController.findAll()
POST /api/v1/expenses  → ExpensesController.create()
```

### 4-3. 서비스 (Service)

**실제 비즈니스 로직**이 있는 곳.
DB 조회, 계산, 가공 등을 여기서 처리.

```
컨트롤러: "가계부 목록 달라는 요청 왔어"
   ↓
서비스: "DB에서 이 유저의 이번 달 지출 가져오고, 합계 계산해서 돌려줄게"
   ↓
컨트롤러: "결과 응답으로 보낼게"
```

### 4-4. 의존성 주입 (DI, Dependency Injection)

NestJS의 핵심 개념. 쉽게 말하면 **"필요한 것을 직접 만들지 말고 받아써라"**.

```typescript
// 직접 만드는 방식 (DI 없음)
class UsersService {
  private db = new PrismaClient(); // 직접 생성
}

// DI 방식 (NestJS)
class UsersService {
  constructor(private prisma: PrismaService) {} // 주입받음
}
```

NestJS가 알아서 `PrismaService` 인스턴스를 만들어서 넘겨줌.
→ 테스트하기 쉽고, 코드 재사용이 쉬워짐.

### 4-5. 데코레이터 (@)

TypeScript/자바스크립트의 문법. 클래스나 메서드에 **메타데이터(부가 정보)를 붙이는** 것.

```typescript
@Controller('users')   ← "이 클래스는 /users 라우터야"
export class UsersController {

  @Get(':id')          ← "이 메서드는 GET /users/:id 를 처리해"
  findOne(@Param('id') id: string) {
    //         ↑ "이 파라미터는 URL의 :id야"
  }
}
```

---

## 5. HTTP 기초

### HTTP 메서드

| 메서드 | 의미 | 예시 |
|--------|------|------|
| `GET` | 데이터 조회 | 가계부 목록 가져오기 |
| `POST` | 데이터 생성 | 새 지출 추가 |
| `PATCH` | 데이터 일부 수정 | 지출 금액만 수정 |
| `PUT` | 데이터 전체 교체 | 설정 전체 저장 |
| `DELETE` | 데이터 삭제 | 지출 삭제 |

### HTTP 상태 코드

| 코드 | 의미 | 상황 |
|------|------|------|
| `200` | OK | 성공 |
| `201` | Created | 생성 성공 |
| `400` | Bad Request | 요청 데이터 잘못됨 |
| `401` | Unauthorized | 로그인 안 됨 |
| `403` | Forbidden | 권한 없음 |
| `404` | Not Found | 데이터 없음 |
| `500` | Server Error | 서버 오류 |

### REST API란?

URL로 **자원(Resource)** 을 표현하고, HTTP 메서드로 **행위** 를 표현하는 설계 방식.

```
GET    /expenses       → 지출 목록 조회
POST   /expenses       → 지출 생성
PATCH  /expenses/123   → id=123 지출 수정
DELETE /expenses/123   → id=123 지출 삭제
```

---

## 6. Prisma란?

### ORM이 뭔가?

**ORM (Object-Relational Mapping)**: 코드(객체)와 DB(테이블)를 연결해주는 도구.

ORM 없이 DB 쓰는 방식 (SQL 직접):
```javascript
const result = await db.query(
  'SELECT * FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2',
  [userId, month]
);
```

Prisma 사용 방식:
```typescript
const result = await prisma.expense.findMany({
  where: {
    userId,
    date: { gte: startOfMonth, lte: endOfMonth }
  }
});
```

→ SQL 대신 TypeScript 코드로 DB를 다룰 수 있고, **타입 자동완성** 지원.

### Prisma 구성요소

| 구성요소 | 역할 |
|---------|------|
| `schema.prisma` | DB 테이블 구조 정의 |
| `prisma migrate` | 스키마 변경사항을 DB에 적용 |
| `PrismaClient` | 코드에서 DB를 조작하는 객체 |
| `prisma studio` | DB 데이터를 브라우저에서 보는 GUI |

### schema.prisma 읽는 법

```prisma
model Expense {           ← DB 테이블 이름
  id        String   @id @default(cuid())   ← 기본키, 자동생성
  userId    String                          ← 외래키 (User 연결)
  user      User     @relation(...)         ← User 모델과 관계
  amount    Int                             ← 정수형 컬럼
  category  String                          ← 문자열 컬럼
  memo      String?                         ← ? = null 허용
  date      DateTime                        ← 날짜+시간 타입
  createdAt DateTime @default(now())        ← 자동으로 현재시각
  updatedAt DateTime @updatedAt             ← 수정 시 자동 갱신
}
```

### Prisma 주요 명령어

```bash
# 스키마 변경 후 → DB에 적용 (개발용)
npx prisma migrate dev --name 변경내용설명

# 배포 환경에서 마이그레이션 적용
npx prisma migrate deploy

# DB 데이터 GUI로 보기
npx prisma studio

# Prisma Client 재생성 (schema 바꿨을 때)
npx prisma generate
```

---

## 7. 환경변수 (.env)

### 왜 쓰나?

DB 비밀번호, API 키 같은 민감한 정보를 코드에 직접 쓰면 안 됨.
GitHub에 올라가면 전 세계에 공개됨.

```typescript
// 절대 하면 안 되는 것
const db = new PrismaClient({
  datasourceUrl: 'postgresql://user:비밀번호@host/db' // ❌ 코드에 직접
});

// 올바른 방법
const db = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL // ✅ 환경변수로
});
```

### .env 파일 구조

```bash
# .env (로컬에만 있고, .gitignore로 git에서 제외)
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="랜덤문자열"
PORT=3200
```

### .env.example

실제 값 없이 **어떤 환경변수가 필요한지** 알려주는 템플릿 파일.
이건 git에 올려도 됨.

```bash
# .env.example (git에 올림)
DATABASE_URL=""
BETTER_AUTH_SECRET=""
PORT=3200
```

---

## 8. 인증 기초

### JWT (JSON Web Token)

로그인 성공 시 서버가 발급하는 **디지털 출입증**.

```
로그인 → 서버가 JWT 발급 → 클라이언트가 보관
이후 요청 → Authorization: Bearer {JWT} 헤더에 담아 전송
서버가 JWT 검증 → 유효하면 처리, 아니면 401 반환
```

JWT 구조:
```
헤더.페이로드.서명
eyJhbGci... . eyJ1c2VyS... . SflKxwRJ...
(알고리즘)   (유저정보)    (위변조방지)
```

### Better Auth란?

인증 구현을 직접 하지 않고 **라이브러리에 위임**하는 것.
- 소셜 로그인 (Google, Kakao 등) 내장
- JWT 관리 자동화
- Next.js + Prisma 공식 통합 지원

---

## 9. 이 프로젝트 전체 흐름

```
[사용자]
  ↓ 로그인 (Google)
[Next.js FE] ←→ [Better Auth 클라이언트]
  ↓ API 요청 + JWT 토큰
[NestJS BE / Railway]
  ↓ JWT 검증 → 유저 확인
  ↓ 비즈니스 로직 처리
[Prisma ORM]
  ↓ SQL 자동 생성
[Neon PostgreSQL DB]
```

---

## 10. 자주 헷갈리는 것들

### interface vs type (TypeScript)

```typescript
// interface: 객체 모양 정의에 주로 사용
interface User {
  id: string;
  name: string;
}

// type: 더 유연하게 사용 가능
type Status = 'income' | 'expense';
type UserWithStatus = User & { status: Status };
```

### async/await

DB 조회 같이 시간이 걸리는 작업을 기다릴 때 사용.

```typescript
// await 없으면 결과 기다리지 않고 다음 줄로 넘어감
async findAll(userId: string) {
  const expenses = await this.prisma.expense.findMany({
    where: { userId }
  });
  return expenses; // await이 끝난 후 실행됨
}
```

### DTO (Data Transfer Object)

API 요청/응답 데이터의 **형태를 정의**하는 클래스.
유효성 검사도 함께 처리.

```typescript
export class CreateExpenseDto {
  @IsInt()
  amount: number;      // 숫자가 아니면 자동으로 400 에러

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  memo?: string;       // 선택 값
}
```

---

## 11. 테스트

### 왜 테스트가 필요한가?

기능을 추가하거나 코드를 수정할 때 **기존 기능이 망가지지 않았는지** 자동으로 확인하는 수단.

```
테스트 없을 때: 코드 수정 → 직접 API 호출해서 눈으로 확인 → 실수 발견 못하면 배포 → 장애
테스트 있을 때: 코드 수정 → npm test → 자동으로 이상 여부 확인 → 안전하게 배포
```

### 테스트 종류 3가지

| 종류 | 범위 | 속도 | 설명 |
|------|------|------|------|
| **단위 테스트 (Unit)** | 함수/클래스 1개 | 빠름 | 서비스 메서드 하나만 격리해서 테스트 |
| **통합 테스트 (Integration)** | 모듈 여러 개 | 중간 | DB 연결 포함, 실제 데이터 흐름 테스트 |
| **E2E 테스트** | 전체 앱 | 느림 | 실제 HTTP 요청 → 응답까지 전체 흐름 테스트 |

### NestJS 기본 테스트 도구

NestJS는 프로젝트 생성 시 **Jest**가 기본으로 설치되어 있음.

```bash
npm run test          # 단위 테스트 실행
npm run test:watch    # 파일 변경 시 자동 재실행
npm run test:e2e      # E2E 테스트 실행
npm run test:cov      # 테스트 커버리지 확인
```

### 단위 테스트 예시 — ExpensesService

```typescript
// expenses.service.spec.ts
describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: PrismaService,
          useValue: {
            expense: {
              findMany: jest.fn(),  // 실제 DB 대신 가짜 함수
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ExpensesService);
    prisma = module.get(PrismaService);
  });

  it('월별 지출 목록을 반환한다', async () => {
    const mockExpenses = [
      { id: '1', amount: 5000, category: '식비', date: new Date() },
    ];

    // DB 조회 결과를 가짜로 지정
    jest.spyOn(prisma.expense, 'findMany').mockResolvedValue(mockExpenses as any);

    const result = await service.findByMonth('user-1', 2026, 6);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(5000);
  });
});
```

### E2E 테스트 예시 — 실제 HTTP 요청

```typescript
// test/expenses.e2e-spec.ts
describe('Expenses (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('GET /api/v1/money/expenses → 200', () => {
    return request(app.getHttpServer())
      .get('/api/v1/money/expenses')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 핵심 Jest 문법

```typescript
describe('그룹 이름', () => {       // 테스트 묶음
  beforeEach(() => { ... });       // 각 테스트 전 실행
  afterAll(() => { ... });         // 모든 테스트 후 실행

  it('테스트 설명', () => {         // 테스트 케이스 하나
    expect(result).toBe(5000);           // 값이 일치하는지
    expect(result).toEqual({ id: '1' }); // 객체가 일치하는지
    expect(result).toHaveLength(3);      // 배열 길이
    expect(fn).toHaveBeenCalledWith(id); // 함수가 호출됐는지
  });
});
```

### Mock (가짜 객체)

단위 테스트에서 DB를 실제로 연결하지 않고 **가짜 응답을 만들어** 쓰는 것.

```typescript
// DB 없이 테스트 가능
jest.spyOn(prisma.expense, 'create').mockResolvedValue({
  id: 'fake-id',
  amount: 3000,
  ...
} as any);
```

### 이 프로젝트에서 테스트 전략

| 단계 | 테스트 |
|------|--------|
| 서비스 로직 검증 | 단위 테스트 (Jest + Mock) |
| API 엔드포인트 검증 | E2E 테스트 (supertest) |
| DB 연동 검증 | 통합 테스트 (Neon dev 브랜치 사용) |

> 처음부터 모든 테스트를 완벽하게 짤 필요는 없음.
> 핵심 서비스 로직(지출 합계 계산, 유저 권한 확인 등)부터 단위 테스트 작성 → 점진적으로 확대.

---

## 참고 자료

| 주제 | 링크 |
|------|------|
| NestJS 공식 문서 | https://docs.nestjs.com |
| NestJS 테스트 가이드 | https://docs.nestjs.com/fundamentals/testing |
| Prisma 공식 문서 | https://www.prisma.io/docs |
| Better Auth 공식 문서 | https://www.better-auth.com |
| TypeScript 핸드북 | https://www.typescriptlang.org/docs/handbook |
| Jest 공식 문서 | https://jestjs.io/docs/getting-started |
