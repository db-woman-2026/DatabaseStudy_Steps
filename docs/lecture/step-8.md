# Step 8. 복합 JSON, Aggregation, CRUD 종합

리뷰를 배열에 추가하고 aggregation 파이프라인으로 재고·카테고리·리뷰 보고서를 만듭니다. 생성, 조회, 검색, 수정, 삭제 결과를 데이터 모델과 검증 절차로 설명합니다.

## 0. 먼저 생각할 질문

1. reviewer, score, comment 문자열을 어떤 검증을 거쳐 review subdocument로 만드는가?
2. review를 book에 포함한 이유와 컬렉션으로 분리할 시점은 언제인가?
3. aggregation 파이프라인의 각 스테이지는 입력 문서를 어떤 출력 문서로 바꾸는가?
4. `$unwind` 뒤 문서 수는 왜 늘거나 0이 될 수 있는가?
5. `$group`의 `_id`, `$sum`, `$avg`, `$first`는 각각 무엇을 의미하는가?
6. 리뷰가 없는 도서를 보고서에 남기거나 제외하는 선택을 어떻게 명시하는가?
7. 전체 CRUD에서 각 작업의 사전/사후 증거는 무엇인가?
8. 같은 요구를 RDBMS와 MongoDB 중 어디에 모델링할지 어떤 기준으로 결정하는가?

## 1. 완료 목표

### 개념

- embedded review 문서와 unbounded 배열 위험을 설명합니다.
- `$push`와 `$addToSet`의 중복 정책을 비교합니다.
- 파이프라인과 단일 find 쿼리의 역할 차이를 설명합니다.
- `$match`, `$project`, `$unwind`, `$group`, `$sort`의 입출력을 설명합니다.
- 집계 accumulator `$sum`, `$avg`, `$first`, `$min`, `$max`를 구분합니다.
- RDBMS JOIN/GROUP BY/transaction과 MongoDB embedding/aggregation/atomic update를 비교합니다.

### 실습

- score 1~5 정수와 필수 text를 검증합니다.
- review subdocument를 `$push`로 특정 ISBN book에 추가합니다.
- 전체 book 건수·total/average stock을 집계합니다.
- categories를 unwind하여 category별 book 건수·stock을 집계합니다.
- reviews를 unwind하여 book별 review 건수·average score를 집계합니다.
- 빈 배열 보존 옵션과 조건 집계를 설계합니다.
- 전체 CRUD 명령을 순서대로 실행하고 state ledger를 작성합니다.
- 요구사항 하나를 골라 mini project 모델·명령·index·test를 설계합니다.

### 작업 원칙

- aggregation 최종 결과만 보지 않고 스테이지별 중간 문서를 관찰합니다.
- 평균값이 어떤 입력을 포함/제외했는지 설명합니다.
- review 중복, 배열 성장, 삭제 복구 정책을 미리 정합니다.
- 전체 실습을 마친 뒤 seed로 초기화하기 전에 결과물을 보존합니다.
- 제품 선택을 선호가 아니라 접근 패턴과 일관성 요구로 설명합니다.

## 2. 완료 결과

- review 입력→subdocument mapping과 validation test
- add-review 전후 문서 비교
- 세 파이프라인의 스테이지별 문서 수·shape 추적표
- 리뷰 없는 book 포함/제외 두 보고서
- 전체 CRUD state ledger와 명령 출력
- 최종 mini project 설계서 또는 구현
- RDBMS/MongoDB 선택 비교 답안과 종합 점검

## 3. 시작 전 준비

> Windows 11에서는 [환경 준비](../windows-11.md) <span class="print-reference" data-print-reference="true">(Database · Windows 11 x64 실습 환경 준비 · 1. Windows Terminal 설치)</span>를 먼저 확인합니다. 명령은 이 교재의 PowerShell 코드 블록에 적힌 `git`, `node`, `npm` 형태를 그대로 사용합니다.

```powershell
git branch --show-current
git status
```

아래에서 소스와 test 파일 전체를 입력한 뒤 검사합니다.

## 4. 소스 파일 전체 입력

개인 저장소의 기존 파일을 아래 전체 내용으로 바꿉니다. 이 저장소의 `step-N` 기준 브랜치로 이동하지 않습니다.

### `index.js`

`index.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
const {
  createBookDocument,
  createReviewDocument,
  escapeRegex,
  parseStock,
} = require("./lib/bookInput")
const { sampleBooks } = require("./lib/sampleBooks")
const { withDatabase } = require("./lib/mongodb")

function showHelp() {
  console.log(`
MongoDB CRUD 응용

기준 데이터:
  npm start -- seed

생성·조회:
  npm start -- list [category]
  npm start -- get <isbn>
  npm start -- add <isbn> <title> <author> <stock> [categories]

조건 검색·수정·삭제:
  npm start -- search <keyword> [minStock]
  npm start -- update-stock <isbn> <stock>
  npm start -- add-category <isbn> <category>
  npm start -- add-review <isbn> <reviewer> <score> <comment>
  npm start -- remove <isbn> confirm

종합 조회:
  npm start -- stats
`)
}

async function prepareCollection(database) {
  const books = database.collection("books_course")
  await books.createIndex({ isbn: 1 }, { unique: true })
  await books.createIndex({ categories: 1 })
  return books
}

async function seedBooks(books) {
  await books.deleteMany({})
  const result = await books.insertMany(sampleBooks)
  console.log(`샘플 도서 ${result.insertedCount}권 생성`)
}

async function listBooks(books, category) {
  const normalizedCategory = String(category ?? "").trim().toLowerCase()
  const filter = normalizedCategory ? { categories: normalizedCategory } : {}
  const rows = await books
    .find(filter, {
      projection: {
        _id: 0,
        isbn: 1,
        title: 1,
        "author.name": 1,
        categories: 1,
        "inventory.stock": 1,
      },
    })
    .sort({ title: 1 })
    .toArray()

  console.log(`조회 결과: ${rows.length}권`)
  console.log(JSON.stringify(rows, null, 2))
}

async function getBook(books, isbn) {
  if (!isbn) {
    throw new Error("조회할 isbn을 입력하세요.")
  }

  const book = await books.findOne({ isbn }, { projection: { _id: 0 } })

  if (!book) {
    console.log("도서를 찾지 못했습니다.")
    return null
  }

  console.log(JSON.stringify(book, null, 2))
  return book
}

async function addBook(books, args) {
  const book = createBookDocument(args)
  const result = await books.insertOne(book)
  console.log(`도서 생성 완료: ${book.isbn}, id=${result.insertedId}`)
  await getBook(books, book.isbn)
}

async function searchBooks(books, keywordValue, minStockValue) {
  const keyword = String(keywordValue ?? "").trim()

  if (!keyword) {
    throw new Error("검색어를 입력하세요.")
  }

  const pattern = new RegExp(escapeRegex(keyword), "i")
  const filter = {
    $or: [
      { title: pattern },
      { "author.name": pattern },
      { categories: pattern },
    ],
  }

  if (minStockValue !== undefined) {
    filter["inventory.stock"] = { $gte: parseStock(minStockValue) }
  }

  const rows = await books
    .find(filter, { projection: { _id: 0, isbn: 1, title: 1, inventory: 1 } })
    .sort({ "inventory.stock": -1 })
    .toArray()

  console.log(`검색 결과: ${rows.length}권`)
  console.table(rows)
}

async function updateStock(books, isbn, stockValue) {
  const stock = parseStock(stockValue)
  const target = await books.findOne(
    { isbn },
    { projection: { _id: 0, isbn: 1, title: 1, inventory: 1 } },
  )

  if (!target) {
    console.log("수정할 도서를 찾지 못했습니다.")
    return
  }

  console.log("수정 전", target)
  const result = await books.updateOne(
    { isbn },
    { $set: { "inventory.stock": stock, updatedAt: new Date() } },
  )
  console.log(`수정 결과: matched=${result.matchedCount}, changed=${result.modifiedCount}`)
  await getBook(books, isbn)
}

async function addCategory(books, isbn, categoryValue) {
  const category = String(categoryValue ?? "").trim().toLowerCase()

  if (!category) {
    throw new Error("추가할 category를 입력하세요.")
  }

  const result = await books.updateOne(
    { isbn },
    {
      $addToSet: { categories: category },
      $set: { updatedAt: new Date() },
    },
  )
  console.log(`category 결과: matched=${result.matchedCount}, changed=${result.modifiedCount}`)
  await getBook(books, isbn)
}

async function addReview(books, isbn, args) {
  const review = createReviewDocument(args)
  const target = await books.findOne(
    { isbn },
    { projection: { _id: 0, isbn: 1, title: 1 } },
  )

  if (!target) {
    console.log("리뷰를 추가할 도서를 찾지 못했습니다.")
    return
  }

  console.log("리뷰 추가 대상", target)
  const result = await books.updateOne(
    { isbn },
    {
      $push: { reviews: review },
      $set: { updatedAt: new Date() },
    },
  )
  console.log(`리뷰 추가 결과: ${result.modifiedCount}건`)
  await getBook(books, isbn)
}

async function removeBook(books, isbn, confirmation) {
  const target = await books.findOne(
    { isbn },
    { projection: { _id: 0, isbn: 1, title: 1 } },
  )

  if (!target) {
    console.log("삭제할 도서를 찾지 못했습니다.")
    return
  }

  console.log("삭제 대상", target)

  if (confirmation !== "confirm") {
    console.log("삭제하려면 마지막 인자로 confirm을 입력하세요.")
    return
  }

  const result = await books.deleteOne({ isbn })
  console.log(`삭제 결과: ${result.deletedCount}건`)
}

async function showStats(books) {
  const inventorySummary = await books
    .aggregate([
      {
        $group: {
          _id: null,
          bookCount: { $sum: 1 },
          totalStock: { $sum: "$inventory.stock" },
          averageStock: { $avg: "$inventory.stock" },
        },
      },
      { $project: { _id: 0 } },
    ])
    .toArray()

  const categorySummary = await books
    .aggregate([
      { $unwind: "$categories" },
      {
        $group: {
          _id: "$categories",
          bookCount: { $sum: 1 },
          totalStock: { $sum: "$inventory.stock" },
        },
      },
      { $sort: { bookCount: -1, _id: 1 } },
    ])
    .toArray()

  const reviewSummary = await books
    .aggregate([
      { $unwind: "$reviews" },
      {
        $group: {
          _id: "$isbn",
          title: { $first: "$title" },
          reviewCount: { $sum: 1 },
          averageScore: { $avg: "$reviews.score" },
        },
      },
      { $sort: { averageScore: -1, title: 1 } },
    ])
    .toArray()

  console.log("전체 재고 요약")
  console.table(inventorySummary)
  console.log("카테고리별 요약")
  console.table(categorySummary)
  console.log("리뷰가 있는 도서 요약")
  console.table(reviewSummary)
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2)

  if (command === "help") {
    showHelp()
    return
  }

  await withDatabase(async (database, databaseName) => {
    const books = await prepareCollection(database)
    console.log(`database: ${databaseName}`)

    const commands = {
      seed: () => seedBooks(books),
      list: () => listBooks(books, args[0]),
      get: () => getBook(books, args[0]),
      add: () => addBook(books, args),
      search: () => searchBooks(books, args[0], args[1]),
      "update-stock": () => updateStock(books, args[0], args[1]),
      "add-category": () => addCategory(books, args[0], args[1]),
      "add-review": () => addReview(books, args[0], args.slice(1)),
      remove: () => removeBook(books, args[0], args[1]),
      stats: () => showStats(books),
    }

    const runCommand = commands[command]

    if (!runCommand) {
      showHelp()
      throw new Error(`알 수 없는 command: ${command}`)
    }

    await runCommand()
  })
}

main().catch((error) => {
  console.error("MongoDB CRUD 실습 실패")
  console.error(error.message)
  process.exitCode = 1
})
~~~

### `lib/bookInput.js`

`lib/bookInput.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
function requireText(value, fieldName) {
  const text = String(value ?? "").trim()

  if (!text) {
    throw new Error(`${fieldName} 값을 입력하세요.`)
  }

  return text
}

function parseStock(value) {
  const text = String(value ?? "").trim()

  if (!text) {
    throw new Error("stock 값을 입력하세요.")
  }

  const stock = Number(text)

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("stock은 0 이상의 정수여야 합니다.")
  }

  return stock
}

function parseCategories(value) {
  const categories = String(value ?? "")
    .split(",")
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set(categories)]
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseScore(value) {
  const score = Number(value)

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error("score는 1부터 5 사이의 정수여야 합니다.")
  }

  return score
}

function createReviewDocument(args) {
  const [reviewerValue, scoreValue, commentValue] = args

  return {
    reviewer: requireText(reviewerValue, "reviewer"),
    score: parseScore(scoreValue),
    comment: requireText(commentValue, "comment"),
    createdAt: new Date(),
  }
}

function createBookDocument(args) {
  const [isbnValue, titleValue, authorValue, stockValue, categoriesValue] = args

  return {
    isbn: requireText(isbnValue, "isbn"),
    title: requireText(titleValue, "title"),
    author: {
      name: requireText(authorValue, "author"),
      country: "KR",
    },
    categories: parseCategories(categoriesValue),
    publisherCode: "STUDENT",
    inventory: {
      stock: parseStock(stockValue),
      location: "PRACTICE",
    },
    publishedYear: new Date().getFullYear(),
    reviews: [],
    courseSeed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

module.exports = {
  createBookDocument,
  createReviewDocument,
  escapeRegex,
  parseCategories,
  parseScore,
  parseStock,
}
~~~

### `test/bookInput.test.js`

`test/bookInput.test.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
const assert = require("node:assert/strict")
const test = require("node:test")
const {
  createBookDocument,
  createReviewDocument,
  escapeRegex,
  parseCategories,
  parseScore,
  parseStock,
} = require("../lib/bookInput")

test("parseStock은 0 이상의 정수를 반환한다", () => {
  assert.equal(parseStock("3"), 3)
  assert.equal(parseStock(" 3 "), 3)
  assert.equal(parseStock(0), 0)
})

test("escapeRegex는 검색어의 정규식 기호를 일반 문자로 바꾼다", () => {
  assert.equal(escapeRegex("Node.js (기초)"), "Node\\.js \\(기초\\)")
})

test("parseStock은 빈 값, 음수, 소수를 거부한다", () => {
  assert.throws(() => parseStock(""), /stock 값을 입력/)
  assert.throws(() => parseStock("   "), /stock 값을 입력/)
  assert.throws(() => parseStock(), /stock 값을 입력/)
  assert.throws(() => parseStock("-1"), /0 이상의 정수/)
  assert.throws(() => parseStock("1.5"), /0 이상의 정수/)
  assert.throws(() => parseStock("abc"), /0 이상의 정수/)
})

test("parseCategories는 공백과 중복을 정리한다", () => {
  assert.deepEqual(parseCategories(" Database, beginner, database "), [
    "database",
    "beginner",
  ])
})

test("createBookDocument는 CLI 값을 중첩 문서로 바꾼다", () => {
  const book = createBookDocument([
    "978-test",
    "테스트 도서",
    "테스트 저자",
    "2",
    "database,mongodb",
  ])

  assert.equal(book.isbn, "978-test")
  assert.equal(book.author.name, "테스트 저자")
  assert.equal(book.inventory.stock, 2)
  assert.deepEqual(book.categories, ["database", "mongodb"])
})

test("parseScore는 1부터 5 사이 정수만 허용한다", () => {
  assert.equal(parseScore("5"), 5)
  assert.throws(() => parseScore("0"), /1부터 5/)
  assert.throws(() => parseScore("6"), /1부터 5/)
})

test("createReviewDocument는 리뷰 입력을 중첩 문서로 바꾼다", () => {
  const review = createReviewDocument(["민지", "4", "도움이 됐어요."])

  assert.equal(review.reviewer, "민지")
  assert.equal(review.score, 4)
  assert.equal(review.comment, "도움이 됐어요.")
  assert.ok(review.createdAt instanceof Date)
})
~~~

### 입력 후 검사

```powershell
npm run check
npm test
```

MongoDB 실행에서 연결 오류가 나면 코드부터 바꾸지 않고 Windows 서비스와 `.env` 값을 먼저 확인합니다.


기준 상태:

```powershell
npm run check
npm test
npm start -- help
npm start -- seed
npm start -- list
npm start -- stats
```

MongoDB 서버와 전용 `.env`가 필요합니다. `seed`는 `books_course`를 3건으로 초기화하므로 이전 실습 산출물을 먼저 기록합니다.

# 1. review subdocument Create/Update
## 1-1. 명령과 argv
```powershell
npm start -- add-review 978-00-0001 민지 5 "실습 흐름이 이해하기 쉬웠어요."
```

명령 map 전달:

```js
'add-review': () => addReview(books, args[0], args.slice(1))
```

- `args[0]`: ISBN
- `args.slice(1)`: reviewer, score, comment

comment에 공백이 있으므로 shell 따옴표가 필요합니다.

## 1-2. score validation
```js
function parseScore(value) {
  const score = Number(value)

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('score는 1부터 5 사이의 정수여야 합니다.')
  }

  return score
}
```

입력 matrix:

| 입력 | 기대 |
| --- | --- |
| 1 | 허용 하한 |
| 5 | 허용 상한 |
| 0 | 범위 오류 |
| 6 | 범위 오류 |
| 4.5 | 정수 오류 |
| abc | numeric 오류 |
| 누락 | 오류 |

## 1-3. review 문서 변환
```js
function createReviewDocument(args) {
  const [reviewerValue, scoreValue, commentValue] = args

  return {
    reviewer: requireText(reviewerValue, 'reviewer'),
    score: parseScore(scoreValue),
    comment: requireText(commentValue, 'comment'),
    createdAt: new Date(),
  }
}
```

raw string 네트워크/CLI 입력을 DB에 보내기 전에 canonical 문서로 만듭니다. 현재 review에는 독립 `_id`가 없습니다. 수정·삭제 요구가 생기면 배열 원소 식별 전략을 추가해야 합니다.

## 1-4. 대상 확인
```js
const target = await books.findOne(
  { isbn },
  { projection: { _id: 0, isbn: 1, title: 1 } },
)

if (!target) {
  console.log('리뷰를 추가할 도서를 찾지 못했습니다.')
  return
}
```

review 문서는 입력 변환 후 만들어졌지만 target book이 없으면 insert하지 않습니다. 없음은 정상 메시지이고 score 오류는 입력 오류입니다.

## 1-5. `$push`
```js
const result = await books.updateOne(
  { isbn },
  {
    $push: { reviews: review },
    $set: { updatedAt: new Date() },
  },
)
```

`$push`는 같은 내용도 매번 추가합니다. 중복 review 정책은 현재 없습니다.

가능한 중복 방지 전략:

- client-generated request ID에 unique 정책
- review ID와 재시도 idempotency 키
- 같은 reviewer가 book당 하나만 허용하는 별도 reviews 컬렉션 + compound unique index
- `$addToSet`은 전체 object가 정확히 같을 때만 중복 방지하며 Date가 다르면 다른 object

## 1-6. 전후 검증
실행 전:

```powershell
npm start -- get 978-00-0001
```

기준 reviews 길이는 0입니다. add-review 후:

- modifiedCount 1 예상
- reviews 길이 1
- reviewer/score/comment 정확
- createdAt Date
- updatedAt 변경

같은 명령을 다시 실행하면 reviews 길이는 2입니다. 의도된 `$push` 동작인지 product rule을 토론합니다.

### 1단원 확인
- [ ] score 정상·경계·오류 test를 실행했습니다.
- [ ] review subdocument shape를 설명했습니다.
- [ ] 대상 없음과 입력 오류를 구분했습니다.
- [ ] `$push` 재실행의 중복 정책을 설명했습니다.

---

# 2. Aggregation 파이프라인 사고와 전체 재고
## 2-1. 파이프라인은 변환 단계의 배열
```js
books.aggregate([
  stage1,
  stage2,
  stage3,
])
```

각 스테이지는 앞 스테이지의 출력 문서 stream을 입력으로 받습니다.

```text
collection documents
  → stage 1 output
  → stage 2 output
  → stage 3 output
  → cursor
  → toArray
```

순서를 바꾸면 결과와 비용이 달라질 수 있습니다.

## 2-2. find와 aggregate 비교
### find

- 조건에 맞는 원본 문서를 조회
- 프로젝션/정렬/limit 구성
- 간단한 목록·상세에 적합

### aggregate

- 문서 shape 변환
- 배열 펼침
- 그룹/통계
- 컬렉션 결합
- 여러 스테이지의 보고서/가공에 적합

간단한 exact 조회를 무조건 aggregate로 바꾸지 않습니다.

## 2-3. 전체 재고 파이프라인
```js
const inventorySummary = await books
  .aggregate([
    {
      $group: {
        _id: null,
        bookCount: { $sum: 1 },
        totalStock: { $sum: '$inventory.stock' },
        averageStock: { $avg: '$inventory.stock' },
      },
    },
    { $project: { _id: 0 } },
  ])
  .toArray()
```

seed 예상:

- bookCount: 3
- totalStock: 9
- averageStock: 3

## 2-4. `_id: null` 그룹
`$group._id`는 그룹 키입니다.

- `_id: null`: 모든 입력 문서를 한 그룹으로 묶음
- `_id: '$publisherCode'`: publisherCode별 그룹
- `_id: '$publishedYear'`: 출판 연도별 그룹
- object `_id`: 여러 필드 조합 그룹

SQL의 GROUP BY가 없는 전체 aggregate와 비슷하지만 파이프라인 문서 모양을 직접 만듭니다.

## 2-5. accumulator
| accumulator | 의미 | 현재 단계 예 |
| --- | --- | --- |
| `$sum: 1` | 입력 문서 수 | bookCount |
| `$sum: '$field'` | 숫자 합 | totalStock |
| `$avg` | 평균 | averageStock |
| `$min`, `$max` | 최소/최대 | stock range |
| `$first` | 그룹 순서의 첫 값 | title 대표 |
| `$push` | 그룹 값 배열 | title 목록 |

aggregation의 `$push` accumulator와 update의 `$push` 연산자는 이름은 같아도 문맥과 역할이 다릅니다.

## 2-6. `$project`
```js
{ $project: { _id: 0 } }
```

group이 만든 `_id: null`을 최종 출력에서 제거합니다. source 컬렉션을 바꾸지 않고 파이프라인 출력 shape만 바꿉니다.

### 2단원 확인
- [ ] 파이프라인 스테이지의 입출력 흐름을 그렸습니다.
- [ ] find와 aggregate 사용 목적을 구분했습니다.
- [ ] 전체 재고 예상값을 손으로 계산했습니다.
- [ ] group `_id`가 그룹 키임을 설명했습니다.

---

# 3. `$unwind`와 category/review 집계
## 3-1. categories unwind
입력:

```js
{
  isbn: '978-00-0001',
  categories: ['database', 'beginner'],
  inventory: { stock: 3 },
}
```

스테이지:

```js
{ $unwind: '$categories' }
```

출력 개념:

```js
{ isbn: '978-00-0001', categories: 'database', inventory: { stock: 3 } }
{ isbn: '978-00-0001', categories: 'beginner', inventory: { stock: 3 } }
```

한 문서가 배열 원소 수만큼 복제되어 각 원소가 scalar 필드가 됩니다.

## 3-2. seed 문서 수 추적
각 book category 수는 2개이므로:

```text
입력 books: 3
categories unwind 후: 6
```

category별 group 결과:

- beginner: book 2, total stock 4
- `database`: book 2, total stock 8
- mongodb: book 1, total stock 5
- nodejs: book 1, total stock 1

한 book의 stock이 category마다 한 번씩 기여합니다. 모든 category totalStock을 다시 합치면 전체 stock 9보다 커집니다. category가 겹치기 때문입니다.

## 3-3. category 파이프라인
```js
const categorySummary = await books
  .aggregate([
    { $unwind: '$categories' },
    {
      $group: {
        _id: '$categories',
        bookCount: { $sum: 1 },
        totalStock: { $sum: '$inventory.stock' },
      },
    },
    { $sort: { bookCount: -1, _id: 1 } },
  ])
  .toArray()
```

결과 한 문서는 category 하나입니다. `_id` 값은 category 문자열입니다.

## 3-4. review unwind
seed reviews 길이:

```text
book 1: 0
book 2: 1
book 3: 0
```

기본 `$unwind: '$reviews'`에서는 빈 배열 문서가 출력에서 사라집니다. unwind 후 1 문서만 남습니다.

## 3-5. review group
```js
const reviewSummary = await books
  .aggregate([
    { $unwind: '$reviews' },
    {
      $group: {
        _id: '$isbn',
        title: { $first: '$title' },
        reviewCount: { $sum: 1 },
        averageScore: { $avg: '$reviews.score' },
      },
    },
    { $sort: { averageScore: -1, title: 1 } },
  ])
  .toArray()
```

결과 한 문서는 리뷰가 있는 book 한 권입니다. seed에서는 MongoDB 첫걸음만 나옵니다.

## 3-6. `$first` 주의
같은 ISBN group의 모든 title이 같다는 모델 가정으로 `$first`를 사용합니다. `$first`가 시간상 첫 review라는 뜻은 아닙니다. 특정 순서의 첫 값을 원하면 `$sort` 스테이지를 앞에 두어야 합니다.

### 3단원 확인
- [ ] unwind 전후 문서 수를 계산했습니다.
- [ ] category total을 합치면 전체 stock과 다른 이유를 설명했습니다.
- [ ] 빈 reviews book이 사라지는 이유를 설명했습니다.
- [ ] review group 한 결과의 의미를 설명했습니다.

---

# 4. 빈 배열, 통계 의미, 파이프라인 확장
## 4-1. 리뷰 없는 book 보존
```js
{
  $unwind: {
    path: '$reviews',
    preserveNullAndEmptyArrays: true,
  },
}
```

빈 배열/missing/null인 book도 한 출력 문서로 남깁니다. 이 상태에서 `$sum: 1`을 사용하면 빈 review book도 reviewCount 1로 잘못 셉니다.

조건 건수가 필요합니다.

```js
reviewCount: {
  $sum: {
    $cond: [
      { $ne: ['$reviews.score', null] },
      1,
      0,
    ],
  },
}
```

averageScore는 review가 없으면 null일 수 있습니다. 0점으로 표시하면 실제 0점 review와 혼동되지만 score 범위가 1~5라 표시 정책으로 0을 쓸 수도 있습니다. 의미를 문서화합니다.

## 4-2. 스테이지별 debugging
최종 파이프라인이 예상과 다르면 한 스테이지씩 실행합니다.

```js
const afterUnwind = await books
  .aggregate([
    { $unwind: '$categories' },
    { $limit: 10 },
  ])
  .toArray()
```

확인 순서:

1. 입력 문서 1건 shape
2. unwind 후 건수와 필드 type
3. group 키와 accumulator 입력
4. 정렬 키 존재
5. final project 필드

SQL JOIN/GROUP BY 디버깅과 마찬가지로 중간 데이터를 봅니다.

## 4-3. `$match` 위치
`database` category의 review만 보고 싶다면 가능한 한 일찍 필터합니다.

```js
[
  { $match: { categories: 'database' } },
  { $unwind: '$reviews' },
  { /* group */ },
]
```

앞 `$match`는 뒤 스테이지가 처리할 문서를 줄이고 적절한 index를 활용할 가능성을 높입니다. 하지만 unwind 뒤 배열 원소 조건처럼 스테이지 순서상 뒤에 match해야 하는 요구도 있습니다.

## 4-4. `$project`와 계산 필드
```js
{
  $project: {
    _id: 0,
    isbn: 1,
    title: 1,
    stock: '$inventory.stock',
    categoryCount: { $size: '$categories' },
    reviewCount: { $size: '$reviews' },
  },
}
```

필드 이름 변경과 계산 값을 포함한 출력 문서를 만듭니다. categories/reviews가 missing이면 `$size` 오류 가능성이 있으므로 스키마 일관성 또는 `$ifNull`을 검토합니다.

## 4-5. publisher별 summary
```js
const publisherSummary = await books
  .aggregate([
    {
      $group: {
        _id: '$publisherCode',
        bookCount: { $sum: 1 },
        totalStock: { $sum: '$inventory.stock' },
        newestYear: { $max: '$publishedYear' },
      },
    },
    { $sort: { bookCount: -1, _id: 1 } },
  ])
  .toArray()
```

STUDENT book을 add하면 새 group이 생깁니다. publisher name이 필요하면 publishers 컬렉션과 `$lookup` 또는 application 조합이 필요합니다.

## 4-6. 통계 해석 질문
- averageScore는 review 수로 가중된 book별 평균인가, book 평균들의 평균인가?
- category totalStock은 중복 category 때문에 전체 stock과 합계가 다른가?
- soft deleted book도 포함됐는가?
- score가 없는/malformed review는 어떻게 처리됐는가?
- 집계 실행 시점에 concurrent update가 있으면 어떤 snapshot/일관성이 필요한가?

숫자가 출력됐다는 사실보다 분모와 포함 대상을 설명해야 합니다.

### 4단원 확인
- [ ] 빈 review book을 보존하는 unwind 옵션을 사용했습니다.
- [ ] 보존 행을 reviewCount 1로 잘못 세지 않게 했습니다.
- [ ] 스테이지별 중간 출력을 관찰했습니다.
- [ ] 집계 숫자의 포함 대상과 분모를 설명했습니다.

---

# 5. 전체 CRUD Capstone
## 5-1. state ledger 준비
다음 표를 명령마다 채웁니다.

| 순서 | 명령 | book 건수 | target stock | categories | reviews | 검증 |
| ---: | --- | ---: | ---: | --- | ---: | --- |
| 0 | seed | 3 | - | - | - | list/stats |
| 1 | add | 4 | 4 | `database`, `mongodb` | 0 | get |
| 2 | update-stock | 4 | 7 | 동일 | 0 | get |
| 3 | add-category | 4 | 7 | +practice | 0 | get |
| 4 | add-review | 4 | 7 | 동일 | 1 | get |
| 5 | remove | 3 | 없음 | 없음 | 없음 | get/list |

## 5-2. 기준 명령
```powershell
npm start -- seed
npm start -- list
npm start -- add 978-00-0099 "실전 MongoDB" "학생 저자" 4 "database,mongodb"
npm start -- get 978-00-0099
npm start -- update-stock 978-00-0099 7
npm start -- add-category 978-00-0099 practice
npm start -- add-review 978-00-0099 민지 5 "CRUD를 반복해서 익혔어요."
npm start -- search mongodb 2
npm start -- stats
npm start -- remove 978-00-0099
npm start -- remove 978-00-0099 confirm
npm start -- get 978-00-0099
npm start -- list
```

confirm 없는 remove를 먼저 실행해 state가 유지됨을 확인합니다.

## 5-3. 명령별 증거
| CRUD | 사전 증거 | operation 결과 | 사후 증거 |
| --- | --- | --- | --- |
| Create book | ISBN/입력 검증 | insertedId | get + 건수 4 |
| Read | 필터 예상 | 행.length/null | 출력 필드 확인 |
| Update stock | target/current stock | matched/modified | get stock/location |
| Update category | target/categories | 건수 | 배열 중복 여부 |
| Create review | target + validated review | modified | reviews length/content |
| Delete | target + confirm | deletedCount | get null + 건수 3 |

## 5-4. 실패 경로 주입
정상 capstone 중 최소 네 개를 별도로 실행합니다.

- duplicate ISBN add
- score 0/6 add-review
- 없는 ISBN update/add-review/remove
- 음수 stock update
- 빈 search keyword
- confirm 없는 remove

각 실패 뒤 건수와 target state가 그대로인지 확인합니다.

## 5-5. stats 변화 예측
추가 book stock 7, categories 3개, review score 5가 있을 때 삭제 전 stats를 예측합니다.

- bookCount: 4
- totalStock: 기존 9 + 7 = 16
- averageStock: 4
- `database` category: 기존 2 + 새 1 = 3권, stock 15
- mongodb category: 기존 1 + 새 1 = 2권, stock 12
- practice category: 1권, stock 7
- 새 book review: 건수 1, average 5

삭제 후 seed 기준 stats로 돌아갑니다.

## 5-6. 실행 결과 보존
최종 seed나 삭제 전에 ledger, 명령 출력, 설계 정리를 저장합니다. 실제 DB 문서만 산출물로 두면 seed 후 사라집니다.

### 5단원 확인
- [ ] 전체 명령을 순서대로 실행했습니다.
- [ ] 각 단계 건수와 target 필드를 기록했습니다.
- [ ] confirm 없는 delete를 포함했습니다.
- [ ] stats를 실행 전에 계산하고 비교했습니다.

---

# 6. Mini project와 제품 비교
## 6-1. mini project 선택
다음 중 하나를 선택합니다.

### A. review 관리

- review에 고유 ID 추가
- review 수정/삭제 명령
- 같은 reviewer 중복 정책
- 평균 score search
- review 별도 컬렉션 전환 조건

### B. soft delete library

- soft-remove/restore 명령
- list/search/get active 필터
- 관리자 deleted 목록
- unique ISBN과 복원 충돌 정책
- purge 승인 절차

### C. stock transaction simulation

- decrease/increase 명령
- 충분한 stock 조건부 `$inc`
- operation log 컬렉션
- 중복 request ID
- 실패 복구와 건수 검증

### D. publisher report

- publisher별 book/stock 집계
- publisher 정보 `$lookup`
- orphan reference report
- publisherCode index
- missing publisher 처리

## 6-2. 필수 설계 항목
1. 사용자 요구 3개 이상
2. 문서/컬렉션 모델
3. embedding/reference 근거
4. 명령 interface
5. 입력 validation
6. Create/Read/Update/Delete 중 적용 기능
7. index와 쿼리 근거
8. 정상·경계·오류 test
9. 사전/사후 검증
10. 데이터 삭제·복구 정책

## 6-3. RDBMS와 MongoDB 비교
| 질문 | RDBMS 접근 | MongoDB 접근 |
| --- | --- | --- |
| 도서-저자 | 테이블 + FK + JOIN | author embed/reference |
| category 여러 개 | junction 테이블 | bounded 배열 |
| 고유 ISBN | UNIQUE constraint | unique index |
| 재고 변경 | UPDATE | `$set`/`$inc` |
| 대출+재고 | transaction | multi-문서 transaction/workflow |
| group report | GROUP BY | `$group` 파이프라인 |
| 배열 펼침 | junction 행/JOIN | `$unwind` |
| 무결성 | 스키마/FK/constraint | app validation/스키마 validation/index |

선택 질문:

- 관계와 cross-엔터티 일관성을 더 우선해야 하는가?
- 한 aggregate root를 함께 읽고 쓰는가?
- 구조 변화와 다양한 속성이 많은가?
- 무한 성장 데이터를 어디에 둘 것인가?
- 필요한 transaction 경계는 어디인가?
- 운영 팀의 쿼리/backup/monitoring 경험은 무엇인가?

## 6-4. 결과 설명과 검토
결과 설명 형식:

```text
요구 → 접근 패턴 → model → index → CRUD 안전 → 실패/복구 → 재검토 신호
```

다음 질문으로 결과를 검토합니다.

- 이 배열은 최대가 있는가?
- source of truth는 어디인가?
- 필터가 여러 문서를 잘못 바꿀 수 있는가?
- 같은 명령을 두 번 실행하면 어떻게 되는가?
- 결과가 맞다는 사후 증거는 무엇인가?

## 6-5. 결과 기록
다음 문장을 완성합니다.

- 처음에는 ______라고 생각했지만 지금은 ______ 기준으로 판단한다.
- 가장 위험했던 operation은 ______이며 안전 장치는 ______이다.
- 파이프라인에서 가장 자주 놓친 스테이지 변화는 ______이다.
- 다음 프로젝트에서 먼저 적을 접근 패턴은 ______이다.

## 6-6. 마무리 확인
1. unwind 뒤 review 없는 book이 사라지는 이유는?
2. category totalStock 합이 전체 stock보다 클 수 있는 이유는?
3. 내 mini project의 모델을 다시 검토하게 만들 요구 변화는?

---

# 7. 기준 코드 전체 흐름

```text
help/command/args
  → books_course + ISBN/category index
  → 기존 seed/list/get/add/search/update/remove 유지
  → add-review
      review input validation
      target findOne
      reviews $push + updatedAt
      modified count + get
  → stats
      전체 재고 pipeline
      category unwind/group pipeline
      review unwind/group pipeline
  → 결과 table
  → finally close
```

## 7-1. 입력 module 변화

`parseScore`와 `createReviewDocument`가 추가되고 export/test도 함께 늘었습니다. 명령만 추가하고 입력 test를 빠뜨리지 않습니다.

## 7-2. aggregate도 커서

```js
const rows = await books.aggregate(pipeline).toArray()
```

aggregate는 결과 커서를 반환합니다. find 커서와 마찬가지로 실제 결과를 소비해야 합니다.

## 7-3. 세 report를 분리한 이유

한 거대한 파이프라인으로 모든 결과를 억지로 만들지 않고 목적이 다른 summary를 세 쿼리로 분리했습니다. 전체 재고는 book 단위, category는 category 단위, review는 reviewed book 단위입니다.

## 7-4. 결과 shape

- inventorySummary: 최대 1 문서 배열
- categorySummary: category 수만큼 문서
- reviewSummary: review가 있는 book 수만큼 문서

empty 컬렉션에서는 inventory `$group` 결과도 빈 배열일 수 있습니다. `inventorySummary[0]`을 사용할 때 없음 처리가 필요합니다.

---

# 8. Aggregation 추가 예제

## 예제 A. score 분포

```js
const scoreDistribution = await books
  .aggregate([
    { $unwind: '$reviews' },
    {
      $group: {
        _id: '$reviews.score',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])
  .toArray()
```

결과 한 문서는 score 한 값입니다.

## 예제 B. 평균 4 이상 book

```js
const highlyRated = await books
  .aggregate([
    { $unwind: '$reviews' },
    {
      $group: {
        _id: '$isbn',
        title: { $first: '$title' },
        reviewCount: { $sum: 1 },
        averageScore: { $avg: '$reviews.score' },
      },
    },
    { $match: { averageScore: { $gte: 4 } } },
    { $sort: { averageScore: -1, _id: 1 } },
  ])
  .toArray()
```

group 결과 필드 조건이므로 `$match`가 group 뒤에 옵니다. SQL HAVING과 연결할 수 있습니다.

## 예제 C. category별 평균 stock

```js
[
  { $unwind: '$categories' },
  {
    $group: {
      _id: '$categories',
      bookCount: { $sum: 1 },
      averageStock: { $avg: '$inventory.stock' },
      minStock: { $min: '$inventory.stock' },
      maxStock: { $max: '$inventory.stock' },
    },
  },
]
```

## 예제 D. category별 title 목록

```js
titles: { $push: '$title' }
```

중복을 제거한 set이 필요하면 accumulator `$addToSet`을 사용합니다. update 연산자와 aggregation accumulator 문맥을 구분합니다.

## 예제 E. 최신 review 하나

```js
[
  { $unwind: '$reviews' },
  { $sort: { 'reviews.createdAt': -1 } },
  {
    $group: {
      _id: '$isbn',
      title: { $first: '$title' },
      latestReview: { $first: '$reviews' },
    },
  },
]
```

`$first`의 의미가 앞 정렬에 의존합니다. createdAt이 없는 seed review의 정렬 정책도 정해야 합니다.

## 예제 F. orphan publisher report

publishers 컬렉션과 lookup 후 빈 배열을 찾습니다.

```js
[
  {
    $lookup: {
      from: 'publishers_step5',
      localField: 'publisherCode',
      foreignField: 'code',
      as: 'publisher',
    },
  },
  { $match: { publisher: { $size: 0 } } },
  { $project: { _id: 0, isbn: 1, title: 1, publisherCode: 1 } },
]
```

주의: step-8의 books_course와 step-5 publisher seed가 같은 데이터베이스에 존재하더라도 두 데이터의 생명주기를 결합하면 안 됩니다. mini project에서는 전용 publisher 컬렉션을 함께 준비합니다.

## 예제 G. facet으로 여러 summary

```js
[
  {
    $facet: {
      inventory: [
        {
          $group: {
            _id: null,
            totalStock: { $sum: '$inventory.stock' },
          },
        },
      ],
      byPublisher: [
        {
          $group: {
            _id: '$publisherCode',
            bookCount: { $sum: 1 },
          },
        },
      ],
    },
  },
]
```

한 입력 stream에서 여러 sub-파이프라인 결과를 문서 하나로 만들 수 있습니다. 가독성과 자원 사용을 보고 separate 쿼리와 비교합니다.

---

# 9. Review 모델 확장 예제

## 예제 A. review ID

```js
const { ObjectId } = require('mongodb')

const review = {
  _id: new ObjectId(),
  reviewer: '민지',
  score: 5,
  comment: '좋아요',
  createdAt: new Date(),
}
```

배열 원소 수정·삭제를 안정적으로 식별할 수 있습니다.

## 예제 B. review 수정

```js
await books.updateOne(
  {
    isbn,
    'reviews._id': reviewId,
  },
  {
    $set: {
      'reviews.$.score': score,
      'reviews.$.comment': comment,
      'reviews.$.updatedAt': new Date(),
      updatedAt: new Date(),
    },
  },
)
```

배열 positional 연산자 `$`는 필터에서 일치한 원소를 수정합니다.

## 예제 C. review 삭제

```js
await books.updateOne(
  { isbn },
  {
    $pull: {
      reviews: { _id: reviewId },
    },
    $set: { updatedAt: new Date() },
  },
)
```

## 예제 D. 별도 reviews 컬렉션

```js
{
  _id: reviewId,
  bookId,
  reviewerId,
  score,
  comment,
  createdAt,
}
```

index 후보:

```js
{ bookId: 1, createdAt: -1 }
{ bookId: 1, reviewerId: 1 } // unique 여부는 정책
{ reviewerId: 1, createdAt: -1 }
```

book에는 review 건수/average cache를 둘 수 있으나 source와 일관성 복구가 필요합니다.

---

# 10. 종합 연습 문제

## review

1. score 1과 5 경계, 0/6/4.5 오류를 test합니다.
2. 빈 reviewer/comment 오류를 test합니다.
3. 같은 review 명령을 두 번 실행해 중복을 관찰합니다.
4. review ID를 추가한 update/delete 명령을 설계합니다.
5. 별도 컬렉션으로 옮길 전환 기준을 수치와 기능으로 적습니다.

## aggregation

6. 전체 stock 최소/최대도 추가합니다.
7. publisherCode별 book 건수·stock을 집계합니다.
8. category별 평균 stock을 집계합니다.
9. 평균 score 4 이상 book만 group 뒤 match합니다.
10. review 없는 book도 reviewCount 0으로 남깁니다.
11. 스테이지마다 문서 수와 shape를 출력합니다.
12. category total 합이 전체 stock과 다른 이유를 예시로 설명합니다.
13. 최신 review를 `$sort + $first`로 찾습니다.
14. soft deleted book을 첫 `$match`에서 제외합니다.
15. orphan publisher를 lookup으로 찾습니다.

## CRUD와 설계

16. update-title 명령을 구현합니다.
17. soft-remove/restore를 구현합니다.
18. request ID로 add-review 중복 재시도를 막는 방식을 설계합니다.
19. stock 감소와 대출 log 생성을 원자적으로 처리할 방법을 비교합니다.
20. 같은 도서 서비스의 RDBMS 스키마와 MongoDB 모델을 나란히 그리고 선택 근거를 적습니다.

<details>
<summary>힌트</summary>

- review 없는 book 보존은 `preserveNullAndEmptyArrays`와 조건 건수를 함께 사용합니다.
- group 결과 조건은 group 뒤 `$match`입니다.
- latest는 정렬 순서 뒤 `$first`입니다.
- soft delete 제외 `$match`는 가능한 한 파이프라인 앞에 둡니다.
- idempotent review create에는 요청마다 안정적인 unique 키가 필요합니다.

</details>

---

# 11. 자주 만나는 문제와 진단

## review score 오류

score는 1~5 정수입니다. shell 문자열을 Number로 바꾼 뒤 정수와 범위를 모두 검사합니다. `npm test`로 DB 연결 없이 재현합니다.

## review comment가 잘립니다

shell에서 공백 comment를 따옴표로 감쌌는지 argv를 확인합니다. application level 최대 길이 정책도 검토합니다.

## add-review modifiedCount가 0입니다

- ISBN target이 실제 존재했는지
- 필터 값 공백/문자
- 배열 필드 타입이 reviews 배열인지
- update error가 catch됐는지

를 확인합니다. 기준 함수는 target을 사전 조회합니다.

## stats inventory 결과가 빈 배열입니다

books_course가 비어 있으면 `$group`할 입력이 없어 결과도 빈 배열입니다. seed를 실행하거나 empty state 메시지를 처리합니다.

## category 건수가 book 건수보다 큽니다

한 book이 여러 category에 속해 unwind 후 여러 문서가 됩니다. 정상입니다. distinct book 전체 건수와 category membership 건수를 구분합니다.

## category totalStock 합이 9보다 큽니다

같은 book stock이 각 category group에 한 번씩 기여합니다. category별 보유 재고이고 서로 배타적인 분할이 아닙니다.

## review 없는 book이 summary에 없습니다

기본 unwind가 빈 배열 문서를 제거합니다. 유지하려면 preserve 옵션과 건수/average 처리를 추가합니다.

## reviewCount가 1인데 review가 없습니다

preserve 옵션 뒤 `$sum: 1`을 사용하면 NULL 확장 행을 셉니다. score/id 존재 조건으로 1 또는 0을 합산합니다.

## `$first`가 최신이 아닙니다

group 전에 원하는 시간 순서로 정렬했는지 확인합니다. 필드가 missing인 seed review의 정책도 정합니다.

## 파이프라인 결과 필드가 사라집니다

`$project` inclusion이나 `$group`은 출력 문서 shape를 새로 만듭니다. 각 스테이지 중간 결과를 출력해 어느 스테이지에서 사라졌는지 찾습니다.

## capstone 중 건수가 예상과 다릅니다

- 시작 전에 seed했는지
- duplicate add가 실제 실패했는지
- confirm 없는 remove만 실행했는지
- 명령을 두 번 실행했는지
- 같은 데이터베이스/컬렉션인지

state ledger로 첫 차이가 난 명령부터 찾습니다.

---

# 12. 종합 점검

## A. 모델링

1. author, publisher, reviews를 포함/참조한 현재 근거와 재검토 신호를 설명합니다.
2. source of truth, snapshot, unbounded 배열을 각각 예로 설명합니다.

## B. CRUD

3. book add의 입력 validation, insertedId, 사후 get을 설명합니다.
4. search 필터의 OR/AND와 regex escape를 설명합니다.
5. stock/category/review update 연산자와 건수 검증을 설명합니다.
6. delete 사전 조회·confirm·deletedCount·사후 검증을 설명합니다.

## C. Aggregation

7. category 파이프라인의 스테이지별 문서 수/shape를 설명합니다.
8. review 없는 book이 사라지는 이유와 보존 방법을 설명합니다.
9. 전체 stock과 category total sum이 다른 이유를 설명합니다.

## D. 안전성과 test

10. 정상·경계·오류 입력 test를 review 예로 제시합니다.
11. 멱등성/경쟁 상태를 `$inc`, `$push`, `$addToSet`으로 비교합니다.
12. seed와 실제 데이터 경계를 설명합니다.

## E. 제품 비교

13. 같은 대출 요구를 RDBMS와 MongoDB로 설계하고 transaction/atomicity 차이를 설명합니다.
14. 한 제품을 선택하고 접근 패턴·일관성·성장·운영 근거를 제시합니다.

<details>
<summary>확인 기준</summary>

- 명령 이름만 나열하지 않고 입력, 필터, 결과 건수, 사후 state를 연결해야 합니다.
- 파이프라인은 최종 숫자뿐 아니라 unwind/group 전후 문서 단위를 설명해야 합니다.
- 모델 답에는 장점뿐 아니라 비용과 재검토 조건이 있어야 합니다.
- 제품 선택은 절대 우열이 아니라 요구와 trade-off를 근거로 해야 합니다.
- 실패 입력과 empty state를 정상 성공 경로와 분리해야 합니다.

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
git commit -m "Complete database step 8"
git push
git status --short --branch
```

`main`과 `origin/main`이 같은 commit을 가리키고 작업 파일 목록이 비어 있으면 마쳤습니다.

# 13. 완료 기준

- [ ] review 입력 validation과 test를 설명했습니다.
- [ ] `$push`로 review를 추가하고 중복 정책을 평가했습니다.
- [ ] add-review 전후 review 배열을 검증했습니다.
- [ ] aggregation 스테이지의 입력/출력 사고를 설명했습니다.
- [ ] 전체 재고 건수/sum/average를 손으로 예측했습니다.
- [ ] categories unwind 전후 문서 수를 계산했습니다.
- [ ] category별 건수/stock 결과를 해석했습니다.
- [ ] review group 건수/average를 해석했습니다.
- [ ] review 없는 book 포함/제외 파이프라인을 비교했습니다.
- [ ] `$match`, `$project`, `$unwind`, `$group`, `$sort`를 사용했습니다.
- [ ] 전체 CRUD capstone을 state ledger와 함께 완료했습니다.
- [ ] 정상 경로와 실패 경로 네 개 이상을 검증했습니다.
- [ ] mini project 모델/index/CRUD/test를 설계했습니다.
- [ ] RDBMS와 MongoDB 선택 근거를 설명했습니다.
- [ ] 종합 점검의 답을 실행 결과와 비교했습니다.

## 다시 확인할 항목

1. score test + add-review 한 번
2. 전체 재고 파이프라인
3. category unwind/group 파이프라인
4. review unwind/group 파이프라인
5. seed→add→update→review→stats→delete capstone

## 추가 연습

1. review ID 수정/삭제
2. review separate 컬렉션 migration
3. soft delete-aware stats
4. `$lookup` orphan report
5. `$facet` dashboard
6. optimistic concurrency/request idempotency
7. integration test와 전용 fixture

## 마무리 질문

1. 테이블 행와 문서를 이제 어떻게 다르게 설명하는가?
2. 키/index/constraint를 단순 속도가 아닌 데이터 규칙으로 본 사례는?
3. 가장 유용했던 사전 조회와 사후 검증 습관은?
4. transaction과 single-문서 atomicity의 경계는?
5. 내 다음 프로젝트에서 먼저 작성할 접근 패턴 세 개는?
6. 삭제·복구·감사 요구를 언제 질문할 것인가?
7. 배열 성장과 중복 일관성을 어떻게 모니터링할 것인가?

새 요구사항에는 저장 단위, 식별자, 관계, 조건, 변경 범위, 검증 방법을 정한 뒤 안전하게 실험합니다.
