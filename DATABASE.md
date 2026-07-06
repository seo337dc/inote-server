# iNote Server — DB 문서

> ORM: Prisma  
> DB: Neon PostgreSQL  
> 스키마 파일: `prisma/schema.prisma`

---

## 테이블 목록

| 테이블 | 용도 |
|--------|------|
| `user` | 유저 계정 (Better Auth 관리) |
| `session` | 로그인 세션 (Better Auth 관리) |
| `account` | OAuth 계정 연결 (Better Auth 관리) |
| `verification` | 이메일 인증 토큰 (Better Auth 관리) |
| `UserSetting` | 내 자산 설정 (월급·저축·고정지출 등) |
| `SettingHistory` | 자산 설정 히스토리 스냅샷 |
| `Expense` | 가계부 지출 항목 |
| `StockHolding` | 주식 보유 종목 |
| `Review` | 주간/월간 리뷰 (예정) |

---

## 테이블 상세

### user

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `String` (cuid) | PK |
| `name` | `String` | 이름 (Google 프로필) |
| `nickname` | `String?` | 닉네임 (v2 예정) |
| `email` | `String` (unique) | 이메일 |
| `emailVerified` | `Boolean` | 이메일 인증 여부 |
| `phone` | `String?` | 핸드폰 (v2 예정) |
| `phoneVerified` | `Boolean` | 핸드폰 인증 여부 |
| `image` | `String?` | 프로필 이미지 URL |
| `createdAt` | `DateTime` | 생성일 |
| `updatedAt` | `DateTime` | 수정일 |

---

### UserSetting

유저당 1개. `userId` unique. 없으면 404 → FE에서 첫 설정으로 처리.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `String` (cuid) | | PK |
| `userId` | `String` (unique) | | FK → user |
| `salary` | `Int` | `0` | 월 수입 (원) |
| `salaryDate` | `Int` | `25` | 급여일 (1~31) |
| `dailyLimit` | `Int` | `0` | 일일 지출 한도 (원) |
| `monthlySavingGoal` | `Int` | `0` | 월 저축 목표 (원) |
| `assetUpdateDate` | `Int` | `1` | 자산 업데이트일 (1~31) |
| `savings` | `Json` | `[]` | 적금 목록 `[{ id, name, amount, day? }]` |
| `fixedExpenses` | `Json` | `[]` | 고정지출 목록 `[{ id, name, amount, day? }]` |
| `memo` | `String?` | | 메모 |
| `createdAt` | `DateTime` | | 생성일 |
| `updatedAt` | `DateTime` | | 수정일 |

---

### SettingHistory

자산 설정 시점의 스냅샷. 삭제해도 UserSetting은 영향 없음.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `String` (cuid) | PK |
| `userId` | `String` | FK → user |
| `month` | `String` | `"2026-07"` 형식 |
| `title` | `String?` | 기록 제목 (선택) |
| `salary` | `Int` | 월 수입 스냅샷 |
| `salaryDate` | `Int?` | 급여일 스냅샷 |
| `dailyLimit` | `Int` | 일일 한도 스냅샷 |
| `monthlySavingGoal` | `Int` | 저축 목표 스냅샷 |
| `assetUpdateDate` | `Int?` | 자산 업데이트일 스냅샷 |
| `savings` | `Json` | 적금 목록 스냅샷 |
| `fixedExpenses` | `Json` | 고정지출 목록 스냅샷 |
| `memo` | `String?` | 메모 |
| `recordedAt` | `DateTime` | 기록 시각 (default: now) |

---

### Expense

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `String` (cuid) | PK |
| `userId` | `String` | FK → user |
| `date` | `DateTime` | 지출 날짜 |
| `amount` | `Int` | 금액 (원) |
| `description` | `String?` | 사용처/메모 |
| `category` | `Category` (enum) | 카테고리 (기본: ETC) |
| `isWaste` | `Boolean` | 낭비 여부 (기본: false) |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

**Category enum**: `FOOD` / `CAFE` / `TRANSPORT` / `SHOPPING` / `MEDICAL` / `CULTURE` / `SUBSCRIPTION` / `ETC`

---

### StockHolding

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `String` (cuid) | PK |
| `userId` | `String` | FK → user |
| `market` | `Market` (enum) | `KR` / `US` |
| `ticker` | `String?` | 종목 코드 (optional) |
| `name` | `String` | 종목명 |
| `inputMode` | `InputMode` (enum) | `QUANTITY` / `AMOUNT` |
| `quantity` | `Float?` | 보유 수량 (QUANTITY 모드) |
| `averagePrice` | `Float?` | 평균 단가 (QUANTITY 모드) |
| `investedAmount` | `Float?` | 투자 금액 (AMOUNT 모드) |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

---

### Review

주간/월간 리뷰. API 미구현 (DB 스키마만 확정).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `String` (cuid) | PK |
| `userId` | `String` | FK → user |
| `type` | `ReviewType` (enum) | `WEEKLY` / `MONTHLY` |
| `year` | `Int` | 연도 |
| `period` | `Int` | 주차(WEEKLY) 또는 월(MONTHLY) |
| `rating` | `Int` | 평점 |
| `text` | `String?` | 리뷰 내용 |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

Unique: `(userId, type, year, period)`

---

## 관계 요약

```
user ─── session (1:N, Better Auth)
user ─── account (1:N, Better Auth)
user ─── UserSetting (1:1)
user ─── SettingHistory (1:N)
user ─── Expense (1:N)
user ─── StockHolding (1:N)
user ─── Review (1:N)
```

---

## 마이그레이션 방식

- 초기 스키마: `prisma migrate dev`
- 이후 스키마 변경: `prisma db push` (drift 방지)
- Render 배포 시 Start Command에서 `prisma migrate deploy` 자동 실행

---

## DB 확인 방법

```bash
# Prisma Studio (로컬 GUI)
npx prisma studio

# Neon 콘솔
# https://console.neon.tech → 브랜치 선택 → Tables 탭
```
