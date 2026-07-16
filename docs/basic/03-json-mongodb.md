# 03. JSON, BSON과 MongoDB

4~5일차 전에 읽을 자료입니다. MongoDB는 문서 저장·조회·인덱스·원자적 변경을 제공하는 DBMS입니다.

## 1. JSON 복습

JSON(JavaScript Object Notation)은 시스템 사이에서 데이터를 표현하고 교환하는 텍스트 형식입니다.

```json
{
  "isbn": "978-00-0001",
  "title": "데이터를 배우는 시간",
  "author": {
    "name": "김데이터",
    "country": "KR"
  },
  "categories": ["database", "beginner"],
  "inventory": {
    "stock": 3,
    "location": "A-01"
  }
}
```

JSON의 주요 값은 문자열, 숫자, boolean, null, 배열, 객체입니다. 키와 문자열은 큰따옴표를 사용하며 주석, 함수, `Date` 객체를 그대로 표현하지 못합니다.

### JavaScript 객체와 JSON 문자열

```js
const book = { title: "SQL 첫걸음", stock: 2 }
const jsonText = JSON.stringify(book)
const restored = JSON.parse(jsonText)
```

- `book`: 메모리의 JavaScript 객체
- `jsonText`: `{"title":"SQL 첫걸음","stock":2}` 형태의 문자열
- `restored`: 문자열을 파싱해 만든 새 JavaScript 객체

MongoDB Driver에 전달하는 것은 보통 JSON 문자열이 아니라 JavaScript 객체입니다.

## 2. BSON이 필요한 이유

MongoDB는 내부적으로 BSON(Binary JSON) 형식의 문서를 저장합니다. BSON은 JSON 모양의 중첩 구조를 유지하면서 JSON보다 다양한 타입을 표현합니다.

대표적인 BSON 타입은 다음과 같습니다.

- String
- 32-bit/64-bit 정수, double, decimal
- Boolean
- Date
- ObjectId
- Binary 데이터
- Array
- Embedded 문서
- Null

JavaScript `Date`를 Driver에 전달하면 단순 문자열이 아니라 날짜 타입으로 저장할 수 있습니다. 날짜 타입은 시간 범위 조회와 정렬에 유리합니다.

```js
{
  createdAt: new Date("2026-07-01T00:00:00.000Z")
}
```

JSON과 BSON은 관련 있지만 같은 말이 아닙니다. 화면에 출력할 때 BSON 문서를 JSON 비슷한 모양으로 보더라도 `_id`의 ObjectId와 Date 같은 타입 정보를 의식해야 합니다.

## 3. MongoDB의 구조 계층

```text
MongoDB server/deployment
└── database_study_course       database
    ├── books_course            collection
    │   ├── { _id, isbn, ... }  document
    │   └── { _id, isbn, ... }  document
    └── publishers_step5        collection
```

### 배포 환경/서버

MongoDB가 실행되는 환경입니다. 로컬 단일 서버, replica set, Atlas cluster 등 형태가 다를 수 있습니다.

### 데이터베이스

관련 컬렉션을 묶는 이름 공간입니다. 이 과정에서는 `database_study_`로 시작하는 강의 전용 이름만 허용합니다.

### 컬렉션

같은 목적의 문서 모음입니다. 관계형 데이터베이스의 테이블과 비교할 수 있지만, 모든 문서가 항상 완전히 같은 필드를 갖도록 자동 강제되는 것은 아닙니다.

### 문서

한 저장 단위입니다. 중첩 객체와 배열을 포함할 수 있습니다. 이 과정의 `books_course`에서 문서 하나는 도서 한 권을 나타냅니다.

### 필드

문서의 키와 값입니다. 테이블의 열과 비교할 수 있지만 문서마다 필드 존재 여부가 다를 수 있고 중첩 구조를 가질 수 있습니다.

### `_id`

각 문서를 고유하게 식별하는 필드입니다. 생략하면 Driver/MongoDB가 일반적으로 ObjectId를 생성합니다. `_id`에는 자동으로 고유 인덱스가 있습니다.

## 4. 관계형 행과 문서 비교

관계형 모델에서는 저자와 도서를 나눌 수 있습니다.

```text
authors(id=1, name="김데이터", country="KR")
books(id=10, title="데이터를 배우는 시간", author_id=1)
```

MongoDB에서는 읽기 요구에 따라 저자 요약을 도서 안에 포함할 수 있습니다.

```js
{
  title: "데이터를 배우는 시간",
  author: {
    name: "김데이터",
    country: "KR",
  },
}
```

포함하면 도서 한 건 조회로 저자 이름도 얻습니다. 반면 저자 이름이 바뀌면 그 저자의 여러 도서 문서를 갱신해야 할 수 있습니다. 구조 선택은 조회 편의와 갱신 일관성 사이의 판단입니다.

## 5. 유연한 스키마의 의미

같은 컬렉션의 문서가 서로 다른 필드를 가질 수 있습니다.

```js
{ title: "책 A", stock: 3 }
{ title: "책 B", inventory: { stock: 2 }, subtitle: "입문" }
```

이 유연성은 점진적 기능 추가와 다양한 속성 표현에 도움이 되지만, 규칙이 필요 없다는 뜻은 아닙니다.

위 두 문서에서 재고를 검색하려면 `stock`과 `inventory.stock`을 모두 고려해야 합니다. 문자열 `"3"`과 숫자 `3`이 섞이면 비교·정렬·집계 결과가 예상과 달라질 수 있습니다.

일관성을 유지하는 방법은 여러 층에 있습니다.

- 애플리케이션 입력 검증
- 테스트
- MongoDB 스키마 validation
- unique index
- 마이그레이션과 데이터 정리
- 문서 구조 버전 필드

“스키마-less”보다는 “스키마-flexible”이라고 이해하는 편이 정확합니다.

## 6. 중첩 객체

```js
inventory: {
  stock: 3,
  location: "A-01",
}
```

재고 수량과 위치는 함께 읽고 같은 의미 범주에 속하므로 `inventory` 안에 묶었습니다.

중첩 필드는 점 표기법으로 조회합니다.

```js
{ "inventory.stock": { $gte: 2 } }
```

수정할 때도 같은 표기법을 사용합니다.

```js
{ $set: { "inventory.stock": 5 } }
```

`$set: { inventory: { stock: 5 } }`처럼 상위 객체 전체를 바꾸면 기존 `inventory.location`이 사라질 수 있습니다. 의도한 범위만 수정하는 이유입니다.

## 7. 배열

```js
categories: ["database", "beginner"]
```

문자열 배열에서 특정 값을 포함하는 문서는 다음처럼 찾을 수 있습니다.

```js
{ categories: "database" }
```

배열 원소가 중첩 문서일 수도 있습니다.

```js
reviews: [
  {
    reviewer: "민지",
    score: 5,
    comment: "이해하기 쉬웠어요.",
  },
]
```

배열은 자연스럽지만 반드시 성장 한계를 질문해야 합니다.

- 카테고리: 보통 도서당 몇 개로 제한되어 bounded 배열에 가깝습니다.
- 리뷰: 서비스 규모에 따라 계속 늘어날 수 있는 unbounded 배열입니다.
- 센서 측정값: 초당 계속 추가되므로 한 장치 문서에 영원히 넣으면 안 됩니다.

MongoDB 문서에는 크기 제한이 있고, 큰 배열은 읽기·쓰기 비용과 경합을 늘립니다. 무한히 커질 수 있는 데이터는 별도 컬렉션, bucket, time-series 구조 등을 검토합니다.

## 8. 포함(embedding)

관련 데이터를 한 문서 안에 저장합니다.

```js
{
  orderNumber: "O-1001",
  shippingAddress: {
    recipient: "김민지",
    city: "서울",
  },
}
```

주문 당시 배송지는 회원의 현재 주소가 바뀌어도 과거 주문 기록으로 남아야 하므로 snapshot으로 포함하는 선택이 자연스러울 수 있습니다.

### 포함이 유리한 신호

- 함께 읽는 경우가 대부분입니다.
- 자식 데이터가 부모 없이 독립적으로 의미가 적습니다.
- 크기가 작고 최대 개수가 제한됩니다.
- 한 문서의 원자적 변경 범위에 두고 싶습니다.
- 중복된 값이 바뀌지 않거나 과거 snapshot이어야 합니다.

### 포함의 비용

- 공유 정보가 여러 문서에 중복됩니다.
- 공유 정보 변경 시 여러 문서를 갱신할 수 있습니다.
- 배열이 커지면 문서가 비대해집니다.
- 항상 필요하지 않은 큰 중첩 데이터도 함께 읽을 수 있습니다.

## 9. 참조(reference)

별도 컬렉션의 식별자를 저장합니다.

```js
// books
{ title: "SQL 첫걸음", publisherCode: "DATA-LAB" }

// publishers
{ code: "DATA-LAB", name: "데이터 연구소", website: "..." }
```

### 참조가 유리한 신호

- 여러 문서가 같은 대상을 공유합니다.
- 참조 대상이 독립적으로 자주 변경됩니다.
- 데이터 크기가 크거나 계속 성장합니다.
- 대상만 별도로 조회·관리하는 기능이 많습니다.
- 중복 갱신의 일관성 비용이 큽니다.

### 참조의 비용

- 애플리케이션이 추가 조회를 수행하거나 `$lookup`을 검토해야 합니다.
- MongoDB가 일반 외래 키처럼 존재를 자동 보장하지 않습니다.
- 참조 대상 삭제 시 고아 참조를 애플리케이션이 관리해야 합니다.

포함과 참조를 섞을 수도 있습니다. `authorId`를 참조하면서 목록에 필요한 `authorNameSnapshot`을 함께 둘 수 있지만, 어느 값이 진실의 원천인지 명확히 해야 합니다.

## 10. 접근 패턴에서 시작하기

문서 모델은 객체 모양을 예쁘게 만드는 작업이 아닙니다. 먼저 어떤 명령과 화면이 있는지 적습니다.

```text
1. ISBN으로 도서 한 권과 저자·재고를 조회한다.
2. category로 도서 목록을 찾는다.
3. 출판사 정보는 관리 화면에서 독립적으로 수정한다.
4. 도서 재고는 자주 바뀐다.
5. 리뷰는 도서 상세에서 최근 일부만 본다.
```

이 질문에서 다음 선택을 검토할 수 있습니다.

- 저자 요약과 재고는 도서에 포함
- 출판사는 별도 컬렉션에 두고 code 참조
- categories는 작은 배열로 포함
- 리뷰가 크게 성장하면 별도 컬렉션 검토
- ISBN, categories, 재고 조건에 맞는 인덱스 검토

요구사항이 바뀌면 좋은 모델도 바뀔 수 있습니다.

## 11. MongoDB 연결 흐름

```js
const { MongoClient } = require("mongodb")

const client = new MongoClient(uri)
await client.connect()
const database = client.db(databaseName)
const books = database.collection("books_step4")

// 작업

await client.close()
```

네트워크를 거치는 연결과 조회는 비동기이므로 Promise를 반환하고 `await`를 사용합니다. 오류가 나도 연결을 닫도록 이 저장소는 `withDatabase()` 안에서 정리합니다.

`.env`의 URI에는 인증 정보가 포함될 수 있으므로 커밋하지 않습니다. 강의에서는 실제 업무 데이터베이스가 아니라 안전 접두사를 가진 전용 데이터베이스만 사용합니다.

## 12. 생성 결과 읽기

```js
const result = await books.insertOne(book)
console.log(result.insertedId)
```

```js
const result = await books.insertMany(sampleBooks)
console.log(result.insertedCount)
```

“오류가 없었다”만 확인하지 않고 생성 ID 또는 건수를 읽고, 그 식별자로 다시 조회합니다.

## 13. find, findOne과 커서

### 여러 문서 조회

```js
const cursor = books.find({ categories: "database" })
const rows = await cursor.sort({ title: 1 }).toArray()
```

`find()`는 즉시 모든 문서를 배열로 돌려주는 것이 아니라 커서를 반환합니다. 커서에 정렬, 제한, 프로젝션을 구성한 뒤 결과를 소비합니다.

### 한 문서 조회

```js
const book = await books.findOne({ isbn: "978-00-0001" })
```

일치 문서가 없으면 `null`입니다. 한 건을 기대한다면 ISBN에 unique index가 있는지처럼 조건 자체가 고유한지도 확인합니다.

## 14. 필터와 연산자

```js
{
  categories: "database",
  "inventory.stock": { $gte: 2 },
}
```

같은 객체의 서로 다른 필드는 기본적으로 AND입니다. 위 조건은 데이터베이스 카테고리이면서 재고가 2 이상인 도서입니다.

```js
{
  $or: [
    { title: /mongo/i },
    { "author.name": /mongo/i },
  ],
}
```

대표 비교 연산자는 `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`입니다. 실제 타입이 숫자인지 문자열인지에 따라 결과가 달라질 수 있습니다.

## 15. 프로젝션

```js
{
  projection: {
    _id: 0,
    title: 1,
    "author.name": 1,
    "inventory.stock": 1,
  },
}
```

필요한 필드만 반환하면 네트워크 전송량과 애플리케이션이 다룰 데이터를 줄일 수 있습니다. 보통 포함 방식(1)과 제외 방식(0)을 한 프로젝션에서 섞지 않지만 `_id` 제외는 예외적으로 함께 사용합니다.

프로젝션은 저장된 문서를 바꾸지 않습니다. 조회 결과의 모양만 정합니다.

## 16. 인덱스

인덱스는 특정 필드 값과 문서 위치를 정렬된 구조로 관리해, 모든 문서를 검사하는 컬렉션 scan을 줄일 수 있습니다.

```js
await books.createIndex({ isbn: 1 }, { unique: true })
await books.createIndex({ categories: 1 })
await books.createIndex({ "inventory.stock": 1 })
```

### unique index

조회 성능뿐 아니라 중복 ISBN을 막는 규칙 역할을 합니다. 기존에 중복 데이터가 있으면 인덱스 생성이 실패할 수 있습니다.

### multikey index

배열 필드에 인덱스를 만들면 배열 원소를 검색할 수 있는 multikey index가 됩니다. 한 문서의 여러 배열 값을 인덱스가 다룹니다.

### compound index

```js
await books.createIndex({ categories: 1, publishedYear: -1 })
```

카테고리로 필터하고 출판 연도 역순으로 정렬하는 반복 조회에 맞을 수 있습니다. 필드 순서가 중요하며 실제 쿼리 패턴과 실행 계획으로 검증해야 합니다.

### 인덱스의 비용

- 별도 저장 공간이 필요합니다.
- INSERT/UPDATE/DELETE 시 인덱스도 갱신합니다.
- 사용하지 않는 인덱스는 쓰기 비용만 늘릴 수 있습니다.
- 배열 값이 많으면 인덱스 항목도 많아질 수 있습니다.

모든 필드에 인덱스를 만드는 대신 자주 실행되는 필터·정렬·고유성 요구에서 시작합니다.

## 17. 관계형 모델과 문서 모델 비교

| 질문 | 관계형 모델 | 문서 모델 |
| --- | --- | --- |
| 기본 저장 단위 | 행 | 문서 |
| 구조 정의 | 테이블 스키마와 constraint | 문서 구조, 앱 검증, 스키마 validation |
| 관계 표현 | 외래 키 | embedding 또는 reference |
| 함께 읽기 | JOIN | 한 문서 또는 `$lookup`/추가 조회 |
| 중첩 구조 | 관련 테이블로 분리 | 객체·배열로 포함 |
| 고유성 | PRIMARY KEY, UNIQUE | `_id`, unique index |
| 다중 변경 | transaction | 문서 단위 원자성, 필요 시 transaction |

이 표는 경향을 비교한 것입니다. 현대 RDBMS도 JSON 타입을 지원하고 MongoDB도 transaction과 `$lookup`을 지원합니다. 제품 기능 하나만 보고 모델을 고르지 않습니다.

## 18. 도메인 변형 예제

### 게시글과 댓글

- 댓글이 몇 개 안 되고 항상 게시글과 함께 읽으면 포함을 검토합니다.
- 댓글이 수십만 개까지 늘고 별도 신고·검색·페이지네이션이 필요하면 컬렉션 분리를 검토합니다.

### 상품과 가격 이력

- 현재 가격은 상품 문서에 포함할 수 있습니다.
- 모든 가격 변경 이력은 계속 성장하므로 별도 컬렉션이 자연스러울 수 있습니다.

### 주문과 배송 주소

- 회원의 현재 주소는 별도 회원 데이터입니다.
- 주문 당시 배송 주소는 과거 사실을 보존하기 위해 주문 문서에 snapshot으로 포함할 수 있습니다.

### IoT 장치와 측정값

- 장치 이름·설치 위치는 장치 문서에 저장합니다.
- 매초 생성되는 측정값은 한 장치 문서의 배열에 무한히 추가하지 않습니다.

## 19. 개념 확인 문제

1. JSON 문자열, JavaScript 객체, BSON 문서를 구분해 설명하세요.
2. 컬렉션이 테이블과 비슷하지만 완전히 같지 않은 이유는 무엇인가요?
3. 유연한 스키마가 데이터 규칙이 필요 없다는 뜻이 아닌 이유는 무엇인가요?
4. `inventory.stock`만 수정할 때 상위 `inventory` 객체 전체를 `$set`하면 어떤 위험이 있나요?
5. categories와 reviews 배열의 성장 특성이 어떻게 다른가요?
6. 출판사를 참조했을 때 MongoDB가 외래 키처럼 자동 보장하지 않는 것은 무엇인가요?
7. unique index와 일반 검색 인덱스의 역할 차이를 설명하세요.
8. 프로젝션이 저장된 문서를 바꾸나요?

<details>
<summary>개념 확인 해설</summary>

1. JSON은 텍스트 교환 형식, JavaScript 객체는 런타임 메모리 값, BSON은 MongoDB가 다양한 타입과 함께 저장하는 이진 문서 형식입니다.
2. 문서마다 필드가 다를 수 있고 중첩 객체·배열을 직접 가질 수 있으며 관계를 외래 키로만 표현하지 않기 때문입니다.
3. 타입과 필드 위치가 제각각이면 조회·정렬·집계가 어려워지므로 애플리케이션 검증, 스키마 validation, 인덱스 등이 필요합니다.
4. `location` 같은 기존 하위 필드가 사라질 수 있습니다.
5. categories는 보통 최대 개수가 작지만 reviews는 계속 늘 수 있습니다.
6. `publisherCode`가 실제 publisher 문서를 가리키는지와 삭제 시 참조 정리를 자동 보장하지 않습니다.
7. unique index는 검색 지원과 함께 중복을 막고, 일반 인덱스는 중복을 허용하면서 조회를 돕습니다.
8. 아니요. 반환할 필드 모양만 제한합니다.

</details>

## 20. 4~5일차 준비 체크리스트

- [ ] 서버, 데이터베이스, 컬렉션, 문서, 필드를 계층으로 설명할 수 있습니다.
- [ ] JSON과 BSON의 차이를 한 가지 이상 설명할 수 있습니다.
- [ ] `_id`의 역할을 설명할 수 있습니다.
- [ ] 포함과 참조 선택 질문을 세 가지 이상 말할 수 있습니다.
- [ ] bounded 배열과 unbounded 배열의 예를 들 수 있습니다.
- [ ] 점 표기법으로 중첩 필드를 조회할 수 있습니다.
- [ ] 커서와 배열이 같은 것이 아님을 알고 있습니다.
- [ ] 인덱스의 읽기 이득과 쓰기 비용을 함께 설명할 수 있습니다.
