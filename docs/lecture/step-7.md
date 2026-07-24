# Step 7. MongoDB CRUD 응용: Search, Update, Delete

Step 6의 Create/Read에 조건 검색, 부분 수정, 배열 변경, 삭제를 추가합니다. 각 작업은 `사전 조회 → 실행 → 처리 건수 확인 → 사후 조회` 순서로 검증합니다. 검색어를 정규식으로 바꿀 때의 입력 처리도 함께 다룹니다.

## 0. 먼저 생각할 질문

1. `$or` 검색과 최소 재고 조건은 어떤 논리로 함께 적용되는가?
2. 사용자 검색어의 `.`이나 `*`를 왜 정규식 문법이 아니라 일반 문자로 바꿔야 하는가?
3. `$set`으로 중첩 필드 하나만 바꾸면 상위 object의 다른 필드는 어떻게 되는가?
4. `matchedCount=1`, `modifiedCount=0`은 대상 없음과 어떻게 다른가?
5. `$addToSet`, `$push`, `$inc`, `$pull`은 반복 실행 시 상태가 어떻게 달라지는가?
6. delete 전에 대상 출력과 confirm을 요구하는 이유는 무엇인가?
7. Read 후 Update 사이에 다른 요청이 끼어드는 경쟁을 조건부 update로 어떻게 줄이는가?

## 1. 완료 목표

### 개념

- implicit AND와 `$or`의 중첩 논리를 설명합니다.
- literal text 검색과 regular expression 패턴 검색을 구분합니다.
- partial update와 문서 replacement의 차이를 설명합니다.
- matched/modified/deleted 건수의 의미를 구분합니다.
- 멱등적인 update와 비멱등 update를 예로 설명합니다.
- hard delete, soft delete, archive의 trade-off를 설명합니다.
- read-modify-write 경쟁과 atomic conditional update를 설명합니다.

### 실습

- 제목·저자·category OR 검색과 최소 stock AND 조건을 작성합니다.
- `escapeRegex()`를 test하고 특수문자 검색을 안전하게 처리합니다.
- `$set`과 점 표기법으로 stock만 변경합니다.
- `$addToSet`으로 category 중복을 방지합니다.
- `$inc`, `$pull` 확장 명령을 설계합니다.
- delete 대상 사전 조회와 명시적 confirm을 구현합니다.
- 없음·동일 값·정상 변경·삭제 중단을 서로 다른 결과로 기록합니다.

### 작업 원칙

- 검색어가 빈 값이면 전체 컬렉션 검색으로 확대하지 않고 거부합니다.
- Update/Delete에서 필터가 고유한지 확인합니다.
- 처리 건수만 출력하지 않고 실제 문서를 다시 읽습니다.
- 삭제할 수 있다는 이유로 업무 이력을 물리 삭제하지 않습니다.
- 경쟁 상태가 가능한 로직에서 사전 조회만을 안전 보장으로 착각하지 않습니다.

## 2. 완료 결과

- 검색어·최소 재고 조합 8개의 예상/실제 결과
- 정규식 특수문자 test와 검색 결과
- stock/category 수정 전후 비교표
- `$set`, `$inc`, `$addToSet`, `$push`, `$pull` 연산자 비교표
- confirm 없는 삭제·정상 삭제·없는 대상 삭제 기록
- soft delete 또는 조건부 재고 감소 설계
- 이해 점검 답안과 안전성 코드 리뷰

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
  npm start -- remove <isbn> confirm
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
      remove: () => removeBook(books, args[0], args[1]),
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
  escapeRegex,
  parseCategories,
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
  escapeRegex,
  parseCategories,
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
~~~

### 입력 후 검사

```powershell
npm run check
npm test
```

MongoDB 실행에서 연결 오류가 나면 코드부터 바꾸지 않고 Windows 서비스와 `.env` 값을 먼저 확인합니다.


기준 상태를 만들기 전에 지난 add 데이터를 보존할 필요가 없는지 확인합니다.

```powershell
npm run check
npm test
npm start -- help
npm start -- seed
npm start -- list
```

step-6과 같은 `books_course` 컬렉션을 사용합니다.

# 1. 복합 검색과 정규식 입력
## 1-1. search 명령
```powershell
npm start -- search database
npm start -- search database 3
```

첫 명령은 keyword만, 두 번째는 keyword와 최소 stock을 함께 사용합니다. 명령 args는 모두 문자열이므로 minStock은 `parseStock()`으로 검증합니다.

## 1-2. 검색어 validation
```js
const keyword = String(keywordValue ?? '').trim()

if (!keyword) {
  throw new Error('검색어를 입력하세요.')
}
```

빈 keyword를 정규식으로 만들면 모든 문자열과 일치할 수 있어 의도치 않은 전체 검색이 됩니다. 입력 누락은 0건 결과가 아니라 잘못된 요청으로 거부합니다.

## 1-3. 정규식 특수문자 escape
```js
function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

사용자 입력:

```text
Node.js (기초)
```

escape 후:

```text
Node\.js \(기초\)
```

`.`은 임의 한 문자, `(`는 group 시작이라는 정규식 의미를 잃고 실제 문자로 검색됩니다.

```js
const pattern = new RegExp(escapeRegex(keyword), 'i')
```

`i` flag는 영문 대소문자를 구분하지 않습니다. 언어별 검색과 collation 요구는 별도 설계가 필요합니다.

## 1-4. `$or` 필터
```js
const filter = {
  $or: [
    { title: pattern },
    { 'author.name': pattern },
    { categories: pattern },
  ],
}
```

세 필드 중 하나에 keyword가 일치하면 문서를 찾습니다. categories는 배열이며 각 문자열 원소에 정규식 일치를 평가할 수 있습니다.

## 1-5. 최소 stock AND
```js
if (minStockValue !== undefined) {
  filter['inventory.stock'] = { $gte: parseStock(minStockValue) }
}
```

최종 필터:

```js
{
  $or: [/* keyword 조건 */],
  'inventory.stock': { $gte: 3 },
}
```

같은 object의 `$or`와 inventory.stock은 implicit AND입니다.

```text
(title OR author.name OR categories matches keyword)
AND
inventory.stock >= minStock
```

## 1-6. 검색 matrix
seed 기준 예상:

| 명령 | 예상 | 이유 |
| --- | ---: | --- |
| search database | 2 | category 두 권 |
| search database 4 | 1 | stock 5 한 권 |
| search 김데이터 | 1 | author.name |
| search Node.js | 1 | title |
| search beginner | 2 | category 두 권 |
| search mongodb 6 | 0 | 최대 stock 5 |
| search unknown | 0 | 어떤 필드에도 없음 |
| search | 오류 | 빈 keyword |

실행 전에 결과와 순서를 적고, 실제 재고 내림차순 결과와 비교합니다.

### 1단원 확인
- [ ] 빈 검색어를 거부하는 이유를 설명했습니다.
- [ ] escapeRegex test를 실행했습니다.
- [ ] `$or`와 stock 조건의 AND 논리를 괄호로 적었습니다.
- [ ] 검색 matrix 네 개 이상을 실행했습니다.

---

# 2. `$set`과 Update 결과 건수
## 2-1. update-stock 명령
```powershell
npm start -- update-stock 978-00-0001 8
```

입력:

- ISBN: target 식별
- stockValue: parseStock으로 0 이상 정수 검증

## 2-2. 사전 조회
```js
const target = await books.findOne(
  { isbn },
  {
    projection: {
      _id: 0,
      isbn: 1,
      title: 1,
      inventory: 1,
    },
  },
)

if (!target) {
  console.log('수정할 도서를 찾지 못했습니다.')
  return
}
```

사전 조회는 사용자에게 현재 값과 대상을 보여줍니다. 필터는 unique ISBN입니다.

## 2-3. nested partial update
```js
const result = await books.updateOne(
  { isbn },
  {
    $set: {
      'inventory.stock': stock,
      updatedAt: new Date(),
    },
  },
)
```

점 표기법으로 stock만 바꾸므로 `inventory.location`은 유지됩니다.

다음처럼 상위 inventory 전체를 바꾸면 location이 사라질 수 있습니다.

```js
{ $set: { inventory: { stock } } }
```

## 2-4. matched와 modified
```js
console.log(
  `수정 결과: matched=${result.matchedCount}, changed=${result.modifiedCount}`,
)
```

| matched | modified | 의미 후보 |
| ---: | ---: | --- |
| 0 | 0 | ISBN 대상 없음 |
| 1 | 1 | 문서를 찾아 상태 변경 |
| 1 | 0 | 이미 같은 update 결과 등 실질 변경 없음 |

현재 update는 `updatedAt: new Date()`도 설정하므로 stock이 같아도 시간이 달라지면 modified 1이 될 수 있습니다. 같은 stock에서 modified 0을 관찰하려면 timestamp 정책과 실행 시각/Driver 동작을 고려하거나 stock만 update하는 별도 실험을 사용합니다.

이 결과는 “같은 stock이면 항상 modified 0”이라는 규칙이 성립하지 않는 반례입니다.

## 2-5. 사후 조회
기준 함수는 `await getBook(books, isbn)`으로 전체 문서를 다시 봅니다.

확인:

- inventory.stock이 새 숫자
- inventory.location 유지
- categories/reviews 유지
- updatedAt 존재
- title/author 불변

## 2-6. 오류 입력
```powershell
npm start -- update-stock 978-00-0001 -1
npm start -- update-stock 978-00-0001 1.5
npm start -- update-stock not-found 3
```

앞 두 개는 validation 오류, 마지막은 정상 없음 메시지입니다. 모두 DB state가 변하지 않아야 합니다.

### 2단원 확인
- [ ] update 전 target을 출력했습니다.
- [ ] 점 표기법 partial update의 보존 효과를 설명했습니다.
- [ ] matched와 modified를 구분했습니다.
- [ ] updatedAt 때문에 동일 stock도 변경될 수 있음을 설명했습니다.

---

# 3. 숫자·배열 update 연산자
## 3-1. `$addToSet`
```powershell
npm start -- add-category 978-00-0001 sql
```

```js
const result = await books.updateOne(
  { isbn },
  {
    $addToSet: { categories: category },
    $set: { updatedAt: new Date() },
  },
)
```

`$addToSet`은 같은 값이 없을 때만 배열에 추가합니다. category는 trim·lowercase합니다.

주의: updatedAt을 함께 매번 바꾸므로 같은 category 반복에서도 문서는 timestamp 때문에 modified될 수 있습니다. 배열 중복 방지 여부는 사후 categories 배열로 검증합니다. “두 번째 modifiedCount는 반드시 0”이라는 기대는 현재 코드와 정확히 일치하지 않을 수 있습니다.

## 3-2. `$push`와 비교
```js
{ $push: { categories: 'sql' } }
```

같은 값을 반복하면 중복이 생깁니다.

| 연산 | 첫 실행 | 둘째 실행 | 적합 예 |
| --- | --- | --- | --- |
| `$addToSet` | sql 추가 | 배열 상태 유지 | tag/category |
| `$push` | 원소 추가 | 또 추가 | review/event(중복 정책 별도) |

## 3-3. `$inc`
재고를 새 절대값으로 바꾸지 않고 증가량으로 바꿉니다.

```js
const result = await books.updateOne(
  { isbn },
  {
    $inc: { 'inventory.stock': amount },
    $set: { updatedAt: new Date() },
  },
)
```

stock +1은 반복 실행할 때마다 증가하므로 멱등적이지 않습니다. 명령 재시도 정책이 필요합니다.

재고 감소는 음수 방지 조건을 함께 둡니다.

```js
await books.updateOne(
  {
    isbn,
    'inventory.stock': { $gte: decreaseAmount },
  },
  { $inc: { 'inventory.stock': -decreaseAmount } },
)
```

## 3-4. `$pull`
```js
await books.updateOne(
  { isbn },
  {
    $pull: { categories: category },
    $set: { updatedAt: new Date() },
  },
)
```

일치하는 배열 원소를 제거합니다. 없는 category를 pull하면 배열 상태는 같습니다. category 최소 1개 규칙이 있다면 제거 후 빈 배열을 막는 조건이 필요합니다.

## 3-5. `$unset`과 null
필드를 제거하려면:

```js
{ $unset: { subtitle: '' } }
```

`$set: { subtitle: null }`은 필드가 존재하면서 값이 null인 상태입니다. missing과 null 쿼리가 다를 수 있으므로 요구를 구분합니다.

## 3-6. 연산자 선택 활동
| 요구 | 연산자 후보 | 반복 실행 결과 |
| --- | --- | --- |
| stock을 정확히 8로 | `$set` | 같은 상태 |
| stock 1 증가 | `$inc` | 계속 증가 |
| category 중복 없이 추가 | `$addToSet` | 배열 상태 유지 |
| review 추가 | `$push` | 계속 늘어남 |
| category 제거 | `$pull` | 없으면 상태 유지 |
| optional 필드 제거 | `$unset` | 없는 상태 유지 |

### 3단원 확인
- [ ] `$addToSet`과 `$push`를 반복 결과로 비교했습니다.
- [ ] `$inc` 감소에 stock 조건을 함께 두었습니다.
- [ ] `$pull`과 `$unset` 대상을 구분했습니다.
- [ ] 각 연산의 멱등성을 설명했습니다.

---

# 4. 안전한 Delete
## 4-1. remove 명령 두 단계
확인 없이 실행:

```powershell
npm start -- remove 978-00-0003
```

명시적 확인:

```powershell
npm start -- remove 978-00-0003 confirm
```

문자열 `confirm`이 정확히 마지막 인자일 때만 삭제합니다.

## 4-2. 대상 사전 조회
```js
const target = await books.findOne(
  { isbn },
  { projection: { _id: 0, isbn: 1, title: 1 } },
)

if (!target) {
  console.log('삭제할 도서를 찾지 못했습니다.')
  return
}

console.log('삭제 대상', target)
```

ISBN unique index가 있어 target은 최대 한 건입니다. title만으로 삭제하지 않습니다.

## 4-3. confirm guard
```js
if (confirmation !== 'confirm') {
  console.log('삭제하려면 마지막 인자로 confirm을 입력하세요.')
  return
}
```

이 검사는 실수를 줄이기 위한 장치이며 권한 인증이나 정식 승인 절차를 대신하지 않습니다. 누가 삭제할 수 있는지, audit log를 어떻게 남길지는 실제 서비스에서 별도 설계합니다.

## 4-4. deleteOne과 deletedCount
```js
const result = await books.deleteOne({ isbn })
console.log(`삭제 결과: ${result.deletedCount}건`)
```

사전 조회 뒤 실제 delete 사이에 다른 process가 먼저 삭제할 수 있습니다. 따라서 target을 봤더라도 `deletedCount`가 0일 수 있습니다. 사전 조회는 사용자 확인, deletedCount는 실제 실행 결과입니다.

## 4-5. 세 경로 실습
### 경로 A: confirm 없음

- target 출력
- 삭제 중단 메시지
- list에서 문서 유지

### 경로 B: confirm 있음

- target 출력
- deletedCount 1
- get에서 없음
- list 건수 2

### 경로 C: 같은 ISBN 다시 삭제

- 사전 findOne null
- 없음 메시지
- deleteOne 호출 안 함

각 경로의 DB operation 수와 state를 기록합니다.

## 4-6. deleteMany 안전 절차
여러 문서를 삭제해야 한다면:

```text
filter 작성
  → countDocuments
  → sample projection 출력
  → 예상 최대 건수 guard
  → 사용자/운영 승인
  → deleteMany
  → deletedCount 비교
  → 사후 count
```

빈 필터 `{}`는 seed처럼 명시적 초기화 기능에서만 좁은 예제 컬렉션에 사용합니다.

### 4단원 확인
- [ ] 삭제 전 고유 target을 출력했습니다.
- [ ] confirm 없는 경로에서 state가 유지됐습니다.
- [ ] deletedCount와 사후 get을 확인했습니다.
- [ ] 사전 조회와 delete 사이 경쟁 가능성을 설명했습니다.

---

# 5. soft delete, 멱등성, 경쟁 상태
## 5-1. hard delete가 부적절한 요구
다음 질문 중 하나라도 예라면 soft delete/archive를 검토합니다.

- 복구가 필요한가?
- 주문·대출·감사 기록이 book을 참조하는가?
- 법적 보존 기간이 있는가?
- 누가 언제 삭제했는지 남겨야 하는가?
- 삭제된 자료를 관리자만 볼 필요가 있는가?

## 5-2. soft delete
```js
const result = await books.updateOne(
  {
    isbn,
    deletedAt: { $exists: false },
  },
  {
    $set: {
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  },
)
```

일반 목록 필터에 다음 조건을 포함합니다.

```js
{ deletedAt: { $exists: false } }
```

기존 category/search 필터와 AND로 결합해야 합니다.

## 5-3. restore
```js
await books.updateOne(
  { isbn, deletedAt: { $exists: true } },
  {
    $unset: { deletedAt: '' },
    $set: { updatedAt: new Date() },
  },
)
```

복원할 때 같은 ISBN의 새 active 문서가 생겼다면 unique index 때문에 어떤 정책이 필요한지도 생각합니다.

## 5-4. 멱등성
같은 요청을 여러 번 실행할 때 최종 state가 같은지 비교합니다.

| 작업 | 멱등성 관점 |
| --- | --- |
| stock을 8로 `$set` | 최종 stock 같음 |
| category `$addToSet` | 배열 최종 상태 같음 |
| stock `$inc` +1 | 매번 증가 |
| review `$push` | 매번 원소 추가 |
| deleteOne same ISBN | 최종 없음 상태 같음, 건수는 달라짐 |
| soft delete timestamp 갱신 | timestamp 정책에 따라 매번 달라질 수 있음 |

updatedAt 같은 부수 필드 때문에 업무 핵심 state와 전체 문서 state의 멱등성이 다를 수 있습니다.

## 5-5. read-modify-write 경쟁
위험한 재고 감소:

```js
const book = await books.findOne({ isbn })
const nextStock = book.inventory.stock - 1

await books.updateOne(
  { isbn },
  { $set: { 'inventory.stock': nextStock } },
)
```

두 process가 stock 1을 동시에 읽으면 둘 다 0을 저장할 수 있습니다. 대출은 두 번인데 감소는 한 번처럼 보이는 lost update가 생깁니다.

조건과 변경을 한 atomic operation에 둡니다.

```js
const result = await books.updateOne(
  {
    isbn,
    'inventory.stock': { $gt: 0 },
  },
  {
    $inc: { 'inventory.stock': -1 },
    $set: { updatedAt: new Date() },
  },
)
```

matched 0이면 book 없음과 stock 0 중 하나입니다. 필요하면 추가 Read로 사용자 메시지를 구분하지만 감소 성공 여부는 하나의 update 결과로 판단합니다.

## 5-6. 여러 문서 transaction 연결
재고 문서 감소와 별도 loans 컬렉션 insert를 모두 성공/취소해야 한다면 single-문서 atomicity만으로 부족합니다. Step 3 SQL transaction과 같은 문제이며 MongoDB transaction 또는 실패 보상/상태 workflow를 검토합니다.

현재 단계 코드는 한 books 문서의 CRUD에 집중하지만, 데이터 모델 경계가 transaction 경계에도 영향을 준다는 점을 기록합니다.

### 5단원 확인
- [ ] hard/soft delete 선택 질문을 적었습니다.
- [ ] soft delete 필터가 모든 일반 Read에 필요함을 설명했습니다.
- [ ] 연산자별 멱등성을 비교했습니다.
- [ ] 조건부 `$inc`가 read-modify-write 경쟁을 줄이는 이유를 설명했습니다.

---

# 6. 명령 map과 종합 CRUD 코드 리뷰
## 6-1. 명령 map
step-7은 긴 if/else 대신 명령과 함수를 object로 연결합니다.

```js
const commands = {
  seed: () => seedBooks(books),
  list: () => listBooks(books, args[0]),
  get: () => getBook(books, args[0]),
  add: () => addBook(books, args),
  search: () => searchBooks(books, args[0], args[1]),
  'update-stock': () => updateStock(books, args[0], args[1]),
  'add-category': () => addCategory(books, args[0], args[1]),
  remove: () => removeBook(books, args[0], args[1]),
}
```

```js
const runCommand = commands[command]

if (!runCommand) {
  showHelp()
  throw new Error(`알 수 없는 command: ${command}`)
}

await runCommand()
```

새 명령을 추가할 때 help와 map, 함수, test/문서를 함께 갱신합니다.

## 6-2. 종합 시나리오
각 단계에서 건수와 바뀐 필드를 기록합니다.

```powershell
npm start -- seed
npm start -- list
npm start -- search database 3
npm start -- add 978-00-0099 "CRUD 응용" "학생 저자" 4 "database,practice"
npm start -- get 978-00-0099
npm start -- update-stock 978-00-0099 7
npm start -- add-category 978-00-0099 mongodb
npm start -- add-category 978-00-0099 mongodb
npm start -- search mongodb 2
npm start -- remove 978-00-0099
npm start -- get 978-00-0099
npm start -- remove 978-00-0099 confirm
npm start -- get 978-00-0099
npm start -- list
```

두 번째 add-category 뒤 categories에 mongodb가 하나만 있는지 확인합니다. 현재 updatedAt 동시 update 때문에 modified 건수만으로 `$addToSet` 중복 방지를 판단하지 않습니다.

## 6-3. 코드 리뷰 checklist
- [ ] 명령 입력이 비어 있을 때 메시지가 있는가?
- [ ] 숫자는 parseStock으로 검증하는가?
- [ ] user regex 입력을 escape하는가?
- [ ] 한 건 필터가 unique ISBN인가?
- [ ] update/delete 전 target을 보여주는가?
- [ ] 결과 건수를 해석하는가?
- [ ] 사후 get/list가 있는가?
- [ ] hard delete가 업무 요구에 맞는가?
- [ ] updatedAt이 결과 건수 해석에 미치는 영향을 고려했는가?
- [ ] help에 새 명령이 있는가?

## 6-4. 독립 확장 명령
다음 중 하나의 interface와 안전 흐름을 설계합니다.

```text
npm start -- increment-stock <isbn> <amount>
npm start -- remove-category <isbn> <category>
npm start -- soft-remove <isbn> confirm
npm start -- restore <isbn>
```

필수 항목:

- 입력 validation
- 사전 target/예상 state
- update 연산자와 필터
- matched/modified 해석
- 사후 get
- help 문구
- test case

## 6-5. 코드 검토
상대의 확장 설계에서 필터 범위, 반복 실행, 없음 상태, 결과 건수, 복구 가능성을 검토합니다. 단순 syntax보다 데이터 안전성을 우선합니다.

## 6-6. 마무리 확인
1. `$addToSet`인데 modified가 1일 수 있는 현재 코드 이유는?
2. 사전 findOne이 delete 성공을 보장하지 않는 이유는?
3. 조건부 `$inc` 필터에 stock 조건을 넣는 이유는?

---

# 7. 기준 코드 전체 흐름

```text
command/args 분리
  → help면 연결 없이 출력
  → books_course와 index 준비
  → command map에서 함수 선택
  → search: keyword escape + OR/stock filter + cursor
  → update-stock: parse + target + $set + counts + get
  → add-category: normalize + $addToSet + counts + get
  → remove: target + confirm guard + deleteOne + count
  → callback 완료 후 연결 종료
```

## 7-1. 기존 Create/Read 기능 보존

seed/list/get/add가 그대로 있고 search/update/delete가 추가됩니다. cumulative branch는 이전 날 기능을 버리는 것이 아니라 새로운 안전 요구와 명령을 누적합니다.

## 7-2. `getBook()` 반환 변화

step-7의 getBook은 문서가 없으면 null을 반환하고, 있으면 출력한 뒤 문서를 반환합니다. 다른 함수에서 재사용할 수 있는 형태로 발전했습니다.

## 7-3. user 입력과 MongoDB 연산자

keyword는 정규식으로 변환하지만 regex metacharacter를 escape합니다. stock은 number로 변환합니다. category는 canonical lowercase token으로 만듭니다. 연산자 object에 raw 입력을 그대로 spread하지 않습니다.

## 7-4. update timestamp policy

모든 update에 updatedAt을 함께 바꾸면 audit에 도움이 되지만 no-op operation도 timestamp 때문에 실제 modification이 될 수 있습니다. modifiedCount를 업무 필드 변경 여부로 사용할지 timestamp를 언제 갱신할지 정책을 분명히 합니다.

---

# 8. 추가 검색 예제

## 예제 A. 출판 연도 범위

```js
const filter = {
  publishedYear: {
    $gte: minYear,
    $lte: maxYear,
  },
}
```

year parser에서 정수와 범위 순서를 검증합니다.

## 예제 B. category 여러 개 모두

```js
{ categories: { $all: ['database', 'beginner'] } }
```

## 예제 C. review score 배열

```js
{
  reviews: {
    $elemMatch: {
      score: { $gte: 4 },
      reviewer: '민지',
    },
  },
}
```

같은 review 원소가 두 조건을 만족해야 합니다.

## 예제 D. 검색 결과 limit

```js
const rows = await books
  .find(filter, { projection })
  .sort({ 'inventory.stock': -1, isbn: 1 })
  .limit(20)
  .toArray()
```

unbounded regex 검색에 무제한 toArray를 사용하지 않도록 결과 제한과 pagination을 검토합니다.

## 예제 E. exact tag와 free text 분리

category는 regex보다 exact token 필터가 index 사용과 의미에 더 자연스러울 수 있습니다. 현재 search는 편의를 위해 title/author/categories에 같은 regex를 적용하지만 실제 기능에서는 `category` 필터를 별도 parameter로 분리할 수 있습니다.

---

# 9. 추가 Update/Delete 예제

## 예제 A. title update

```js
await books.updateOne(
  { isbn },
  {
    $set: {
      title: requireText(titleValue, 'title'),
      updatedAt: new Date(),
    },
  },
)
```

ISBN은 식별 조건이고 title은 변경 대상입니다.

## 예제 B. 여러 category 추가

```js
{
  $addToSet: {
    categories: {
      $each: ['database', 'mongodb'],
    },
  },
}
```

입력 배열을 먼저 normalize/dedupe합니다.

## 예제 C. 배열 문서 특정 원소 수정

review ID가 있다면 positional 연산자와 배열 필터를 검토할 수 있습니다. reviewer name만으로 특정 review를 식별하면 중복 이름 때문에 모호합니다. 배열 원소에도 안정적인 식별자가 필요할 수 있습니다.

## 예제 D. optimistic concurrency

version 필드를 조건에 넣습니다.

```js
const result = await books.updateOne(
  { isbn, version: expectedVersion },
  {
    $set: { title: nextTitle, updatedAt: new Date() },
    $inc: { version: 1 },
  },
)
```

matched 0이면 다른 update가 먼저 version을 바꿨을 수 있습니다. 사용자의 오래된 화면이 최신 변경을 덮어쓰는 것을 감지합니다.

## 예제 E. archive

삭제 전에 archive 컬렉션에 copy한 뒤 원본을 지우는 두 operation은 하나만 성공할 위험이 있습니다. transaction 또는 idempotent workflow와 검증이 필요합니다. 단순 copy 후 delete가 자동으로 안전한 것은 아닙니다.

---

# 10. 연습 문제

## Search

1. keyword만, keyword+stock 검색 결과를 네 조합 이상 기록합니다.
2. `Node.js (기초)` escapeRegex test를 실행합니다.
3. 빈 keyword가 전체 검색되지 않도록 검증합니다.
4. year 범위 search를 설계합니다.
5. category exact 필터와 free text regex를 분리합니다.

## Update

6. stock을 0과 8로 바꾸고 사후 location 보존을 확인합니다.
7. 없는 ISBN update에서 matched 0 경로를 확인합니다.
8. `$inc`로 restock 명령을 설계합니다.
9. `$pull`로 category 제거 명령을 설계합니다.
10. `$unset`과 null setting의 쿼리 차이를 설명합니다.

## Delete

11. confirm 없는 삭제와 있는 삭제 state를 비교합니다.
12. 같은 ISBN을 두 번 삭제해 두 번째 없음 경로를 봅니다.
13. deleteMany 전에 건수/예시/max guard 절차를 적습니다.
14. soft delete/restore 명령을 설계합니다.
15. deletedAt 필터를 list와 search에 빠짐없이 결합합니다.

## 경쟁과 테스트

16. stock 1에서 두 process 감소 경쟁을 시간 순서로 그립니다.
17. 조건부 `$inc`가 음수를 막는 이유를 설명합니다.
18. version 필드 optimistic concurrency를 구현안으로 적습니다.
19. updatedAt이 modifiedCount test에 미치는 영향을 재현합니다.
20. 명령 map에 새 기능 추가 시 바꿀 파일/문서를 checklist로 만듭니다.

<details>
<summary>힌트</summary>

- `$or` 옆 다른 필드는 AND입니다.
- category duplicate 여부는 건수보다 사후 배열을 직접 확인합니다.
- stock 감소 필터에 `$gte: amount`를 둡니다.
- soft delete에서는 모든 일반 Read에 deletedAt 미존재 조건이 필요합니다.
- version은 Read한 버전을 Update 필터에 그대로 넣습니다.

</details>

---

# 11. 자주 만나는 문제와 진단

## search 특수문자가 이상하게 동작합니다

`escapeRegex()`를 거쳤는지, RegExp 생성 전에 raw keyword를 그대로 사용하지 않았는지 확인합니다. test에서 점·괄호·별표를 포함한 입력을 검증합니다.

## search가 너무 느립니다

앞 wildcard 성격의 regex는 일반 index를 충분히 활용하지 못할 수 있습니다. 결과 limit, exact category 분리, text search/search engine, 쿼리 frequency를 검토합니다.

## matched 1인데 modified 0입니다

대상은 있으나 최종 state가 같을 수 있습니다. 단, 현재 updatedAt을 함께 바꾸면 modified 1이 될 가능성이 높습니다. update 문서 전체를 보고 해석합니다.

## 같은 category 두 번인데 modified 1입니다

`$addToSet`은 배열 중복을 막았지만 `$set: { updatedAt: new Date() }`가 timestamp를 바꿨습니다. categories 배열을 사후 조회해 검증합니다.

## inventory.location이 사라졌습니다

`$set: { inventory: { stock } }`로 상위 object 전체를 바꿨는지 확인합니다. `inventory.stock` 점 표기법을 사용합니다.

## stock이 음수가 됐습니다

`$inc` 감소 필터에 충분한 stock 조건이 있는지 확인합니다. 애플리케이션 사전 Read만으로 동시 update를 막지 못합니다.

## confirm했는데 deletedCount 0입니다

사전 조회 뒤 다른 process가 먼저 삭제했거나 필터 값이 바뀌었을 수 있습니다. 실제 state를 다시 조회합니다.

## soft delete book이 list에 보입니다

list/search/get의 일반 필터에 deletedAt 조건이 모두 적용됐는지 확인합니다. 필터 조합 helper를 만드는 것도 방법입니다.

## 알 수 없는 명령이 help만 보이고 성공처럼 보입니다

기준은 help 출력 뒤 Error를 throw해 exitCode 1로 갑니다. catch에서 오류를 숨기거나 성공 code로 바꾸지 않았는지 확인합니다.

---

# 12. 이해 점검

## 문항

1. `$or`와 inventory.stock 조건의 전체 논리를 괄호로 쓰세요.
2. escapeRegex가 필요한 이유를 점 문자로 설명하세요.
3. empty keyword를 거부하는 이유는?
4. nested stock partial update가 location을 보존하는 이유는?
5. matchedCount와 modifiedCount를 구분하세요.
6. `$addToSet`과 `$push`를 반복 실행 결과로 비교하세요.
7. 현재 add-category에서 같은 category도 modified 1일 수 있는 이유는?
8. delete 전 target과 delete 후 건수가 모두 필요한 이유는?
9. hard delete와 soft delete의 비용을 하나씩 쓰세요.
10. 조건부 `$inc`가 read-modify-write보다 안전한 이유는?

<details>
<summary>확인 기준</summary>

1. `(title OR author OR category) AND stock >= N`입니다.
2. 점을 임의 문자 정규식이 아니라 literal 점으로 검색합니다.
3. 의도치 않은 전체 검색과 비용을 막습니다.
4. 점 표기법이 해당 하위 필드만 바꿉니다.
5. 필터 일치 수와 실제 state 변경 수입니다.
6. 중복 방지와 매번 추가입니다.
7. updatedAt `$set`이 별도 변경을 만듭니다.
8. 사용자 대상 확인과 실제 실행 결과/경쟁을 각각 봅니다.
9. 복구 불가와 조회 필터/저장 지속 비용 등을 적습니다.
10. 조건 검사와 감소가 한 문서 atomic operation입니다.

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
git commit -m "Complete database step 7"
git push
git status --short --branch
```

`main`과 `origin/main`이 같은 commit을 가리키고 작업 파일 목록이 비어 있으면 마쳤습니다.

# 13. 완료 기준

- [ ] step-7 기준 seed와 test를 확인했습니다.
- [ ] keyword validation과 escapeRegex를 설명했습니다.
- [ ] `$or` 검색과 stock AND 조건을 실행했습니다.
- [ ] search 결과 0건과 입력 오류를 구분했습니다.
- [ ] stock update 전후 target을 조회했습니다.
- [ ] 점 표기법으로 inventory.location을 보존했습니다.
- [ ] matched/modified 건수를 update 전체와 함께 해석했습니다.
- [ ] `$addToSet` 중복 방지를 사후 배열로 확인했습니다.
- [ ] `$inc`, `$push`, `$pull`, `$unset`을 비교했습니다.
- [ ] confirm 없는 delete에서 state가 유지됐습니다.
- [ ] confirm delete의 deletedCount와 사후 get을 확인했습니다.
- [ ] hard/soft delete 선택 근거를 설명했습니다.
- [ ] 조건부 `$inc`로 경쟁 상태를 줄이는 설계를 했습니다.
- [ ] 종합 CRUD 시나리오를 순서대로 기록했습니다.
- [ ] 이해 점검의 답을 실행 결과와 비교했습니다.

## 다시 확인할 항목

1. search keyword/minStock 두 경로
2. update-stock 사전/사후 조회
3. add-category 반복 후 배열 검증
4. confirm 없는/있는 remove 비교
5. matched/modified/deleted 건수 설명

## 추가 연습

1. increment-stock과 remove-category 구현
2. soft delete/restore와 공통 active 필터
3. year range + exact category search
4. optimistic concurrency version 필드
5. books/loans multi-문서 transaction 설계

## 적용 질문

review 배열을 집계할 때는 빈 배열과 `$unwind` 뒤의 문서 수 변화를 함께 확인해야 합니다.

> 빈 reviews 배열을 `$unwind`하면 그 book 문서는 어디로 가며, 리뷰 없는 책도 보고서에 남기려면 어떤 옵션이나 다른 파이프라인이 필요할까?
