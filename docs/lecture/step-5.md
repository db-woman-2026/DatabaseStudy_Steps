# Step 5. MongoDB 데이터 모델링과 인덱스

Step 4에는 중첩 문서를 저장하고 조회했습니다. Step 5에는 조회 방식, 변경 빈도, 공유 범위, 배열 크기를 기준으로 포함과 참조를 선택합니다. 이어서 고유 제약과 반복 조회에 필요한 인덱스를 설계합니다.

## 0. 먼저 생각할 질문

1. 도서 문서에 author는 포함하면서 publisher는 참조한 근거는 무엇인가?
2. 중복 데이터는 언제 의도적인 최적화이고 언제 일관성 위험인가?
3. bounded 배열과 unbounded 배열을 어떻게 구분하는가?
4. MongoDB reference가 SQL 외래 키처럼 자동 보장하지 않는 것은 무엇인가?
5. unique index와 일반 검색 index는 각각 어떤 요구를 해결하는가?
6. 모든 필드에 index를 만들면 안 되는 이유는 무엇인가?
7. 필터·정렬·프로젝션을 실제 접근 패턴으로 묶어 index를 어떻게 제안하는가?

## 1. 완료 목표

### 개념

- 접근 패턴 중심 모델링과 객체 중심 모델링의 차이를 설명합니다.
- embedding/reference 선택 기준을 읽기, 쓰기, 크기, cardinality, 생명주기로 설명합니다.
- duplicate snapshot과 source of truth를 구분합니다.
- bounded/unbounded 배열, 문서 성장, hot 문서 위험을 설명합니다.
- `_id`, unique, single-필드, compound, multikey index의 역할을 구분합니다.
- index가 읽기에는 이득, 쓰기·저장 공간에는 비용을 준다고 설명합니다.

### 실습

- 화면과 CLI 요구를 필터·정렬·프로젝션·update 패턴으로 바꿉니다.
- author 포함과 publisher 참조 구조를 그림으로 설명합니다.
- ISBN unique index와 category/stock 검색 index를 생성하고 목록을 확인합니다.
- 중복 ISBN 오류를 재현하고 원인을 분류합니다.
- 배열 및 중첩 필드 필터를 작성합니다.
- publisherCode로 별도 컬렉션을 조회하고 참조 누락을 처리합니다.
- 현재 쿼리에 맞는 compound index 후보를 만들고 근거를 제시합니다.

### 작업 원칙

- 정답 스키마 하나를 외우지 않고 요구사항과 trade-off를 기록합니다.
- index 이름이 존재하는 것만 보지 않고 어떤 쿼리를 위한 것인지 설명합니다.
- 참조가 있다는 이유로 존재·삭제 무결성이 자동 보장된다고 가정하지 않습니다.
- 배열이 편리하다는 이유로 무한 성장 데이터를 한 문서에 넣지 않습니다.

## 2. 완료 결과

- 도서 서비스 접근 패턴 목록 8개 이상
- `author`, `publisher`, `categories`, `inventory`, `reviews` 모델링 결정표
- include/reference 대안 두 개와 trade-off 비교
- 실제 index 목록과 각 index의 목적·비용 표
- unique 위반, missing reference, 배열 성장 실패 시나리오 기록
- 쇼핑몰·게시판·예약 중 하나의 문서 모델 review
- 이해 점검 답안과 설계 의사결정서

## 3. 시작 전 준비

> Windows 11에서는 [환경 준비](../windows-11.md) <span class="print-reference" data-print-reference="true">(Database · Windows 11 x64 실습 환경 준비 · 1. Windows Terminal 설치)</span>를 먼저 확인합니다. 명령은 이 교재의 PowerShell 코드 블록에 적힌 `git`, `node`, `npm` 형태를 그대로 사용합니다.

```powershell
git branch --show-current
git status
```

MongoDB 서버가 실행 중이고 `.env`가 전용 데이터베이스를 가리켜야 합니다. 아래에서 소스 파일 전체를 입력한 뒤 실행합니다. 현재 단계 코드는 다음 두 컬렉션만 초기화합니다.

- `books_step5`
- `publishers_step5`

## 4. 소스 파일 전체 입력

개인 저장소의 기존 파일을 아래 전체 내용으로 바꿉니다. 이 저장소의 `step-N` 기준 브랜치로 이동하지 않습니다.

### `index.js`

`index.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
const { sampleBooks } = require("./lib/sampleBooks")
const { withDatabase } = require("./lib/mongodb")

const samplePublishers = [
  {
    code: "DATA-LAB",
    name: "데이터 연구소",
    website: "https://example.com/data-lab",
  },
  {
    code: "WEB-BOOKS",
    name: "웹북스",
    website: "https://example.com/web-books",
  },
]

async function main() {
  await withDatabase(async (database, databaseName) => {
    const books = database.collection("books_step5")
    const publishers = database.collection("publishers_step5")

    await books.deleteMany({})
    await publishers.deleteMany({})

    await publishers.createIndex({ code: 1 }, { unique: true })
    await books.createIndex({ isbn: 1 }, { unique: true })
    await books.createIndex({ categories: 1 })
    await books.createIndex({ "inventory.stock": 1 })

    await publishers.insertMany(samplePublishers)
    await books.insertMany(sampleBooks)

    console.log(`database: ${databaseName}`)
    console.log("books_step5 인덱스")
    console.table(
      (await books.indexes()).map((index) => ({
        name: index.name,
        key: JSON.stringify(index.key),
        unique: index.unique ?? false,
      })),
    )

    const databaseBooks = await books
      .find(
        { categories: "database" },
        {
          projection: {
            _id: 0,
            title: 1,
            "author.name": 1,
            publisherCode: 1,
            "inventory.stock": 1,
          },
        },
      )
      .sort({ publishedYear: -1 })
      .toArray()

    console.log("database 카테고리 도서")
    console.log(JSON.stringify(databaseBooks, null, 2))

    const publisher = await publishers.findOne(
      { code: databaseBooks[0].publisherCode },
      { projection: { _id: 0 } },
    )

    console.log("publisherCode로 참조한 출판사")
    console.log(publisher)
  })
}

main().catch((error) => {
  console.error("MongoDB 실습 실행 실패")
  console.error(error.message)
  console.error("MongoDB 서버와 .env의 MONGODB_URI를 확인하세요.")
  process.exitCode = 1
})
~~~

### `lib/sampleBooks.js`

`lib/sampleBooks.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
const sampleBooks = [
  {
    isbn: "978-00-0001",
    title: "데이터를 배우는 시간",
    author: {
      name: "김데이터",
      country: "KR",
    },
    categories: ["database", "beginner"],
    publisherCode: "DATA-LAB",
    inventory: {
      stock: 3,
      location: "A-01",
    },
    publishedYear: 2025,
    reviews: [],
    courseSeed: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  },
  {
    isbn: "978-00-0002",
    title: "MongoDB 첫걸음",
    author: {
      name: "박문서",
      country: "KR",
    },
    categories: ["database", "mongodb"],
    publisherCode: "DATA-LAB",
    inventory: {
      stock: 5,
      location: "A-02",
    },
    publishedYear: 2026,
    reviews: [
      {
        reviewer: "민지",
        score: 5,
        comment: "문서 구조를 이해하기 쉬웠어요.",
      },
    ],
    courseSeed: true,
    createdAt: new Date("2026-07-02T00:00:00.000Z"),
  },
  {
    isbn: "978-00-0003",
    title: "Node.js 실습 노트",
    author: {
      name: "이노드",
      country: "KR",
    },
    categories: ["nodejs", "beginner"],
    publisherCode: "WEB-BOOKS",
    inventory: {
      stock: 1,
      location: "B-01",
    },
    publishedYear: 2024,
    reviews: [],
    courseSeed: true,
    createdAt: new Date("2026-07-03T00:00:00.000Z"),
  },
]

module.exports = {
  sampleBooks,
}
~~~

### 입력 후 검사

```powershell
npm run check
npm start
```

MongoDB 실행에서 연결 오류가 나면 코드부터 바꾸지 않고 Windows 서비스와 `.env` 값을 먼저 확인합니다.

# 1. 접근 패턴에서 모델 시작하기
## 1-1. 기준 MongoDB 문서 확인
Step 4 문서의 장점과 질문을 다시 적습니다.

```js
{
  title: '데이터를 배우는 시간',
  author: { name: '김데이터', country: 'KR' },
  categories: ['database', 'beginner'],
  inventory: { stock: 3, location: 'A-01' },
}
```

- 장점: 상세 조회 한 건으로 관련 값이 함께 옴
- 질문: author 변경 시 복사본 갱신
- 질문: reviews가 계속 늘 때 문서 크기
- 질문: publisher 같은 공유 데이터를 어디에 둘지

## 1-2. 스키마보다 먼저 질문을 적는다
다음 기능 목록을 읽기와 쓰기로 나눕니다.

### 읽기 패턴

1. ISBN으로 도서 상세 한 권을 찾는다.
2. category로 목록을 찾는다.
3. 목록에는 title, author name, stock만 표시한다.
4. 재고가 특정 수 이상인 도서를 찾는다.
5. category로 필터하고 최신 출판 연도순으로 정렬한다.
6. publisher 상세를 code로 찾는다.
7. 리뷰 평균과 개수를 본다.

### 쓰기 패턴

1. 도서를 생성한다.
2. 재고를 자주 변경한다.
3. category를 가끔 추가한다.
4. 저자 표시 이름을 드물게 변경한다.
5. publisher website를 독립적으로 수정한다.
6. 리뷰를 계속 추가한다.

모델은 읽기 패턴뿐 아니라 쓰기 빈도와 문서 성장도 만족해야 합니다.

## 1-3. 접근 패턴 표
| 기능 | 필터 | 정렬 | 프로젝션 | 빈도 | 결과 수 |
| --- | --- | --- | --- | --- | --- |
| ISBN 상세 | isbn = exact | 없음 | 전체 상세 | 높음 | 0~1 |
| category 목록 | categories contains | title/year | title, author, stock | 높음 | 여러 건 |
| 재고 부족 | inventory.stock <= N | stock | isbn, title, stock | 중간 | 여러 건 |
| publisher 상세 | code = exact | 없음 | name, website | 낮음 | 0~1 |
| 리뷰 추가 | isbn exact | 없음 | update reviews | 높음 | 1 |

index 후보는 이 표의 필터와 정렬에서 나오고, embedding/reference 판단은 프로젝션·빈도·결과 수·쓰기에서 나옵니다.

## 1-4. 객체 모델과 데이터베이스 모델
JavaScript 화면 객체가 다음처럼 생겼다고 DB 문서도 반드시 같아야 하는 것은 아닙니다.

```js
const bookPageView = {
  book: bookDocument,
  publisher: publisherDocument,
  recommendationCount,
}
```

화면 응답은 여러 source를 조합할 수 있습니다. 반대로 데이터베이스 문서는 원자성, 크기, 갱신, index를 고려합니다. API 응답 모양과 저장 모양을 구분합니다.

## 1-5. 요구 변화 실험
처음에는 author를 포함한 모델이 좋았다고 가정합니다. 다음 요구가 추가될 때 판단이 어떻게 달라지는지 적습니다.

- 저자 프로필 페이지가 생김
- 저자 이름을 매달 수정
- 한 저자가 10만 권의 자료를 가짐
- 책 상세에는 author ID만 필요
- 주문 시점처럼 과거 저자 이름 snapshot을 보존해야 함

같은 필드도 요구가 달라지면 모델이 달라집니다.

### 1단원 확인
- [ ] 읽기와 쓰기 패턴을 각각 네 개 이상 적었습니다.
- [ ] 필터·정렬·프로젝션으로 요구를 표현했습니다.
- [ ] API 응답 모델과 저장 모델을 구분했습니다.
- [ ] 스키마 선택이 요구 변화에 따라 바뀔 수 있음을 설명했습니다.

---

# 2. embedding과 reference
## 2-1. embedding 판단 질문
다음 신호가 많으면 포함을 먼저 검토합니다.

- 부모와 항상 함께 읽습니다.
- 부모 없이 독립적인 의미가 적습니다.
- 크기가 작고 최대 개수가 제한됩니다.
- 함께 원자적으로 변경해야 합니다.
- 중복 값이 바뀌지 않거나 과거 snapshot입니다.
- 별도 검색·페이지네이션이 거의 없습니다.

포함은 JOIN 없는 읽기와 한 문서 원자성을 주지만, 중복 갱신과 문서 성장 비용이 있습니다.

## 2-2. reference 판단 질문
다음 신호가 많으면 별도 컬렉션을 먼저 검토합니다.

- 여러 부모가 같은 대상을 공유합니다.
- 독립적으로 자주 읽고 변경합니다.
- 크기가 크거나 계속 성장합니다.
- 별도 권한·생명주기·삭제 정책이 있습니다.
- 중복 갱신 일관성 비용이 큽니다.
- 자식 목록을 독립적으로 검색·정렬·페이지 처리합니다.

참조는 source of truth를 한 곳에 두지만 추가 조회와 참조 무결성 관리가 필요합니다.

## 2-3. author 포함 구조
```js
author: {
  name: '김데이터',
  country: 'KR',
}
```

현재 예제에서는 도서 목록과 상세에서 항상 함께 읽고, author object가 작고, 변경 빈도가 낮다고 가정합니다.

비용:

- 김데이터 이름을 바꾸면 해당 저자의 모든 book 문서를 갱신해야 합니다.
- 서로 다른 표기가 섞일 수 있습니다.
- 독립 author 페이지에는 별도 구조가 필요할 수 있습니다.

## 2-4. publisher 참조 구조
books:

```js
{ publisherCode: 'DATA-LAB' }
```

publishers:

```js
{
  code: 'DATA-LAB',
  name: '데이터 연구소',
  website: 'https://example.com/data-lab',
}
```

publisher 정보는 독립적으로 관리되고 여러 책이 공유하며 website가 바뀔 수 있다고 가정합니다. book에는 참조 code만 둡니다.

비용:

- 도서와 출판사를 함께 보려면 추가 조회 또는 aggregation `$lookup`이 필요합니다.
- 존재하지 않는 code도 book 문서에 저장될 수 있습니다.
- publisher 삭제 시 book 참조 정리 정책이 필요합니다.

## 2-5. 필드별 결정표
| 필드 | 현재 단계 선택 | 근거 | 재검토 신호 |
| --- | --- | --- | --- |
| author summary | 포함 | 작고 항상 함께 읽음 | 독립 관리·잦은 변경 |
| categories | 포함 배열 | 작은 bounded set | 수천 개 tag·별도 metadata |
| inventory | 포함 객체 | 도서와 같은 생명주기 | 지점별 독립 재고·많은 warehouse |
| publisher | code 참조 | 공유·독립 변경 | 단순 snapshot만 필요 |
| reviews | 포함 배열 | 이 예제에서 매우 작음 | 대량 성장·페이지·신고/검색 |

각 행의 재검토 신호까지 적어야 모델 선택이 완전합니다.

## 2-6. snapshot vs live reference
주문 당시 상품 이름과 가격은 이후 상품 수정에 따라 바뀌면 안 될 수 있습니다. 이 경우 중복은 오류가 아니라 과거 사실을 보존하는 snapshot입니다. publisher website처럼 최신 값을 보여줘야 하는 필드는 live reference 후보입니다.

### 2단원 확인
- [ ] 포함과 참조의 신호를 각각 세 개 이상 말했습니다.
- [ ] author와 publisher 선택 근거를 비교했습니다.
- [ ] 필드별 재검토 조건을 적었습니다.
- [ ] 중복 snapshot과 실수로 생긴 중복을 구분했습니다.

---

# 3. 배열 성장과 일관성
## 3-1. bounded 배열
```js
categories: ['database', 'mongodb']
```

도서 카테고리는 업무 규칙상 최대 수가 작고 각 원소도 짧다고 가정할 수 있습니다. 이런 bounded 배열은 부모 문서에 포함하기 쉽습니다.

질문:

- 최대 몇 개인가?
- 원소 크기는 제한되는가?
- 순서가 의미 있는가?
- 중복을 허용하는가?
- 원소별 독립 조회가 필요한가?

## 3-2. unbounded 배열
```js
reviews: [
  { reviewer: '민지', score: 5, comment: '좋아요' },
  // 계속 추가
]
```

리뷰가 계속 늘 수 있으면 다음 문제가 생깁니다.

- 문서 크기 증가와 최대 크기 한계
- 한 리뷰 추가도 큰 문서 갱신과 관련된 비용
- 같은 book 문서에 쓰기 집중
- 모든 리뷰를 함께 읽는 불필요한 전송
- pagination, 신고, 검색, 권한 관리 어려움

대안은 `reviews` 컬렉션에 `bookId/isbn` reference를 두고 별도 index와 pagination을 사용하는 것입니다.

## 3-3. hot 문서
인기 도서 하나에 초당 수천 리뷰나 조회 카운트 update가 몰리면 하나의 문서가 쓰기 집중 지점이 됩니다. 한 문서 원자성은 장점이지만 모든 활동을 같은 문서에 모으는 것은 확장성 비용이 될 수 있습니다.

카운터 분할, 이벤트 컬렉션, batch 집계 등을 검토할 때 쓰기 빈도와 경합을 모델 판단 기준으로 기록합니다.

## 3-4. duplicate 데이터 일관성
author summary를 포함한 책 1,000권에서 이름을 바꾸는 흐름:

```text
대상 books 조회/count
  → updateMany author.name
  → matched/modified 확인
  → 이전 이름이 남은 document 재조회
  → 실패 batch 재처리
```

MongoDB가 모든 중복 author 이름을 하나의 source로 자동 인식하지 않습니다. duplication strategy를 선택하면 갱신 전략도 함께 설계합니다.

## 3-5. reference integrity
```js
{
  title: '잘못된 참조 책',
  publisherCode: 'NO-SUCH-PUBLISHER',
}
```

MongoDB는 SQL 외래 키처럼 이 값을 자동 거부하지 않습니다.

애플리케이션 전략:

1. book 생성 전 publisher 존재 조회
2. publisher code unique index
3. 삭제 전 참조 book 건수 확인
4. 삭제 거부, code 이전, snapshot 보존 중 정책 선택
5. 주기적인 orphan reference 검사

조회 후 insert 사이 동시 변경 가능성까지 생각하면 transaction 또는 업무 흐름 설계가 필요할 수 있습니다.

## 3-6. 실패 시나리오 활동
각 상황에 탐지 방법과 복구 방법을 적습니다.

| 실패 | 탐지 | 복구/예방 후보 |
| --- | --- | --- |
| 없는 publisherCode | lookup 결과 null | 생성 검증, orphan scan |
| author 이름 일부만 갱신 | 이전 이름 건수 | 재시도, source ID 병행 |
| categories 중복 | 배열 검사 | `$addToSet`, 입력 정규화 |
| reviews 과대 성장 | 문서 size/배열 건수 | 별도 컬렉션 migration |
| stock 문자열 혼입 | type 필터/validation | 스키마 validation, 정리 |

### 3단원 확인
- [ ] bounded/unbounded 배열 예를 들었습니다.
- [ ] hot 문서가 생기는 이유를 설명했습니다.
- [ ] duplication 선택에 갱신 전략이 필요함을 설명했습니다.
- [ ] MongoDB reference의 무결성 책임을 적었습니다.

---

# 4. 인덱스 원리와 실제 생성
## 4-1. 컬렉션 scan과 index scan 직관
ISBN 한 권을 찾을 때 index가 없다면 컬렉션의 문서를 처음부터 검사할 수 있습니다. 정렬된 ISBN index가 있으면 원하는 값의 위치를 빠르게 좁힐 수 있습니다.

```text
collection scan: [책1][책2][책3] ... 모두 검사
index lookup: 정렬된 key에서 978-...0002 위치 탐색 → document
```

실제 실행 계획은 데이터 규모, 쿼리, index, optimizer 판단에 따라 달라집니다. index가 존재한다고 항상 사용되는 것은 아닙니다.

## 4-2. `_id` index와 ISBN unique
모든 컬렉션에는 `_id` 고유 index가 있습니다. 업무에서는 ISBN으로 찾으므로 별도 index를 만듭니다.

```js
await books.createIndex({ isbn: 1 }, { unique: true })
```

이 index는 두 역할을 가집니다.

1. ISBN exact lookup 지원
2. 중복 ISBN 저장 거부

`findOne({ isbn })`는 읽기 API이고 unique index는 데이터 규칙입니다.

## 4-3. 검색 index
```js
await books.createIndex({ categories: 1 })
await books.createIndex({ 'inventory.stock': 1 })
```

- categories: category 목록 필터 지원
- inventory.stock: 재고 범위 필터·정렬 후보

`categories`는 배열이므로 multikey index가 됩니다. 배열의 각 원소를 검색 가능한 index entry로 다룹니다.

## 4-4. publisher code unique
```js
await publishers.createIndex({ code: 1 }, { unique: true })
```

같은 code를 가진 publisher 두 개를 막고 exact lookup을 지원합니다. book의 publisherCode가 존재하는지는 자동 보장하지 않습니다. target 컬렉션의 고유성과 reference integrity는 서로 다른 문제입니다.

## 4-5. index 목록 읽기
기준 코드:

```js
console.table(
  (await books.indexes()).map((index) => ({
    name: index.name,
    key: JSON.stringify(index.key),
    unique: index.unique ?? false,
  })),
)
```

예상 index:

| name | 키 | unique |
| --- | --- | --- |
| `_id_` | `{ _id: 1 }` | true 성격 |
| `isbn_1` | `{ isbn: 1 }` | true |
| `categories_1` | `{ categories: 1 }` | false |
| `inventory.stock_1` | `{ inventory.stock: 1 }` | false |

실제 출력 이름과 옵션을 확인합니다.

## 4-6. unique 실패와 index 비용
### 중복 ISBN 실패

sampleBooks insert 뒤 같은 ISBN을 넣습니다.

```js
try {
  const { _id, ...duplicateIsbnBook } = sampleBooks[0]

  await books.insertOne({
    ...duplicateIsbnBook,
    title: '중복 ISBN 실험',
  })
} catch (error) {
  console.log('unique 확인:', error.message)
}
```

기존 `_id`를 제외해야 `_id` 중복이 아니라 ISBN 중복을 정확히 실험할 수 있습니다. 오류의 index 이름이 `isbn_1`인지 확인합니다.

### index 비용

문서를 생성·수정·삭제할 때 관련 index도 갱신합니다.

- 저장 공간 사용
- write latency 증가
- index build 시간과 자원 사용
- 배열 원소가 많을수록 multikey entry 증가
- 사용하지 않는 index 유지 비용

모든 필드에 index를 만드는 대신 실제 쿼리 표에서 시작합니다.

### 4단원 확인
- [ ] unique index의 조회/제약 두 역할을 설명했습니다.
- [ ] categories index가 multikey인 이유를 설명했습니다.
- [ ] books index 목록을 실제로 확인했습니다.
- [ ] index의 write/storage 비용을 두 가지 이상 말했습니다.

---

# 5. 쿼리, 프로젝션, 정렬과 compound index
## 5-1. 기준 쿼리 분석
```js
const databaseBooks = await books
  .find(
    { categories: 'database' },
    {
      projection: {
        _id: 0,
        title: 1,
        'author.name': 1,
        publisherCode: 1,
        'inventory.stock': 1,
      },
    },
  )
  .sort({ publishedYear: -1 })
  .toArray()
```

접근 패턴:

- equality/배열 필터: categories = `database`
- 정렬: publishedYear descending
- 프로젝션: title, author.name, publisherCode, stock
- 결과: 여러 문서

현재 single index `categories_1`은 필터를 돕지만 정렬까지 최적으로 지원한다고 단정할 수 없습니다.

## 5-2. compound index 후보
반복 쿼리가 category exact 필터 + publishedYear descending 정렬라면:

```js
await books.createIndex({ categories: 1, publishedYear: -1 })
```

이 index는 categories가 첫 필드이므로 categories 조건에서 시작하는 쿼리에 사용할 수 있습니다. publishedYear만 조회하는 쿼리에는 항상 최선이라고 볼 수 없습니다.

다른 접근 패턴:

```text
filter: inventory.stock >= 2
sort: inventory.stock descending, title ascending
```

후보:

```js
await books.createIndex({ 'inventory.stock': -1, title: 1 })
```

실제 선택은 데이터 분포와 `explain()`으로 검증합니다.

## 5-3. index가 쿼리를 해결하지 않는 사례
`categories_1`가 있어도 다음 쿼리를 모두 해결하지는 않습니다.

- title 부분 문자열 검색
- author.name exact 검색
- publisherCode 필터
- publishedYear 단독 정렬
- review score 배열 검색

쿼리마다 index를 추가하기 전에 빈도, 데이터 크기, 지연 요구, write 비용을 평가합니다.

## 5-4. 프로젝션의 역할
프로젝션은 필요한 필드만 반환해 네트워크와 application object 크기를 줄입니다. 그러나 프로젝션 필드를 index에 모두 넣어 covered 쿼리를 만들겠다는 이유로 매우 큰 compound index를 무조건 추가하면 write/storage 비용이 커집니다.

현재 단계 프로젝션에서 `_id: 0`은 목록 화면에 내부 ID를 숨기기 위한 출력 선택입니다. 보안상 민감 필드는 애초 권한과 API 설계를 함께 봐야 합니다.

## 5-5. explain 관찰
실행 환경에서 다음을 추가해 plan을 관찰할 수 있습니다.

```js
const plan = await books
  .find({ categories: 'database' })
  .sort({ publishedYear: -1 })
  .explain('executionStats')

console.log(JSON.stringify(plan, null, 2))
```

확인 질문:

- winning plan에 index scan이 있는가?
- 정렬 스테이지가 별도로 있는가?
- examined 문서와 returned 문서 수는?
- 예시 3건에서 성능 차이를 일반화할 수 있는가?

작은 seed에서는 시간 차이가 의미 없으므로 plan 구조를 배우는 데 사용합니다.

## 5-6. 쿼리-index 매핑 활동
| 쿼리 | 현재 index | 추가 후보 | 우선순위 근거 |
| --- | --- | --- | --- |
| ISBN 상세 | isbn_1 unique | 없음 | 높음·고유 |
| category 목록 | categories_1 | categories+year | 빈도와 정렬 |
| 재고 범위 | inventory.stock_1 | stock+title | 목록 정렬 여부 |
| publisher books | 없음 | publisherCode_1 | 기능 빈도 확인 |
| author name | 없음 | author.name_1 | 독립 검색 요구 확인 |

### 5단원 확인
- [ ] 기준 쿼리의 필터/정렬/프로젝션을 분리했습니다.
- [ ] compound index 필드 순서에 근거를 제시했습니다.
- [ ] index가 없는 쿼리를 식별했습니다.
- [ ] explain을 성능 숫자와 실행 plan 검증 도구로 이해했습니다.

---

# 6. publisher 참조 조회와 모델 리뷰
## 6-1. 수동 reference 조회
기준 코드:

```js
const publisher = await publishers.findOne(
  { code: databaseBooks[0].publisherCode },
  { projection: { _id: 0 } },
)
```

두 단계입니다.

1. books 쿼리에서 publisherCode 읽기
2. publishers 컬렉션에서 같은 code 찾기

SQL JOIN처럼 한 쿼리 결과로 자동 결합된 것이 아닙니다.

## 6-2. missing reference 처리
```js
const publisher = await publishers.findOne({ code: book.publisherCode })

if (!publisher) {
  console.log(`출판사 참조를 찾지 못했습니다: ${book.publisherCode}`)
}
```

`databaseBooks[0]` 자체가 없을 수도 있으므로 배열 길이도 먼저 확인합니다. 빈 쿼리 결과와 missing publisher reference를 구분합니다.

## 6-3. 여러 book의 publisher 조회
각 book마다 findOne을 실행하면 N+1 쿼리가 될 수 있습니다. 작은 예제 데이터에서는 보이기 어렵지만 다음 대안을 검토합니다.

1. 필요한 code를 중복 제거해 `$in`으로 publisher 한 번 조회
2. Map으로 code→publisher 조합
3. aggregation `$lookup`
4. 자주 필요한 publisher name을 snapshot으로 함께 저장

예시:

```js
const codes = [...new Set(databaseBooks.map((book) => book.publisherCode))]
const rows = await publishers.find({ code: { $in: codes } }).toArray()
const byCode = new Map(rows.map((publisher) => [publisher.code, publisher]))
```

## 6-4. `$lookup` 확장 예
```js
const rows = await books
  .aggregate([
    { $match: { categories: 'database' } },
    {
      $lookup: {
        from: 'publishers_step5',
        localField: 'publisherCode',
        foreignField: 'code',
        as: 'publisher',
      },
    },
  ])
  .toArray()
```

`publisher`는 배열로 들어옵니다. `$lookup`을 쓸 수 있다는 사실이 모든 데이터를 참조로 나누라는 뜻은 아닙니다. Step 8 파이프라인 사고와 연결합니다.

## 6-5. 모델 리뷰 연습
다음 중 하나를 선택합니다.

### 쇼핑몰 상품/주문

- 상품의 현재 이름·가격
- 주문 당시 상품명·단가 snapshot
- 옵션 배열
- 리뷰
- seller reference

### 게시글/댓글

- author summary
- tags
- 댓글과 답글
- like 건수
- 첨부 파일 metadata

### 예약/공연

- 공연 정보 snapshot
- venue reference
- 좌석
- 예약자 정보
- 상태 변경 이력

기록 항목:

1. 읽기 패턴 3개
2. 쓰기 패턴 3개
3. 포함 필드와 근거
4. 참조 필드와 근거
5. 성장 위험 필드
6. source of truth
7. index 2개와 쿼리 근거
8. 무결성 실패와 대응

## 6-6. 마무리 확인
1. publisherCode unique index가 book의 고아 참조까지 막지 못하는 이유는?
2. categories index가 쓰기 비용을 늘리는 이유는?
3. 현재 단계 모델을 다시 설계하게 만들 가장 큰 요구 변화는?

---

# 7. 기준 코드 전체 흐름

```text
MongoDB 연결
  → books_step5, publishers_step5 선택
  → 두 collection 초기화
  → publishers.code unique index
  → books ISBN/category/stock index
  → publisher 2건 삽입
  → sampleBooks 3건 삽입
  → books index 목록 출력
  → database category query + projection + sort
  → 첫 book publisherCode로 publisher findOne
  → finally 연결 종료
```

## 7-1. index를 데이터 전에 생성

기준 코드는 초기화 직후 index를 만들고 예시 데이터를 삽입합니다. 중복 예시이 있다면 insert 단계에서 바로 실패합니다.

기존 대규모 컬렉션에 unique index를 추가할 때는 중복 데이터 정리와 build 영향, 배포 순서를 별도 계획해야 합니다.

## 7-2. sampleBooks 변화

step-5에서 각 book에 `publisherCode`가 추가됩니다.

```js
publisherCode: 'DATA-LAB'
```

첫 두 권은 DATA-LAB, 세 번째는 WEB-BOOKS를 참조합니다. 실제 publisher 문서가 자동 포함되거나 검증되는 것은 아닙니다.

## 7-3. 쿼리 결과의 첫 원소 의존

기준 코드는 `databaseBooks[0].publisherCode`를 사용합니다. 예시 기준에서는 결과가 있지만 일반 함수라면 빈 배열을 먼저 처리해야 합니다.

```js
if (databaseBooks.length === 0) {
  console.log('조건에 맞는 도서가 없습니다.')
  return
}
```

## 7-4. 컬렉션 분리

step-4의 `books_step4`와 step-5의 `books_step5`는 서로 다른 컬렉션입니다. 이전 단계 데이터를 migration하는 작업이 아니라 같은 예시를 다른 모델링 목적에 맞춰 재현합니다.

---

# 8. 모델링 예제 모음

## 예제 A. 지점별 재고

지점 수가 2~5개로 작고 도서 상세에서 모두 필요하다면:

```js
inventory: [
  { branchCode: 'SEOUL', stock: 3 },
  { branchCode: 'BUSAN', stock: 1 },
]
```

지점이 수천 개이고 재고 update가 독립적으로 매우 빈번하면 별도 inventory 컬렉션을 검토합니다.

## 예제 B. 주문 snapshot

```js
{
  orderNumber: 'O-1001',
  items: [
    {
      productId: 'P-10',
      productName: '주문 당시 이름',
      unitPrice: 15000,
      quantity: 2,
    },
  ],
}
```

productId reference와 주문 당시 name/price snapshot을 함께 둡니다. 어느 값이 최신 source이고 어느 값이 역사적 사실인지 문서화합니다.

## 예제 C. author ID + summary 혼합

```js
author: {
  id: authorId,
  nameSnapshot: '김데이터',
}
```

ID로 source를 찾으면서 목록에는 snapshot을 사용합니다. 이름 변경 시 즉시 동기화할지, eventual consistency를 허용할지 정책이 필요합니다.

## 예제 D. 리뷰 분리

```js
// books
{ _id: bookId, title: '...', reviewSummary: { count: 120, average: 4.3 } }

// reviews
{ bookId, reviewerId, score: 5, comment: '...', createdAt }
```

상세 목록은 reviews 컬렉션에서 page 조회하고, book에는 빠른 표시용 summary를 둘 수 있습니다. summary가 실제 reviews와 어긋날 때 재계산/복구 전략이 필요합니다.

## 예제 E. tag metadata

문자열 category만 필요하면 배열 포함이 단순합니다.

```js
categories: ['database', 'beginner']
```

각 category에 설명, 색상, 권한, 번역이 생기면 category 컬렉션과 reference code를 검토합니다.

## 예제 F. soft delete publisher

publisher를 실제 삭제하지 않고 `deletedAt`을 기록하면 기존 book reference를 보존할 수 있습니다. 하지만 일반 조회에서 비활성 publisher를 어떻게 표시할지 정책이 필요합니다.

---

# 9. 인덱스 예제와 반례

## 예제 A. publisherCode index

```js
await books.createIndex({ publisherCode: 1 })
```

publisher별 book 목록 쿼리가 자주 실행될 때 후보입니다. reference가 있다는 사실만으로 index가 자동 생성되지 않습니다.

## 예제 B. author.name index

```js
await books.createIndex({ 'author.name': 1 })
```

저자 이름 exact/prefix 검색이 실제 기능인지 확인합니다. author 이름 변경 시 index entry도 갱신됩니다.

## 예제 C. compound equality+정렬

```js
await books.createIndex({ publisherCode: 1, publishedYear: -1 })
```

publisher exact 필터와 최신순 목록에 맞을 수 있습니다.

## 반례 A. 낮은 선택성 boolean 단독 index

`courseSeed`가 거의 모두 true/false 한쪽이라면 단독 index의 효과가 제한될 수 있습니다. cleanup 쿼리 빈도와 데이터 분포를 봅니다.

## 반례 B. 모든 프로젝션 필드 index 포함

목록 응답을 cover하려고 title, author, inventory, categories를 모두 compound index에 넣으면 index가 커지고 update 비용이 늘어납니다. 실제 latency와 write workload를 측정해 판단합니다.

## 반례 C. 사용하지 않는 index

개발 초기에 예상해 만든 index가 production 쿼리에서 전혀 사용되지 않을 수 있습니다. 쿼리 log/metrics와 index usage를 검토하고 제거도 관리된 변경으로 수행합니다.

---

# 10. 연습 문제

## 모델링 기초

1. author를 포함한 이유 세 가지와 참조로 바꿀 신호 세 가지를 적습니다.
2. publisher를 참조한 이유와 추가 조회 비용을 적습니다.
3. categories가 bounded 배열라고 가정한 근거를 적습니다.
4. reviews가 unbounded가 될 때 별도 컬렉션 스키마를 설계합니다.
5. 주문 배송 주소가 중복이어도 snapshot으로 유효한 이유를 설명합니다.

## reference와 일관성

6. 없는 publisherCode book을 넣고 왜 저장되는지 설명합니다.
7. book 생성 전 publisher 존재를 확인하는 코드를 작성합니다.
8. publisher 삭제 전 참조 book 건수를 확인하는 절차를 작성합니다.
9. author 이름 updateMany 뒤 누락을 찾는 검증 쿼리를 작성합니다.
10. source of truth와 snapshot 필드를 함께 가진 모델을 제안합니다.

## index

11. `books.indexes()` 결과에서 unique와 multikey 후보를 구분합니다.
12. 같은 ISBN insert를 시도하고 오류를 기록합니다.
13. publishedYear index를 만들고 목록을 확인합니다.
14. category 필터 + year 정렬용 compound index를 제안합니다.
15. publisherCode exact lookup index의 필요성을 쿼리 빈도로 평가합니다.

## 쿼리와 프로젝션

16. `database` category이며 stock 2 이상인 book을 찾습니다.
17. title, author.name, stock만 프로젝션합니다.
18. publisherCode별 book 목록을 최신순으로 찾습니다.
19. 필요한 publisher code를 중복 제거해 `$in` 한 번으로 조회합니다.
20. `$lookup` 결과 publisher가 빈 배열인 orphan book을 찾는 파이프라인을 설계합니다.

<details>
<summary>힌트</summary>

- 같은 필터 객체의 categories와 inventory.stock은 AND입니다.
- 참조 확인은 `publishers.findOne({ code })` 후 없으면 insert를 중단합니다.
- category+year 후보는 `{ categories: 1, publishedYear: -1 }`입니다.
- orphan scan은 lookup 후 publisher 배열 크기 0을 match하는 방향을 검토합니다.
- 모델 답에는 선택 근거뿐 아니라 재검토 신호를 포함합니다.

</details>

---

# 11. 자주 만나는 문제와 진단

## unique index 생성이 실패합니다

index를 만들기 전에 이미 중복 ISBN이 있을 수 있습니다.

```js
await books
  .aggregate([
    { $group: { _id: '$isbn', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ])
  .toArray()
```

중복을 먼저 식별하고 어떤 문서를 유지할지 업무 기준으로 정리합니다. index 옵션에서 중복을 조용히 무시하는 방식으로 해결하지 않습니다.

## duplicate 키 오류가 납니다

오류의 index 이름과 키 value를 읽습니다. seed가 두 번 insert됐는지, ISBN 입력이 정말 새로운지 확인합니다. 현재 단계 코드는 먼저 컬렉션을 비우므로 예시 자체 중복도 점검합니다.

## index가 있는데 쿼리가 느립니다

- 쿼리 필드 path와 index 키가 같은지
- 필터와 정렬 순서에 compound index가 맞는지
- 데이터 선택성이 낮은지
- 프로젝션이 큰 필드를 반환하는지
- 쿼리 plan에서 실제 index를 쓰는지
- 서버 자원/네트워크 문제인지

를 분리합니다.

## categories index가 예상과 다릅니다

배열 필드 index는 multikey입니다. 여러 배열 필드를 한 compound multikey index에 넣는 데 제약이 있을 수 있으므로 실제 모델과 공식 제약을 확인합니다.

## publisher 조회가 null입니다

1. book의 publisherCode 실제 값
2. publisher code 대소문자·공백
3. publishers_step5 seed 존재
4. 올바른 데이터베이스/컬렉션
5. orphan reference 여부

순서로 봅니다.

## databaseBooks[0] 오류가 납니다

필터 결과가 빈 배열입니다. 첫 원소에 접근하기 전에 `databaseBooks.length`를 확인합니다.

## 프로젝션에 author.name이 보이지 않습니다

점 표기법과 실제 예시 필드를 확인합니다. `author.name`을 inclusion하고 상위 author 전체를 별도로 혼용하지 않습니다.

## 인덱스를 더 만들수록 write가 느려집니다

정상적인 trade-off입니다. insert/update마다 관련 index entry도 관리합니다. 사용 쿼리와 SLA로 필요한 index만 유지합니다.

## 포함/참조 토론에 정답이 없습니다

정답 하나가 없는 것이 정상입니다. 대신 접근 패턴, 크기, 변경, 일관성, 생명주기 근거가 빠졌는지 평가합니다.

---

# 12. 이해 점검

## 문항

1. 접근 패턴에서 모델을 시작해야 하는 이유를 쓰세요.
2. author embedding의 장점과 변경 비용을 하나씩 쓰세요.
3. publisher reference의 장점과 조회 비용을 하나씩 쓰세요.
4. bounded와 unbounded 배열을 categories/reviews로 설명하세요.
5. source of truth와 snapshot의 차이를 주문 예로 설명하세요.
6. publisherCode reference가 자동 보장하지 않는 두 가지는?
7. ISBN unique index의 두 역할은?
8. categories index가 multikey가 되는 이유는?
9. index의 쓰기·저장 비용을 설명하세요.
10. category 필터 + year 정렬 쿼리의 compound index 후보와 근거는?

<details>
<summary>확인 기준</summary>

1. 실제 필터/정렬/프로젝션/update를 만족하는 저장 구조가 필요함을 설명합니다.
2. 한 번 읽기와 여러 book 중복 갱신을 함께 봅니다.
3. publisher source 한 곳 관리와 추가 쿼리/lookup을 함께 봅니다.
4. 최대 크기 제한 여부와 문서 성장 문제를 설명합니다.
5. 최신 원본과 과거 시점 복사본을 구분합니다.
6. 존재 보장과 삭제 시 참조 정리 등을 적습니다.
7. exact lookup과 duplicate 거부입니다.
8. 배열 각 원소가 index entry 대상이 되기 때문입니다.
9. insert/update/delete 시 index 갱신과 별도 공간을 포함합니다.
10. `{ categories: 1, publishedYear: -1 }`와 equality/필터 후 정렬 근거를 제시합니다.

</details>

답을 위 확인 기준과 비교하고 근거가 부족한 항목은 관련 절의 실행 결과를 다시 확인합니다.

---

# 저장소에 기록하기

실험용 데이터를 정리하고 `npm run check`를 통과시킨 뒤 현재 단계의 코드와 기록을 저장합니다.

```powershell
git branch --show-current
git status --short
npm run check
git add .
git commit -m "Complete database step 5"
git push
git status --short --branch
```

`main`과 `origin/main`이 같은 commit을 가리키고 작업 파일 목록이 비어 있으면 마쳤습니다.

# 13. 완료 기준

- [ ] 읽기·쓰기 접근 패턴을 각각 네 개 이상 적었습니다.
- [ ] author embedding과 publisher reference의 근거·비용을 설명했습니다.
- [ ] categories/inventory/reviews의 포함 결정을 평가했습니다.
- [ ] bounded와 unbounded 배열을 구분했습니다.
- [ ] duplicate snapshot과 source of truth를 구분했습니다.
- [ ] MongoDB reference 무결성 책임을 설명했습니다.
- [ ] books/publishers index를 생성하고 목록을 확인했습니다.
- [ ] duplicate ISBN 오류를 실제로 확인했습니다.
- [ ] categories multikey와 stock nested index를 설명했습니다.
- [ ] 기준 쿼리의 필터/프로젝션/정렬을 분리했습니다.
- [ ] compound index 후보에 쿼리 근거를 제시했습니다.
- [ ] publisherCode로 별도 문서를 조회했습니다.
- [ ] 빈 book 결과와 missing publisher를 처리했습니다.
- [ ] 다른 도메인 모델 review를 완료했습니다.
- [ ] 이해 점검의 답을 실행 결과와 비교했습니다.

## 다시 확인할 항목

1. author/publisher 포함·참조 결정표
2. categories/reviews 성장 비교
3. ISBN unique index와 중복 실패
4. categories·stock index 목록 확인
5. `database` category 조회와 publisher 추가 조회

## 추가 연습

1. category+publishedYear compound index와 explain 비교
2. 여러 publisher `$in` batch 조회
3. `$lookup`으로 books-publishers 결합
4. orphan reference 탐지 파이프라인
5. 리뷰 분리 모델과 summary 일관성 복구 설계

## 적용 질문

`books_course`에 CLI 입력을 저장하려면 터미널 문자열을 숫자·배열·중첩 문서로 변환하고 검증해야 합니다.

> 터미널의 stock 값은 항상 문자열이다. 빈 문자열, `-1`, `1.5`, `abc`를 데이터베이스에 보내기 전에 어떤 계층에서 어떤 메시지로 막아야 할까?
