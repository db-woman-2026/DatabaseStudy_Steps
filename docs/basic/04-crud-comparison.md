# 04. SQL과 MongoDB CRUD 비교

SQL과 MongoDB의 CRUD를 입력, 조건, 결과, 검증 순서로 비교합니다.

## 1. CRUD란 무엇인가

CRUD는 데이터를 다루는 네 가지 기본 작업입니다.

- Create: 새로운 사실을 저장합니다.
- Read: 조건에 맞는 현재 상태를 읽습니다.
- Update: 기존 데이터의 일부 또는 전체를 바꿉니다.
- Delete: 더 이상 유지하지 않을 데이터를 제거합니다.

도서 관리에서는 다음 요구로 나타납니다.

| CRUD | 사용자 요구 |
| --- | --- |
| Create | 새 도서를 등록한다. 리뷰를 추가한다. |
| Read | 전체 도서를 본다. ISBN으로 한 권을 찾는다. |
| Update | 재고를 바꾼다. 카테고리를 추가한다. |
| Delete | 잘못 등록한 도서를 삭제한다. |

CRUD는 화면의 버튼 수와 일치하지 않을 수 있습니다. “대출하기”는 대출 Create와 도서 재고 Update를 함께 수행합니다. “리뷰 추가”도 도서 문서의 배열을 Update하지만, 업무 관점에서는 리뷰 Create입니다.

## 2. 기본 표현 비교

| 목적 | SQL | MongoDB Node.js Driver |
| --- | --- | --- |
| 한 건 생성 | `INSERT INTO ... VALUES ...` | `insertOne(document)` |
| 여러 건 생성 | 여러 VALUES 또는 반복 INSERT | `insertMany(documents)` |
| 여러 건 조회 | `SELECT ... FROM ... WHERE ...` | `find(filter, options)` |
| 한 건 조회 | 고유 조건의 `SELECT`, 필요 시 `LIMIT 1` | `findOne(filter, options)` |
| 일부 필드 수정 | `UPDATE ... SET ... WHERE ...` | `updateOne(filter, update)` |
| 여러 건 수정 | `UPDATE ... WHERE ...` | `updateMany(filter, update)` |
| 한 건 삭제 | 고유 조건의 `DELETE` | `deleteOne(filter)` |
| 여러 건 삭제 | `DELETE ... WHERE ...` | `deleteMany(filter)` |

메서드 이름이 비슷해도 결과 단위와 안전 장치가 자동으로 같지는 않습니다. SQL의 `UPDATE`는 조건에 맞는 모든 행을 바꾸지만 MongoDB의 `updateOne()`은 일치하는 첫 문서만 바꿉니다.

## 3. 모든 변경의 공통 안전 루프

Create를 포함한 모든 작업은 다음 질문으로 검증합니다.

```text
의도 정의
  → 입력 검증
  → 대상/중복 사전 조회
  → 예상 처리 건수 기록
  → 작업 실행
  → 반환 결과 확인
  → 식별자로 사후 조회
  → 예상과 실제 차이 설명
```

수정·삭제에서는 이 루프를 더 엄격하게 지킵니다.

### 예: 재고 수정

1. ISBN과 새 재고가 입력되었는지 확인합니다.
2. 재고가 0 이상의 정수인지 검증합니다.
3. ISBN으로 현재 도서와 재고를 조회합니다.
4. 대상 1건, 새 재고 8을 예상합니다.
5. 수정합니다.
6. matched/modified 또는 changes를 확인합니다.
7. 같은 ISBN으로 다시 조회합니다.
8. 기존 값과 새 값이 같았다면 변경 0건인 이유를 기록합니다.

## 4. Create: 입력에서 저장 문서까지

### SQL

```sql
INSERT INTO books (isbn, title, stock)
VALUES (?, ?, ?);
```

```js
const result = statement.run(isbn, title, stock)
console.log(result.lastInsertRowid)
```

### MongoDB

```js
const book = {
  isbn,
  title,
  inventory: { stock, location: "PRACTICE" },
  categories,
  createdAt: new Date(),
}

const result = await books.insertOne(book)
console.log(result.insertedId)
```

### 생성 전 검증

- 필수 문자열은 공백만으로 이루어지지 않았는가?
- 숫자 문자열을 실제 숫자로 변환했는가?
- 허용 범위 안인가?
- 배열의 빈 값과 중복을 정리했는가?
- 업무상 고유한 값이 이미 존재하는가?
- DB의 unique constraint/index가 최종 중복을 막는가?

애플리케이션 사전 중복 조회는 친절한 메시지에 도움이 되지만, 동시 요청까지 고려하면 DB의 고유 제약이 최종 보장이어야 합니다.

## 5. Read: 필터, 프로젝션, 정렬

조회는 세 질문으로 나눕니다.

1. 어떤 데이터를 고를 것인가? — 필터/WHERE
2. 어떤 필드를 돌려줄 것인가? — 프로젝션/SELECT list
3. 어떤 순서로 볼 것인가? — 정렬/ORDER BY

### SQL

```sql
SELECT isbn, title, stock
FROM books
WHERE stock >= ?
ORDER BY title ASC;
```

### MongoDB

```js
const rows = await books
  .find(
    { "inventory.stock": { $gte: minStock } },
    { projection: { _id: 0, isbn: 1, title: 1, "inventory.stock": 1 } },
  )
  .sort({ title: 1 })
  .toArray()
```

### 한 건 조회의 조건

`findOne({ title })`은 같은 제목이 여러 권일 때 어느 문서가 선택될지 업무적으로 모호합니다. ISBN처럼 unique index가 있는 필드를 한 건 식별 조건으로 사용합니다.

조회 결과가 0건인 것은 보통 정상적인 상태입니다. “없음”을 오류로 던질지, 빈 배열 또는 `null`을 사용자 메시지로 바꿀지는 호출 맥락에 따라 결정합니다.

## 6. 조건 비교

| 의미 | SQL | MongoDB 필터 |
| --- | --- | --- |
| 같음 | `stock = 3` | `{ stock: 3 }` 또는 `{ stock: { $eq: 3 } }` |
| 이상 | `stock >= 3` | `{ stock: { $gte: 3 } }` |
| 범위 | `year BETWEEN 2024 AND 2026` | `{ year: { $gte: 2024, $lte: 2026 } }` |
| 목록 포함 | `status IN ('ready', 'loaned')` | `{ status: { $in: ["ready", "loaned"] } }` |
| AND | `a = 1 AND b = 2` | `{ a: 1, b: 2 }` |
| OR | `a = 1 OR b = 2` | `{ $or: [{ a: 1 }, { b: 2 }] }` |
| NULL | `returned_at IS NULL` | `{ returnedAt: null }`은 missing도 고려 필요 |
| 문자열 패턴 | `title LIKE '%SQL%'` | `{ title: /SQL/i }` |

MongoDB에서 `null` 조회는 필드가 명시적으로 null인 문서뿐 아니라 필드가 없는 문서와도 일치할 수 있습니다. 필드 존재 여부가 중요하면 `$exists`를 함께 검토합니다.

## 7. Update: 전체 교체보다 의도한 필드만

### SQL SET

```sql
UPDATE books
SET stock = ?, updated_at = CURRENT_TIMESTAMP
WHERE isbn = ?;
```

### MongoDB `$set`

```js
await books.updateOne(
  { isbn },
  {
    $set: {
      "inventory.stock": stock,
      updatedAt: new Date(),
    },
  },
)
```

중첩 필드 경로를 정확히 지정하면 같은 `inventory` 안의 `location`을 보존합니다.

## 8. 숫자 변경: 대입과 증감

새 재고의 절대값을 알고 있다면 `$set`을 사용합니다.

```js
{ $set: { "inventory.stock": 8 } }
```

현재 값에서 1 증가시키려면 `$inc`가 의도를 더 잘 표현합니다.

```js
{ $inc: { "inventory.stock": 1 } }
```

애플리케이션에서 먼저 읽고 `현재값 + 1`을 계산해 `$set`하면 읽기와 쓰기 사이에 다른 요청의 변경을 덮어쓸 수 있습니다. DB 연산자 하나로 증감하면 한 문서 안에서 원자적으로 처리할 수 있습니다.

재고 감소에는 조건도 함께 둡니다.

```js
await books.updateOne(
  { isbn, "inventory.stock": { $gt: 0 } },
  { $inc: { "inventory.stock": -1 } },
)
```

`matchedCount`가 0이면 도서가 없거나 재고가 0일 수 있으므로 필요하면 추가 조회로 원인을 구분합니다.

## 9. 배열 수정 연산자

### `$push`

배열 끝에 값을 항상 추가합니다.

```js
{ $push: { reviews: review } }
```

같은 리뷰를 두 번 실행하면 두 원소가 생깁니다. 중복 허용 여부는 업무 규칙으로 정합니다.

### `$addToSet`

동일한 값이 배열에 없을 때만 추가합니다.

```js
{ $addToSet: { categories: "database" } }
```

같은 값을 반복 실행해도 배열 상태가 같다는 점에서 멱등적인 결과를 만들기 쉽습니다.

### `$pull`

조건과 일치하는 배열 원소를 제거합니다.

```js
{ $pull: { categories: "beginner" } }
```

### 여러 값 추가

```js
{
  $addToSet: {
    categories: { $each: ["database", "mongodb"] },
  },
}
```

배열이 커질 수 있다면 연산자 선택 전에 문서 모델 자체가 적절한지 다시 봅니다.

## 10. 결과 카운트 읽기

### SQL/SQLite

```js
const result = statement.run(...values)
console.log(result.changes)
```

### MongoDB update

```js
console.log(result.matchedCount)
console.log(result.modifiedCount)
```

- `matchedCount = 0`: 조건에 맞는 문서를 찾지 못했습니다.
- `matchedCount = 1, modifiedCount = 1`: 한 문서를 찾아 실제로 바꿨습니다.
- `matchedCount = 1, modifiedCount = 0`: 문서는 있지만 이미 같은 값인 등 상태 변화가 없었습니다.

### MongoDB delete

```js
console.log(result.deletedCount)
```

카운트를 사용자에게 보여주는 것만으로 충분하지 않을 수 있습니다. 로그, 모니터링, 예상 건수와 불일치 시 중단 정책도 실제 서비스에서는 고려합니다.

## 11. 안전한 Delete

```js
const target = await books.findOne(
  { isbn },
  { projection: { _id: 0, isbn: 1, title: 1 } },
)

if (!target) {
  console.log("삭제할 문서가 없습니다.")
  return
}

console.log("삭제 대상", target)

if (confirmation !== "confirm") {
  console.log("삭제를 중단합니다.")
  return
}

const result = await books.deleteOne({ isbn })
console.log(result.deletedCount)
```

다음 질문을 답한 뒤 삭제합니다.

1. 조건이 고유한가?
2. 사전 조회 결과가 정확히 예상한 대상인가?
3. 다른 데이터가 이 대상을 참조하는가?
4. 복구가 필요한가?
5. 감사나 법적 보존 요구가 있는가?

## 12. hard delete와 soft delete

### hard delete

문서를 물리적으로 제거합니다.

```js
await books.deleteOne({ isbn })
```

### soft delete

삭제 시각 또는 활성 상태를 기록하고 일반 조회에서 제외합니다.

```js
await books.updateOne(
  { isbn, deletedAt: { $exists: false } },
  { $set: { deletedAt: new Date(), updatedAt: new Date() } },
)
```

일반 목록은 다음 조건을 포함해야 합니다.

```js
{ deletedAt: { $exists: false } }
```

soft delete는 복구와 감사에 도움이 되지만 모든 조회가 삭제 상태를 빠짐없이 제외해야 하고 저장 공간도 계속 사용합니다. “안전해 보인다”는 이유만으로 무조건 선택하지 않습니다.

## 13. updateOne과 updateMany

`updateMany()`는 조건에 맞는 문서 여러 건을 바꿉니다. 실행 전에 변경 범위를 확인합니다.

```js
const filter = {
  categories: "beginner",
  "inventory.stock": 0,
}

const targets = await books.countDocuments(filter)
console.log(`예상 대상: ${targets}건`)

const result = await books.updateMany(
  filter,
  { $set: { needsRestock: true } },
)
```

여러 건 작업에서는 다음을 추가합니다.

- 샘플 대상 몇 건을 프로젝션으로 출력
- 전체 대상 건수
- 예상 최대 건수 guard
- batch 또는 transaction 필요성 검토
- 변경 로그와 롤백/복원 계획

## 14. 정규식 검색과 입력 안전

사용자 입력을 그대로 정규식으로 만들면 `.`이나 `*`가 특별한 의미로 해석됩니다.

```js
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
```

```js
const pattern = new RegExp(escapeRegex(keyword), "i")
```

`escapeRegex()`는 사용자가 입력한 `Node.js`의 점을 “임의의 한 문자”가 아니라 실제 점으로 검색합니다. 대규모 부분 문자열 검색은 일반 B-tree 인덱스를 충분히 활용하지 못할 수 있으므로 실제 서비스에서는 text index 또는 검색 엔진 등 접근 패턴에 맞는 도구를 검토합니다.

## 15. 멱등성

같은 작업을 여러 번 실행해도 두 번째 이후 최종 상태가 달라지지 않는 성질을 멱등성이라고 합니다.

- `$set: { stock: 3 }`: 같은 값을 반복하면 상태가 같습니다.
- `$addToSet: { categories: "sql" }`: 같은 category를 반복해도 하나만 남습니다.
- `$inc: { stock: 1 }`: 실행할 때마다 값이 늘어 멱등적이지 않습니다.
- `$push: { reviews: review }`: 실행할 때마다 원소가 늘어 멱등적이지 않습니다.
- `deleteOne({ isbn })`: 첫 실행 1건, 다음 실행 0건이지만 최종 “없음” 상태는 같습니다.

네트워크 재시도나 사용자의 이중 클릭이 가능한 시스템에서는 요청 ID, unique index, 상태 조건 등으로 중복 실행 정책을 설계합니다.

## 16. 원자성과 경쟁 상태

다음 코드는 재고를 읽고 JavaScript에서 계산한 뒤 저장합니다.

```js
const book = await books.findOne({ isbn })
const nextStock = book.inventory.stock - 1
await books.updateOne(
  { isbn },
  { $set: { "inventory.stock": nextStock } },
)
```

두 요청이 동시에 같은 재고 1을 읽으면 둘 다 0을 저장해 대출은 두 건인데 재고는 한 번만 감소한 것처럼 될 수 있습니다.

조건과 변경을 한 연산에 넣습니다.

```js
const result = await books.updateOne(
  { isbn, "inventory.stock": { $gt: 0 } },
  { $inc: { "inventory.stock": -1 } },
)
```

한 문서 안의 변경은 원자적으로 처리됩니다. 여러 문서/컬렉션 변경을 하나로 묶어야 한다면 transaction이나 다른 일관성 설계를 검토합니다.

## 17. 오류와 0건을 구분하기

다음은 서로 다른 상태입니다.

- 입력이 빈 문자열이라 실행 전 검증 실패
- DB 연결 실패
- unique index 위반으로 생성 실패
- 조회 결과 0건
- 수정 대상 0건
- 문서는 찾았지만 새 값이 같아 변경 0건
- 삭제 확인 문구가 없어 의도적으로 중단

모든 상태를 “작업 실패” 한 문장으로 처리하면 사용자는 다음 행동을 알 수 없습니다. 메시지는 입력, 연결, 조건, 제약, 상태 변화 중 어디에서 멈췄는지 알려야 합니다.

## 18. 테스트 입력 매트릭스

Create와 Update 기능에는 최소 다음 사례를 시험합니다.

| 분류 | 예 | 기대 |
| --- | --- | --- |
| 정상 | stock `3` | 숫자 3 저장 |
| 경계 | stock `0` | 허용 |
| 범위 오류 | stock `-1` | 실행 전 거부 |
| 타입 오류 | stock `1.5`, `abc` | 실행 전 거부 |
| 빈 값 | title 공백 | 실행 전 거부 |
| 중복 | 기존 ISBN | unique 오류/친절한 메시지 |
| 없음 | 없는 ISBN 조회 | null/없음 메시지 |
| 동일 값 | stock을 현재 값으로 수정 | matched 1, modified 0 |
| 특수문자 | 검색어 `Node.js (기초)` | 문자 그대로 검색 |
| 반복 | 같은 category 두 번 추가 | 배열 중복 없음 |

테스트는 함수 반환값뿐 아니라 실제 DB 상태가 예상과 같은지도 계층에 맞춰 확인합니다.

## 19. 도메인 변형 시나리오

### 장바구니 수량

- Create: 장바구니에 상품 추가
- Read: 사용자의 현재 장바구니 조회
- Update: 수량 증가/감소
- Delete: 항목 제거

같은 상품을 다시 담을 때 새 항목을 만들지 수량을 늘릴지 unique 규칙과 upsert를 검토할 수 있습니다.

### 예약

- Create: 빈 좌석에 예약 생성
- Read: 날짜와 상태로 예약 조회
- Update: 시간 또는 상태 변경
- Delete: 취소 또는 soft delete

좌석 수 감소와 예약 생성이 함께 성공해야 하는지 트랜잭션 질문으로 이어집니다.

### 게시글 댓글

- Create: 댓글 추가
- Read: 최신순 페이지 조회
- Update: 작성자 본인의 내용 수정
- Delete: 실제 제거 또는 삭제됨 표시

권한 조건을 update/delete 필터에 포함해야 하는 이유를 생각할 수 있습니다.

## 20. 개념 확인 문제

1. CRUD의 업무 이름과 데이터베이스 연산이 항상 1:1이 아닌 예를 하나 드세요.
2. 한 건 조회 조건이 실제로 고유해야 하는 이유는 무엇인가요?
3. `matchedCount=1`, `modifiedCount=0`은 어떤 상황인가요?
4. `$push`와 `$addToSet`을 카테고리에 각각 사용하면 어떤 차이가 있나요?
5. 재고 감소에 읽기 후 `$set`보다 조건부 `$inc`가 유리한 이유는 무엇인가요?
6. soft delete의 이점과 비용을 하나씩 적으세요.
7. `updateMany()` 전에 `countDocuments()`와 샘플 조회를 하는 이유는 무엇인가요?
8. 입력 정규식 escape와 SQL 플레이스홀더의 공통 목적은 무엇인가요?

<details>
<summary>개념 확인 해설</summary>

1. 대출하기는 대출 Create와 재고 Update를 함께 수행합니다. 리뷰 추가는 리뷰 관점의 Create지만 도서 문서 관점의 Update입니다.
2. 제목처럼 중복 가능한 조건이면 어느 한 건을 반환하거나 수정할지 업무적으로 모호하기 때문입니다.
3. 대상 문서는 찾았지만 이미 같은 값이거나 연산 결과 상태 변화가 없을 수 있습니다.
4. `$push`는 중복을 허용하고 `$addToSet`은 동일 값을 한 번만 유지합니다.
5. 조건 확인과 감소를 한 DB 연산으로 수행하여 동시 요청 사이의 읽기-쓰기 틈을 줄입니다.
6. 복구와 감사가 쉽지만 모든 조회에서 삭제 조건을 관리하고 저장 공간을 계속 사용합니다.
7. 조건이 너무 넓어 예상보다 많은 문서를 바꾸는 사고를 실행 전에 발견하기 위해서입니다.
8. 사용자 입력이 명령 구조로 오해되지 않고 데이터/문자 그대로 처리되게 분리합니다.

</details>

## 21. 확인 항목

- [ ] Create 입력을 저장 문서로 바꾸기 전 검증 항목을 말할 수 있습니다.
- [ ] 필터, 프로젝션, 정렬을 구분할 수 있습니다.
- [ ] `$set`, `$inc`, `$push`, `$addToSet`, `$pull`의 차이를 설명할 수 있습니다.
- [ ] matched/modified/deleted 건수를 읽을 수 있습니다.
- [ ] update/delete 전후 안전 루프를 수행할 수 있습니다.
- [ ] hard delete와 soft delete를 요구사항에 따라 비교할 수 있습니다.
- [ ] 멱등적인 작업과 그렇지 않은 작업을 구분할 수 있습니다.
- [ ] 정상·경계·오류 입력을 포함한 테스트 사례를 만들 수 있습니다.
