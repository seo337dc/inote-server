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

> 자세한 내용은 **챕터 13** 참고

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

---

## 12. NestJS Guard (인증 가드)

> ⚠️ 학습 필요 — 코드는 구현했지만 개념 학습 필요

### Guard란?

요청이 컨트롤러에 도달하기 **전에** 실행되는 문지기.
로그인 여부, 권한 여부를 여기서 검사함.

```
클라이언트 요청
    ↓
[Guard] ← 여기서 막힘 (401/403 반환)
    ↓ (통과 시)
컨트롤러
    ↓
서비스
```

### 실제 구현 코드 (inote-server)

```typescript
// src/auth/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Better Auth로 세션 검증
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    // 이후 컨트롤러에서 꺼내 쓸 수 있도록 주입
    request.user = session.user;
    return true;
  }
}
```

### 컨트롤러에 적용

```typescript
@UseGuards(AuthGuard)       // 이 컨트롤러 전체에 가드 적용
@Controller('users')
export class UsersController { ... }
```

### 핵심 개념

| 개념 | 설명 |
|------|------|
| `CanActivate` | Guard가 구현해야 하는 인터페이스 |
| `canActivate()` | `true` 반환 시 통과, `false` 또는 예외 시 차단 |
| `ExecutionContext` | 현재 요청의 컨텍스트 (HTTP, WebSocket 등) |
| `switchToHttp()` | HTTP 요청으로 전환해서 `request`, `response` 꺼냄 |

---

## 13. 커스텀 데코레이터

> ⚠️ 학습 필요 — 코드는 구현했지만 개념 학습 필요

### 커스텀 데코레이터란?

NestJS가 제공하는 `@Param()`, `@Body()` 처럼 **내가 직접 만드는 데코레이터**.
주로 요청 객체에서 특정 값을 꺼내올 때 사용.

### 실제 구현 코드 (inote-server)

```typescript
// src/auth/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Guard에서 주입한 유저 정보 반환
  },
);
```

### 사용 방법

```typescript
// Guard가 request.user에 넣어준 값을 바로 꺼내서 사용
@Get('me')
getMe(@CurrentUser() user: { id: string }) {
  return this.usersService.getMe(user.id);
}
```

### Guard와 세트로 동작하는 흐름

```
요청 도착
  → AuthGuard 실행 → session 검증 → request.user = 유저정보 주입
  → 컨트롤러 실행 → @CurrentUser()가 request.user 꺼내줌
  → 서비스에 userId 전달
```

---

## 14. DTO & class-validator

> ⚠️ 학습 필요 — 코드는 구현했지만 개념 학습 필요

### DTO란?

API 요청 데이터의 **형태와 규칙을 정의**하는 클래스.
`class-validator` 데코레이터로 유효성 검사 규칙을 붙임.

### 실제 구현 코드 (inote-server)

```typescript
// src/money/expenses/dto/create-expense.dto.ts
export class CreateExpenseDto {
  @IsInt()
  @Min(1)
  amount: number;         // 정수, 최소 1

  @IsString()
  category: string;       // 문자열

  @IsIn(['income', 'expense'])
  type: string;           // 두 값 중 하나만 허용

  @IsDateString()
  date: string;           // YYYY-MM-DD 형식

  @IsOptional()
  @IsString()
  memo?: string;          // 없어도 됨
}
```

### 주요 데코레이터

| 데코레이터 | 의미 |
|-----------|------|
| `@IsString()` | 문자열 |
| `@IsInt()` | 정수 |
| `@IsNumber()` | 숫자 (소수 포함) |
| `@IsOptional()` | 없어도 됨 (선택값) |
| `@IsIn(['a','b'])` | 지정한 값 중 하나 |
| `@IsDateString()` | 날짜 문자열 (ISO 형식) |
| `@Min(n)` / `@Max(n)` | 최솟값 / 최댓값 |
| `@IsUrl()` | URL 형식 |

### PartialType — 수정 DTO 쉽게 만들기

```typescript
// create DTO를 상속받아 모든 필드를 optional로 변환
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
// → CreateExpenseDto의 모든 필드가 자동으로 선택값이 됨
```

### ValidationPipe 전역 등록 (main.ts)

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,   // DTO에 없는 필드는 자동 제거
  transform: true,   // 타입 자동 변환 (string → number 등)
}));
```

---

## 15. Prisma upsert 패턴

> ⚠️ 학습 필요 — 코드는 구현했지만 개념 학습 필요

### upsert란?

**"없으면 생성(insert), 있으면 수정(update)"** 을 한 번에 처리하는 Prisma 메서드.
`UserSetting`처럼 유저당 1개만 존재하는 데이터에 적합.

### 실제 구현 코드 (inote-server)

```typescript
// src/money/settings/settings.service.ts
async upsert(userId: string, dto: UpsertSettingsDto) {
  return this.prisma.userSetting.upsert({
    where: { userId },        // 이 조건으로 찾고
    create: { userId, ...dto }, // 없으면 생성
    update: dto,              // 있으면 수정
  });
}
```

### 일반 create/update vs upsert 비교

```typescript
// ❌ 직접 분기 처리
const existing = await prisma.userSetting.findUnique({ where: { userId } });
if (existing) {
  await prisma.userSetting.update({ where: { userId }, data: dto });
} else {
  await prisma.userSetting.create({ data: { userId, ...dto } });
}

// ✅ upsert로 한 줄
await prisma.userSetting.upsert({
  where: { userId },
  create: { userId, ...dto },
  update: dto,
});
```

### 언제 쓰나?

- 유저당 1개만 존재하는 데이터 (설정, 프로필 등)
- "저장" 버튼 하나로 생성/수정 모두 처리할 때
- PUT 방식 API (`/settings`)에 적합

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

## 12. FE 테스트 — 실제 프로젝트에서 어떻게 쓰나?

### 테스트를 왜 하는가? (현실적인 이유)

개발하다 보면 이런 상황이 반드시 온다.

```
"가계부 필터 기능 추가했는데 기존 달력 뷰가 갑자기 안 됨"
"설정 저장 버튼 고쳤는데 다크모드가 초기화됨"
"로그인 수정했는데 로그아웃이 안 됨"
```

이걸 **배포 전에 자동으로 잡아주는 것**이 테스트의 핵심 목적.

```
테스트 없음 → 코드 수정 → 직접 클릭해서 확인 → 놓치면 사용자가 버그 발견
테스트 있음 → 코드 수정 → npm test → 어디가 깨졌는지 즉시 확인
```

---

### FE 테스트 3종류

| 종류 | 무엇을 테스트 | 도구 | 속도 |
|------|------------|------|------|
| **단위 테스트** | 함수, 훅, 유틸리티 | Jest | 빠름 |
| **컴포넌트 테스트** | UI 컴포넌트 렌더링/동작 | React Testing Library | 중간 |
| **E2E 테스트** | 실제 브라우저에서 전체 흐름 | Playwright / Cypress | 느림 |

---

### 단위 테스트 — 함수/훅 테스트

BE API 없이 **순수한 로직만** 테스트.

```typescript
// utils/formatCurrency.ts
export function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// utils/formatCurrency.test.ts
test('금액을 한국 원화 형식으로 변환한다', () => {
  expect(formatKRW(50000)).toBe('50,000원');
  expect(formatKRW(1000000)).toBe('1,000,000원');
});
```

**언제 쓰나**: 날짜 포맷, 금액 계산, 카테고리 필터 같은 순수 함수들.

---

### 컴포넌트 테스트 — React Testing Library

UI가 올바르게 렌더링되는지, 버튼 클릭 시 올바르게 동작하는지 테스트.
**실제 브라우저 없이** jsdom(가상 DOM)에서 실행.

```typescript
// ExpenseCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('지출 카드가 금액과 카테고리를 보여준다', () => {
  render(<ExpenseCard amount={5000} category="식비" />);

  expect(screen.getByText('5,000원')).toBeInTheDocument();
  expect(screen.getByText('식비')).toBeInTheDocument();
});

test('삭제 버튼 클릭 시 onDelete가 호출된다', () => {
  const onDelete = jest.fn();
  render(<ExpenseCard amount={5000} category="식비" onDelete={onDelete} />);

  fireEvent.click(screen.getByRole('button', { name: '삭제' }));

  expect(onDelete).toHaveBeenCalledTimes(1);
});
```

---

### FE에서 BE API를 어떻게 Mock하나?

**가장 많이 쓰는 방법 3가지**

#### 방법 1 — jest.mock (단순한 경우)

```typescript
// API 함수 자체를 가짜로 교체
jest.mock('@/lib/api', () => ({
  getExpenses: jest.fn().mockResolvedValue([
    { id: '1', amount: 5000, category: '식비' }
  ])
}));

test('지출 목록을 불러와서 표시한다', async () => {
  render(<ExpenseList />);
  expect(await screen.findByText('5,000원')).toBeInTheDocument();
});
```

#### 방법 2 — MSW (Mock Service Worker) ⭐ 실무에서 가장 많이 씀

API 요청 자체를 가로채서 가짜 응답을 주는 방식.
컴포넌트 코드를 건드리지 않아도 됨.

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/money/expenses', () => {
    return HttpResponse.json([
      { id: '1', amount: 5000, category: '식비', date: '2026-06-10' },
      { id: '2', amount: 12000, category: '교통', date: '2026-06-10' },
    ]);
  }),
];

// 테스트에서 사용
test('가계부 페이지에서 지출 목록이 표시된다', async () => {
  render(<AccountBookPage />);
  
  // API 응답이 올 때까지 기다림
  expect(await screen.findByText('5,000원')).toBeInTheDocument();
  expect(await screen.findByText('12,000원')).toBeInTheDocument();
});
```

#### 방법 3 — E2E에서 실제 API 사용

Playwright 같은 E2E 도구는 실제 서버를 띄우고 진짜 API와 통신.

```typescript
// e2e/account-book.spec.ts (Playwright)
test('가계부 페이지 전체 흐름', async ({ page }) => {
  await page.goto('/demo/account-book');
  await expect(page.getByText('이번 달 지출')).toBeVisible();
  
  // 지출 추가 버튼 클릭
  await page.getByRole('button', { name: '지출 추가' }).click();
  await page.getByLabel('금액').fill('5000');
  await page.getByLabel('카테고리').selectOption('식비');
  await page.getByRole('button', { name: '저장' }).click();
  
  // 추가된 항목 확인
  await expect(page.getByText('5,000원')).toBeVisible();
});
```

---

### 실제 프로젝트에서 테스트 활용 방법

#### 스타트업 / 사이드 프로젝트 (현실적인 방식)

```
핵심 유틸 함수       → 단위 테스트 (필수)
주요 컴포넌트 동작   → 컴포넌트 테스트 (중요한 것만)
E2E                 → 주요 유저 시나리오 2~3개만
```

처음부터 100% 커버리지를 목표로 하면 개발 속도가 너무 느려짐.
**"이게 망가지면 서비스가 안 된다"** 싶은 것만 먼저 테스트.

#### 대기업 / 팀 프로젝트

```
PR 올리면 → GitHub Actions에서 자동으로 테스트 실행
테스트 통과해야만 → merge 가능
커버리지 80% 이상 → 유지
```

---

### iNote Money FE 테스트 우선순위

| 우선순위 | 대상 | 이유 |
|---------|------|------|
| 🔴 높음 | `formatKRW`, `calcTotal` 같은 계산 함수 | 틀리면 금액 표시 오류 |
| 🔴 높음 | 인증 상태에 따른 라우팅 | 미로그인 시 접근 차단 |
| 🟡 중간 | 가계부 CRUD 흐름 | 핵심 기능 |
| 🟡 중간 | 다크모드 토글 | localStorage 연동 |
| 🟢 낮음 | UI 스냅샷 | 디자인 변경 잦으면 오히려 부담 |

---

### FE 테스트 도구 설치 (Next.js 기준)

```bash
# React Testing Library (컴포넌트 테스트)
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# MSW (API Mock)
npm install -D msw

# Playwright (E2E)
npm install -D @playwright/test
npx playwright install
```

---

### BE가 없을 때 개발하는 법 (현재 상황)

```
지금 inote-money는 localStorage 기반 데모
→ BE 연결 전까지는 MSW로 API Mock 만들어두기
→ BE 완성되면 MSW handler만 실제 API URL로 교체
→ 컴포넌트 코드는 건드릴 필요 없음
```

이렇게 하면 BE 없이도 FE를 완성하고,
BE 연결 시에는 Mock만 제거하면 됨.

---

## 13. Better Auth — 인증 라이브러리 제대로 이해하기

### 인증을 직접 만들면 무슨 일이 생기나?

로그인 기능을 처음부터 직접 구현하면 해야 할 일 목록:

```
- 회원가입 시 비밀번호 암호화 (bcrypt)
- 로그인 시 비밀번호 비교
- JWT 토큰 발급 + 만료 처리
- Refresh Token 관리 (자동 로그인 유지)
- 소셜 로그인 (Google OAuth 흐름 직접 구현)
- 세션 저장소 관리
- 보안 취약점 대응 (CSRF, XSS 등)
```

→ 인증만 만드는 데 2~3주 걸림. 그리고 보안 실수 하나면 전체 서비스 위험.

**Better Auth**: 위 모든 것을 라이브러리가 대신 해줌.

---

### Better Auth vs 다른 인증 라이브러리 비교

| 라이브러리 | 특징 | 단점 |
|-----------|------|------|
| **NextAuth (Auth.js)** | Next.js 공식 추천, 가장 유명 | Next.js에 강하게 묶임, 설정 복잡 |
| **Passport.js** | Express/NestJS 전통적 방식 | 설정 많음, 오래된 패턴 |
| **Clerk** | UI까지 제공, 가장 쉬움 | 유료 (무료 한도 있음) |
| **Better Auth** | Next.js + NestJS + Prisma 공식 지원, 최신 | 상대적으로 신생 라이브러리 |

→ **이 프로젝트 선택 이유**: FE(Next.js)와 BE(NestJS) 양쪽에서 공식 지원, Prisma 어댑터 내장

---

### 소셜 로그인 전체 흐름

구글 로그인을 예시로 흐름을 이해해보자.

```
1. 사용자가 "Google로 로그인" 버튼 클릭
        ↓
2. FE → Better Auth 클라이언트 → Google 로그인 페이지로 리다이렉트
        ↓
3. 사용자가 Google 계정으로 로그인
        ↓
4. Google이 BE 서버로 "인증 코드" 전달 (callback URL)
        ↓
5. BE → Better Auth 서버 → Google에 코드 교환 → 유저 정보 받음
        ↓
6. Better Auth → Prisma로 DB에 유저 저장 (없으면 생성, 있으면 업데이트)
        ↓
7. Better Auth → JWT 세션 토큰 발급
        ↓
8. FE에 토큰 전달 → 로그인 완료
```

---

### Better Auth 구성 요소

```
Better Auth
├── 서버 사이드 (NestJS에 설치)
│   ├── 소셜 로그인 callback 처리
│   ├── JWT 발급/검증
│   └── Prisma로 유저 DB 저장
│
└── 클라이언트 사이드 (Next.js에 설치)
    ├── 로그인/로그아웃 함수 제공
    ├── 현재 세션(로그인 상태) 조회
    └── 각 소셜 로그인 버튼 연결
```

---

### 코드로 보면

**BE 설정 (NestJS)**
```typescript
// auth.config.ts
export const auth = betterAuth({
  database: prismaAdapter(prisma),      // DB 연결
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
});
```

**FE 사용 (Next.js)**
```typescript
// 로그인 버튼
await authClient.signIn.social({ provider: 'google' });

// 로그아웃
await authClient.signOut();

// 현재 로그인 유저 정보
const { data: session } = authClient.useSession();
console.log(session?.user.name); // "홍길동"
```

---

### Better Auth가 DB에 만드는 테이블

Better Auth가 자동으로 아래 테이블들을 Prisma 스키마에 추가해야 함.

| 테이블 | 역할 |
|--------|------|
| `User` | 유저 기본 정보 (email, name, avatar) |
| `Session` | 로그인 세션 (토큰, 만료시간) |
| `Account` | 소셜 계정 연결 정보 (Google 계정 ID 등) |
| `Verification` | 이메일 인증 토큰 |

→ 기존에 만든 `User` 모델과 통합하거나 Better Auth 스키마에 맞춰 조정 필요.

---

### Google OAuth 설정 방법 (사전 준비)

소셜 로그인을 쓰려면 Google에 앱 등록이 필요함.

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성
3. **API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기**
4. 승인된 리다이렉션 URI 추가:
   ```
   http://localhost:3200/api/auth/callback/google   ← 개발용
   https://your-domain.railway.app/api/auth/callback/google  ← 배포용
   ```
5. **클라이언트 ID**, **클라이언트 보안 비밀** 복사 → `.env`에 저장

---

### NextAuth vs Better Auth — 이 프로젝트에서 왜 Better Auth인가?

처음에 NextAuth(Auth.js)와 Better Auth 중 고민했음. 결론부터 말하면 **이 프로젝트 구조에는 Better Auth가 맞음.**

#### NextAuth의 설계 의도

NextAuth는 원래 이런 구조를 가정하고 만들어진 라이브러리:

```
Next.js 서버 = 인증 서버 = API 서버 (하나의 서버)
```

FE와 BE가 같은 서버에 있는 풀스택 Next.js 앱에 최적화되어 있음.

#### 이 프로젝트 구조

```
FE (AWS Amplify)  ←→  BE (Railway)
   Next.js                NestJS
   포트 3100              포트 3200
   (별개 서버)            (별개 서버)
```

FE와 BE가 완전히 분리된 구조. 이 경우 NextAuth를 쓰면:
- FE에서 NextAuth로 소셜 로그인 처리
- BE는 NextAuth를 모르기 때문에 → 세션 검증 코드 직접 작성
- FE 세션과 BE 토큰을 연결하는 로직 따로 설계
- **추가 작업 2~3일 더 발생**

#### Better Auth는 이 구조를 기본 지원

```
FE: Better Auth 클라이언트 설치 → 로그인 UI + 세션 관리
BE: Better Auth 서버 설치 → 토큰 발급/검증 + DB 저장
→ 같은 라이브러리가 양쪽에서 통신 → 추가 작업 없음
```

#### 비교 요약

| | NextAuth (Auth.js v5) | Better Auth |
|---|---|---|
| 설계 의도 | Next.js 풀스택 (FE=BE 같은 서버) | FE + 별도 BE 분리 구조 지원 |
| NestJS 공식 지원 | ❌ 없음 | ✅ 공식 어댑터 |
| Prisma 연동 | 별도 설정 필요 | ✅ 어댑터 내장 |
| FE/BE 분리 구조 | 추가 작업 필요 | 기본 지원 |
| 커뮤니티 크기 | 매우 큼 | 작음 (신생) |

→ **결론**: NextAuth는 커뮤니티가 크지만 이 프로젝트 구조와 맞지 않음. Better Auth 선택.

---

### 정리

| 항목 | 내용 |
|------|------|
| Better Auth란 | 인증 전체(소셜 로그인, JWT, 세션)를 대신 처리해주는 라이브러리 |
| 왜 쓰나 | 직접 구현 시 2~3주 걸리고 보안 위험, 라이브러리가 이미 검증됨 |
| NextAuth 대신 쓰는 이유 | FE/BE 분리 구조 공식 지원, NestJS 어댑터 내장 |
| 어디에 설치 | FE(Next.js) + BE(NestJS) 양쪽 모두 |
| DB 연결 | Prisma 어댑터로 자동 연결 |
| 지원 소셜 | Google, GitHub, Kakao, Apple 등 |

---

---

## Chapter 14 — Google OAuth 2.0

### OAuth 2.0이란?

OAuth 2.0은 **인증(Authentication)이 아니라 인가(Authorization) 프로토콜**이다.
"내 구글 계정 정보를 이 앱이 대신 읽어도 됩니다"라고 **권한을 위임**하는 표준 방식.

> "로그인"이 아니라 "접근 권한 빌려주기"가 핵심 개념.

### 왜 쓰나?

직접 구글 로그인을 구현하려면:
- 구글 계정 검증 서버 직접 구축
- 비밀번호 해시, 토큰 발급, 만료 처리 등 보안 로직 전부 직접 구현

OAuth 2.0을 쓰면:
- 구글이 인증을 대신 처리
- 우리 서버는 "이 사람이 구글 계정 소유자"임을 보장받기만 하면 됨
- 비밀번호를 직접 다루지 않아도 됨 → 보안 위험 감소

### 동작 흐름 (Authorization Code Flow)

```
1. 사용자 → 우리 앱 "구글로 로그인" 버튼 클릭
2. 우리 앱 → 구글 인증 서버로 리다이렉트
   (Client ID, Redirect URI, Scope 포함)
3. 사용자 → 구글에서 계정 선택 + 권한 승인
4. 구글 → Redirect URI로 Authorization Code 전달
   (우리 서버의 콜백 URL: /api/v1/auth/callback/google)
5. 우리 서버 → 구글에 Authorization Code + Client Secret 교환 요청
6. 구글 → Access Token + ID Token 응답
7. 우리 서버 → ID Token에서 사용자 정보(이메일, 이름) 추출
8. 우리 서버 → DB에 유저 저장/조회 + 세션 생성
9. 사용자 → 로그인 완료, FE로 리다이렉트
```

### 주요 용어

| 용어 | 설명 |
|------|------|
| Client ID | 구글에 등록한 우리 앱의 식별자 (공개 가능) |
| Client Secret | 구글과 우리 서버만 아는 비밀 키 (절대 공개 금지) |
| Redirect URI | 인증 완료 후 구글이 code를 전달할 우리 서버 URL |
| Authorization Code | 한 번만 쓸 수 있는 단기 코드 (Access Token으로 교환용) |
| Access Token | 구글 API를 호출할 수 있는 토큰 |
| ID Token | 사용자 신원 정보가 담긴 JWT (이메일, 이름 등) |
| Scope | 요청하는 권한 범위 (예: `openid email profile`) |

### 이 프로젝트에서의 설정

```
Google Cloud Console
├── OAuth 2.0 클라이언트 생성
├── 승인된 Redirect URI 등록
│   ├── http://localhost:3200/api/v1/auth/callback/google  (로컬)
│   └── https://inote-server.railway.app/api/v1/auth/callback/google  (운영)
└── Client ID + Client Secret → .env에 저장
```

---

## Chapter 15 — JWT vs DB 세션 (Better Auth 세션 방식)

### 두 가지 세션 방식

#### JWT (JSON Web Token)

```
로그인 성공 → 서버가 JWT 발급 → 클라이언트에 저장
이후 요청 → JWT를 헤더에 포함 → 서버가 서명 검증
```

- **서버에 저장 없음** — stateless
- 토큰 자체에 사용자 정보 포함
- 만료 전까지 강제 로그아웃 불가 (취소가 어려움)
- 주로 모바일 앱, 마이크로서비스 구조에 적합

#### DB 세션

```
로그인 성공 → 서버가 세션 생성 → DB에 저장 → 세션 ID를 쿠키로 전달
이후 요청 → 쿠키의 세션 ID → DB에서 세션 조회
```

- **서버(DB)에 저장** — stateful
- 세션 ID만 클라이언트에 존재, 실제 정보는 DB에
- 강제 로그아웃 가능 (DB에서 세션 삭제)
- 주로 웹 서비스에 적합

### Better Auth의 선택: DB 세션 기본

Better Auth는 **DB 세션 방식을 기본**으로 사용한다.

이유:
- 세션 취소/만료 관리가 쉬움
- 보안 사고 시 즉시 로그아웃 가능
- 웹 서비스에서 더 일반적인 방식

Prisma 스키마의 `session` 테이블이 이 세션들을 저장한다.

### JWT가 필요한 경우

| 상황 | 이유 |
|------|------|
| React Native 앱 | 쿠키 기반 세션 관리 어려움 |
| 마이크로서비스 | 서비스 간 인증 시 DB 조회 없이 토큰 검증 |
| 서드파티 API 제공 | 외부 클라이언트에게 토큰 발급 |

→ 이 프로젝트는 현재 웹 위주이므로 **DB 세션 그대로 사용**.
모바일 앱 지원 시 Better Auth의 JWT 플러그인 추가 검토.

### 정리

| 항목 | JWT | DB 세션 |
|------|-----|---------|
| 저장 위치 | 클라이언트 | 서버(DB) |
| Stateless | ✅ | ❌ |
| 강제 로그아웃 | 어려움 | 쉬움 |
| 서버 부하 | 낮음 | DB 조회 발생 |
| 적합한 환경 | 모바일, MSA | 웹 서비스 |
| Better Auth 기본 | ❌ | ✅ |

---

## Chapter 24 — Render 배포

> ⚠️ 학습 필요 — 배포는 완료했지만 개념 학습 필요

### Render란?

GitHub 레포를 연결하면 자동으로 빌드·배포해주는 PaaS(Platform as a Service).
무료 플랜: 512MB RAM, 0.1 CPU, 15분 비활성 시 슬립.

### 배포 흐름

```
git push → Render가 감지
  → Build Command 실행 (npm install, prisma generate, nest build)
  → Start Command 실행 (prisma migrate deploy, node dist/main)
  → Health Check 통과 → Live
```

### render.yaml — 배포 설정 파일

```yaml
services:
  - type: web
    name: inote-server
    runtime: node
    plan: free
    buildCommand: npm install --include=dev && npx prisma generate && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /api/v1/health
```

### Build vs Start 단계 차이

| 단계 | 실행 내용 | 특징 |
|------|----------|------|
| Build | npm install, prisma generate, nest build | 빌드 산출물 생성 |
| Start | prisma migrate deploy, node dist/main | 앱 실행 |

### 트러블슈팅 기록 (2026-06-23)

**1. `nest: not found`**
- 원인: `NODE_ENV=production` 환경에서 `npm install`은 devDependencies 스킵
- `@nestjs/cli`가 devDependencies에 있어서 `nest` 명령어 없음
- 해결: `npm install --include=dev`

**2. `dist/main not found`**
- 원인: `prisma.config.ts`가 프로젝트 루트에 있어서 TypeScript의 rootDir이 자동으로 `.`으로 추론됨
- 결과: `src/main.ts` → `dist/src/main.js` (예상: `dist/main.js`)
- 해결: `tsconfig.json`에 `"rootDir": "src"` 추가 + `tsconfig.build.json`에 `prisma.config.ts` exclude

**3. OOM (heap out of memory)**
- 원인: Build Command + Start Command 양쪽에서 `nest build` 실행 → 512MB 부족
- 해결: Start Command에서 빌드 제거, Build Command에서만 빌드

### TypeScript rootDir 이해

```
rootDir 미설정 상태에서 prisma.config.ts가 루트에 있으면:
  rootDir = "." (프로젝트 루트)
  src/main.ts → dist/src/main.js  ← 잘못된 경로

rootDir = "src" 설정하면:
  src/main.ts → dist/main.js  ← 올바른 경로
```

---

## 참고 자료

| 주제 | 링크 |
|------|------|
| NestJS 공식 문서 | https://docs.nestjs.com |
| NestJS 테스트 가이드 | https://docs.nestjs.com/fundamentals/testing |
| Prisma 공식 문서 | https://www.prisma.io/docs |
| Better Auth 공식 문서 | https://www.better-auth.com |
| Better Auth NestJS 가이드 | https://www.better-auth.com/docs/integrations/nestjs |
| TypeScript 핸드북 | https://www.typescriptlang.org/docs/handbook |
| Jest 공식 문서 | https://jestjs.io/docs/getting-started |
| React Testing Library | https://testing-library.com/docs/react-testing-library/intro |
| MSW 공식 문서 | https://mswjs.io/docs |
| Playwright 공식 문서 | https://playwright.dev/docs/intro |
