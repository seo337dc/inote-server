# iNote Server — API 문서

> Swagger UI: `https://inote-server-5a63.onrender.com/api/docs`  
> Base URL: `https://inote-server-5a63.onrender.com/api/v1`  
> 로컬: `http://localhost:3200/api/v1`

---

## 인증

Better Auth 세션 쿠키 기반. 모든 보호 엔드포인트는 `AuthGuard` 적용.

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /auth/get-session` | 현재 세션 조회 |
| `POST /auth/sign-in/social` | Google 소셜 로그인 |
| `POST /auth/sign-out` | 로그아웃 |

> Better Auth 라우트는 `POST /api/v1/auth/**` 로 자동 등록됨.

---

## Users

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/users/me` | 내 프로필 조회 | ✅ |
| `PATCH` | `/users/me` | 이름 / 이미지 수정 | ✅ |

### PATCH /users/me body
```json
{
  "name": "홍길동",
  "image": "https://..."
}
```

---

## Money — 자산 설정

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/money/settings` | 내 자산 설정 조회 | ✅ |
| `PUT` | `/money/settings` | 내 자산 설정 저장 (upsert) | ✅ |

### PUT /money/settings body
```json
{
  "salary": 3000000,
  "salaryDate": 25,
  "dailyLimit": 50000,
  "monthlySavingGoal": 500000,
  "assetUpdateDate": 1,
  "savings": [
    { "id": "abc", "name": "청약", "amount": 200000, "day": 10 }
  ],
  "fixedExpenses": [
    { "id": "def", "name": "통신비", "amount": 55000, "day": 15 }
  ],
  "memo": "메모 내용"
}
```

---

## Money — 자산 설정 히스토리

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/money/settings/history` | 히스토리 목록 (최신순) | ✅ |
| `POST` | `/money/settings/history` | 현재 설정 스냅샷 저장 | ✅ |
| `GET` | `/money/settings/history/:id` | 히스토리 단건 조회 | ✅ |
| `PATCH` | `/money/settings/history/:id` | 히스토리 제목 수정 | ✅ |
| `DELETE` | `/money/settings/history/:id` | 히스토리 삭제 | ✅ |

### POST /money/settings/history body
```json
{
  "title": "2026년 7월 설정",
  "month": "2026-07",
  "salary": 3000000,
  "salaryDate": 25,
  "dailyLimit": 50000,
  "monthlySavingGoal": 500000,
  "assetUpdateDate": 1,
  "savings": [...],
  "fixedExpenses": [...],
  "memo": "메모"
}
```

### PATCH /money/settings/history/:id body
```json
{ "title": "새 제목" }
```

---

## Money — 가계부 (Expenses)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/money/expenses?year=&month=` | 월별 지출 목록 (기본: 현재 월) | ✅ |
| `POST` | `/money/expenses` | 항목 추가 | ✅ |
| `PATCH` | `/money/expenses/:id` | 항목 수정 | ✅ |
| `DELETE` | `/money/expenses/:id` | 항목 삭제 | ✅ |

### POST /money/expenses body
```json
{
  "date": "2026-07-06T00:00:00.000Z",
  "amount": 15000,
  "description": "점심",
  "category": "FOOD",
  "isWaste": false
}
```

Category 값: `FOOD` / `CAFE` / `TRANSPORT` / `SHOPPING` / `MEDICAL` / `CULTURE` / `SUBSCRIPTION` / `ETC`

---

## Money — 주식 (StockHoldings)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/money/stocks` | 보유 종목 전체 | ✅ |
| `POST` | `/money/stocks` | 종목 추가 | ✅ |
| `PATCH` | `/money/stocks/:id` | 종목 수정 | ✅ |
| `DELETE` | `/money/stocks/:id` | 종목 삭제 | ✅ |

### POST /money/stocks body
```json
{
  "market": "KR",
  "ticker": "005930",
  "name": "삼성전자",
  "inputMode": "QUANTITY",
  "quantity": 10,
  "averagePrice": 75000
}
```

Market: `KR` / `US`  
InputMode: `QUANTITY` (수량 입력) / `AMOUNT` (금액 입력)

---

## 헬스체크

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/health` | 서버 상태 확인 (`{ "status": "ok" }`) |
