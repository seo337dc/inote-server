# NestJS 학습 가이드 — iNote Server 기준

> NestJS + Prisma + Better Auth 조합으로 서버를 만들기 전에 읽는 문서.
> 이 프로젝트에서 실제로 쓰는 개념 위주로 정리합니다.

---

## NestJS가 Express와 다른 점

| 항목 | Express | NestJS |
|------|---------|--------|
| 구조 | 자유로움 (파일 구조 없음) | 모듈/컨트롤러/서비스로 강제 분리 |
| 언어 | JS / TS 선택 | TypeScript 기본 |
| DI (의존성 주입) | 없음 | 내장 (Angular 스타일) |
| 데코레이터 | 없음 | `@Controller`, `@Get`, `@Body` 등 |
| 학습 곡선 | 낮음 | 중간 (구조 익히면 생산성 높음) |

---

## 핵심 개념 3가지

### 1. 모듈 (Module)
기능 단위로 코드를 묶는 단위. 이 프로젝트에서는 `UsersModule`, `MoneyModule` 등이 각각 하나의 모듈.

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // 다른 모듈에서 쓰려면 exports 필요
})
export class UsersModule {}
```

### 2. 컨트롤러 (Controller)
HTTP 요청을 받는 곳. 라우팅 담당. 비즈니스 로직은 여기 넣지 않음.

```typescript
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  updateMe(@Req() req, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }
}
```

### 3. 서비스 (Service)
실제 비즈니스 로직이 들어가는 곳. DB 조회/수정도 여기서.

```typescript
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data: dto });
  }
}
```

---

## 폴더 구조 패턴

NestJS에서 모듈 하나의 표준 구조:

```
src/users/
├── users.module.ts       ← 모듈 선언
├── users.controller.ts   ← 라우팅
├── users.service.ts      ← 비즈니스 로직
└── dto/
    ├── create-user.dto.ts
    └── update-user.dto.ts
```

---

## Prisma 기본 사용법

### 설치
```bash
npm install prisma @prisma/client
npx prisma init
```

### schema.prisma 예시
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  expenses  Expense[]
  stocks    Stock[]
}

model Expense {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  amount    Int
  category  String
  memo      String?
  date      DateTime
  createdAt DateTime @default(now())
}
```

### Prisma 주요 명령어
```bash
npx prisma migrate dev --name init   # 마이그레이션 생성 + 적용
npx prisma migrate deploy            # 배포 환경에서 마이그레이션 적용
npx prisma studio                    # DB GUI 브라우저로 열기
npx prisma generate                  # client 코드 재생성
```

### PrismaService (NestJS에서 사용하는 방법)
```typescript
// src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

---

## Better Auth 개요

NestJS에서 직접 인증을 짜는 대신 Better Auth 라이브러리를 사용.

### 왜 Better Auth?
- Next.js 16 + Prisma와 공식 통합 지원
- 소셜 로그인 (Google, Kakao 등) 기본 제공
- JWT 세션 관리 내장
- next-auth보다 최신, 더 유연함

### 기본 흐름
```
클라이언트(Next.js) → Better Auth 클라이언트
         ↓
서버(NestJS) → Better Auth 서버 핸들러 → DB (Prisma)
```

### 설치
```bash
npm install better-auth
```

---

## DTO (Data Transfer Object)

API 요청/응답 데이터 형태를 정의하는 클래스.
`class-validator`로 유효성 검사도 같이 처리.

```bash
npm install class-validator class-transformer
```

```typescript
// dto/create-expense.dto.ts
import { IsInt, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateExpenseDto {
  @IsInt()
  amount: number;

  @IsString()
  category: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
```

---

## 환경변수 관리

```bash
npm install @nestjs/config
```

`.env` 파일:
```
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

`main.ts`에서 전역 설정:
```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...
  ],
})
```

---

## CORS 설정 (FE 연결 시 필수)

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: ['http://localhost:3100', 'https://inote-money.vercel.app'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  
  await app.listen(3200);
}
```

---

## 자주 쓰는 데코레이터 정리

| 데코레이터 | 위치 | 설명 |
|-----------|------|------|
| `@Module()` | 클래스 | 모듈 선언 |
| `@Controller('path')` | 클래스 | 라우터 prefix 설정 |
| `@Injectable()` | 클래스 | DI 주입 가능하게 |
| `@Get()` `@Post()` `@Patch()` `@Delete()` | 메서드 | HTTP 메서드 |
| `@Body()` | 파라미터 | req.body |
| `@Param('id')` | 파라미터 | req.params.id |
| `@Query('page')` | 파라미터 | req.query.page |
| `@Req()` | 파라미터 | 전체 request 객체 |
| `@UseGuards()` | 메서드/클래스 | 인증 가드 적용 |

---

## 개발 순서 (이 프로젝트 기준)

1. NestJS 프로젝트 초기화
2. PrismaModule 설정 + DB 연결
3. Better Auth 설치 + 소셜 로그인 연결
4. UsersModule (유저 조회/수정)
5. MoneyModule > ExpensesModule (가계부 CRUD)
6. MoneyModule > StocksModule (주식 CRUD)
7. MoneyModule > SettingsModule (내 정보 설정)
8. Railway 배포

---

## 트러블슈팅 메모

> 작업하면서 막혔던 부분을 여기에 추가합니다.

- (추후 작성)
