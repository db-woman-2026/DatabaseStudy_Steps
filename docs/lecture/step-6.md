# Step 6. MongoDB CRUD 기초: Create와 Read — 6시간 상세 강의

오늘부터는 `books_course` collection을 여러 CLI 명령이 계속 공유합니다. `seed`로 기준 상태를 만든 뒤 `list`, `get`, `add`를 별도 프로세스로 반복하면서 상태 변화를 관찰합니다. 핵심은 터미널 문자열을 곧바로 database에 보내지 않고 검증된 숫자·배열·중첩 document로 바꾸는 입력 경계입니다.

## 0. 오늘의 핵심 질문

1. `npm start -- add ...` 뒤의 값은 `process.argv`에 어떤 문자열 배열로 들어오는가?
2. 문자열 stock을 왜 database에 보내기 전에 Number로 변환하고 검증해야 하는가?
3. seed는 언제 필요하고 언제 사용자의 실습 data를 지우는 위험한 명령인가?
4. `insertOne()` 성공을 insertedId와 사후 조회로 어떻게 증명하는가?
5. `find()`와 `findOne()`은 결과 수, 반환 타입, 없음 처리에서 어떻게 다른가?
6. 같은 ISBN 생성이 실패하는 이유를 입력 검증과 unique index 관점에서 어떻게 설명하는가?
7. 독립 CLI 프로세스 사이에서 MongoDB 상태가 유지되는 이유는 무엇인가?

## 1. 학습 목표

### 지식

- CRUD에서 Create와 Read의 책임을 구분합니다.
- CLI command, argument, process, persisted database state를 구분합니다.
- validation, normalization, transformation을 예로 설명합니다.
- `insertOne`, `find`, `findOne`의 반환과 없음 상태를 구분합니다.
- unique index가 생성 경쟁과 중복을 막는 최종 경계임을 설명합니다.

### 기능

- `process.argv.slice(2)`에서 command와 args를 분리합니다.
- 빈 문자열, 음수, 소수 stock을 실행 전에 거부합니다.
- category 문자열을 trim·소문자화·중복 제거한 배열로 바꿉니다.
- 평평한 CLI 인자를 중첩 book document로 변환합니다.
- Node test runner로 정상·경계·오류 사례를 확인합니다.
- `seed → list → add → get → list` 시나리오를 반복합니다.
- category filter, projection, sort를 가진 목록 조회를 설명합니다.

### 태도

- command를 실행하기 전에 예상 document 수를 기록합니다.
- seed가 삭제하는 collection 범위를 확인합니다.
- 오류 입력을 DB 오류가 날 때까지 보내지 않고 입력 경계에서 막습니다.
- Create 후 업무 식별자인 ISBN으로 다시 조회합니다.
- 조회 0건을 연결 실패와 구분해 사용자 메시지로 처리합니다.

## 2. 오늘의 산출물

- 각 CLI command의 argv·입력·출력·부작용 표
- `bookInput.js` 변환 pipeline 그림
- 정상·경계·오류 test case 10개 이상
- seed부터 Create/Read까지 상태 변화 기록표
- 생성 document의 실제 JSON과 입력 인자 mapping
- category/author/year 조회 확장안
- 6일차 형성평가와 입력 오류 회고

## 3. 시작 전 준비

```bash
git switch step-6
git branch --show-current
git status
npm ci
npm run check
npm test
```

MongoDB server와 `.env`의 강의 전용 database를 확인합니다. 오늘 사용할 collection은 `books_course`입니다. step-6부터 step-8까지 같은 collection을 이어 쓰므로 `seed`를 실행하면 이전 실습 변경이 사라진다는 점을 항상 알립니다.

### 기준 시작

```bash
npm start -- seed
npm start -- list
```

예상: sample book 3권입니다.

## 4. 360분 시간표

| 시간 | 블록 | 핵심 내용 | 필수 결과 |
| --- | --- | --- | --- |
| 00:00~01:00 | 1교시 | CLI, process.argv, command routing, seed | command/상태 표 |
| 01:00~02:00 | 2교시 | 입력 검증·정규화·document 변환 | 변환 pipeline과 오류 사례 |
| 02:00~03:00 | 3교시 | 단위 테스트와 경계값 | test matrix와 추가 test |
| 03:00~04:00 | 4교시 | Create, insertOne, unique | 생성·중복 결과 검증 |
| 04:00~05:00 | 5교시 | Read, find, filter, projection, sort | 전체·category 목록 |
| 05:00~06:00 | 6교시 | findOne, 없음 처리, 종합 반복 | 시나리오 로그와 평가 |

---

# 1교시. CLI와 반복 가능한 상태 — 60분

## 1-1. 프로그램이 명령을 받는 구조 — 10분

```bash
npm start -- add 978-00-0099 "새 도서" "학생 저자" 3 "database,mongodb"
```

`npm start`는 package script의 `node index.js`를 실행하고, `--` 뒤 인자를 Node.js 프로그램에 전달합니다.

개념적으로 `process.argv`는 다음과 같습니다.

```js
[
  '/path/to/node',
  '/path/to/index.js',
  'add',
  '978-00-0099',
  '새 도서',
  '학생 저자',
  '3',
  'database,mongodb',
]
```

stock `3`도 문자열입니다. terminal이 숫자 타입을 전달하지 않습니다.

## 1-2. command와 args 분리 — 10분

```js
const [command = 'help', ...args] = process.argv.slice(2)
```

위 add 명령에서:

```js
command === 'add'
args === [
  '978-00-0099',
  '새 도서',
  '학생 저자',
  '3',
  'database,mongodb',
]
```

인자가 없으면 command 기본값은 `help`입니다. help는 DB 연결 전에 반환하므로 연결 환경이 없어도 사용법을 볼 수 있습니다.

## 1-3. 따옴표와 shell parsing — 10분

공백이 있는 제목을 따옴표로 감싸지 않으면:

```bash
npm start -- add 978-x 새 도서 학생 저자 3 database
```

각 단어가 별도 인자가 되어 위치가 밀립니다. document 변환 함수는 두 번째 인자를 title, 세 번째를 author로 해석하므로 엉뚱한 값이나 stock 오류가 납니다.

안전한 예:

```bash
npm start -- add 978-x "새 도서" "학생 저자" 3 database
```

shell 종류에 따라 따옴표·escape 규칙이 다를 수 있으므로 실제 `process.argv.slice(2)`를 임시 출력해 진단합니다.

## 1-4. command별 책임 — 10분

```text
help   → 사용법 출력, DB 연결 없음
seed   → books_course 전체 초기화 후 sample 3건 생성
list   → 전체 또는 category별 여러 건 조회
get    → ISBN으로 한 건 조회
add    → 입력 변환 후 한 건 생성, 같은 ISBN 사후 조회
```

현재 step-6에는 Update/Delete가 없습니다. 7일차에 command map과 변경 기능을 추가합니다.

## 1-5. seed의 의미와 위험 — 10분

```js
async function seedBooks(books) {
  await books.deleteMany({})
  const result = await books.insertMany(sampleBooks)
  console.log(`샘플 도서 ${result.insertedCount}권 생성`)
}
```

seed는 test fixture 같은 기준 data를 재현합니다. 그러나 `books_course`의 모든 기존 document를 지웁니다.

실행 전 확인:

- 강의 전용 database인가?
- collection이 books_course인가?
- 개인 add 실습을 지워도 되는가?
- 예상 seed count는 3인가?

## 1-6. 독립 process와 지속 상태 — 10분

```bash
npm start -- seed
npm start -- add 978-x "지속성 실험" "학생" 1 practice
npm start -- get 978-x
```

각 명령은 새 Node.js process와 새 MongoClient 연결을 사용합니다. JavaScript 메모리 변수는 사라지지만 MongoDB document는 database에 남으므로 다음 명령에서 보입니다. 다시 seed하면 사라집니다.

### 1교시 체크포인트

- [ ] process.argv의 앞 두 항목과 사용자 인자를 구분했습니다.
- [ ] 공백 인자의 따옴표 필요성을 설명했습니다.
- [ ] command별 DB 부작용을 표로 만들었습니다.
- [ ] seed의 삭제 범위를 설명했습니다.

---

# 2교시. 입력 검증과 중첩 document 변환 — 60분

## 2-1. 입력 경계 세 단계 — 10분

```text
raw CLI string
  → validation: 허용 가능한가?
  → normalization: 같은 의미를 같은 형태로 만들기
  → transformation: DB document 구조 만들기
```

예:

```text
' Database, beginner, database '
  → 빈 category 제거
  → trim + lowercase + duplicate 제거
  → ['database', 'beginner']
```

## 2-2. 필수 text — 10분

```js
function requireText(value, fieldName) {
  const text = String(value ?? '').trim()

  if (!text) {
    throw new Error(`${fieldName} 값을 입력하세요.`)
  }

  return text
}
```

동작 표:

| 입력 | 변환 | 결과 |
| --- | --- | --- |
| `' 책 '` | trim | `'책'` |
| `''` | 빈 문자열 | 오류 |
| `'   '` | trim 후 빈 값 | 오류 |
| `undefined` | 빈 문자열 | 오류 |
| `null` | 빈 문자열 | 오류 |

ISBN 형식 자체를 검증하지는 않습니다. 필수 문자열만 보장하는 현재 범위를 정확히 말합니다.

## 2-3. stock parsing — 15분

```js
function parseStock(value) {
  const stock = Number(value)

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error('stock은 0 이상의 정수여야 합니다.')
  }

  return stock
}
```

허용:

- `'0'` → 0
- `'3'` → 3
- `0` → 0

거부:

- `'-1'`: 음수
- `'1.5'`: 정수가 아님
- `'abc'`: NaN, 정수가 아님
- `undefined`: NaN

주의: `Number('')`는 0이지만 CLI에서 stock 인자를 생략하면 undefined이므로 거부됩니다. 공백 문자열이 직접 전달될 가능성을 고려하면 더 엄격한 text 확인을 먼저 추가할 수 있습니다.

## 2-4. category normalization — 15분

```js
function parseCategories(value) {
  const categories = String(value ?? '')
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set(categories)]
}
```

단계별 결과:

```text
' Database, beginner, database, '
split       → [' Database', ' beginner', ' database', '']
trim/lower  → ['database', 'beginner', 'database', '']
filter      → ['database', 'beginner', 'database']
Set         → ['database', 'beginner']
```

category 인자가 없으면 빈 배열입니다. category를 최소 1개 필수로 할지는 업무 규칙입니다.

## 2-5. document 조립 — 10분

```js
function createBookDocument(args) {
  const [isbnValue, titleValue, authorValue, stockValue, categoriesValue] = args

  return {
    isbn: requireText(isbnValue, 'isbn'),
    title: requireText(titleValue, 'title'),
    author: {
      name: requireText(authorValue, 'author'),
      country: 'KR',
    },
    categories: parseCategories(categoriesValue),
    publisherCode: 'STUDENT',
    inventory: {
      stock: parseStock(stockValue),
      location: 'PRACTICE',
    },
    publishedYear: new Date().getFullYear(),
    reviews: [],
    courseSeed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
```

CLI의 평평한 다섯 값이 author/inventory 중첩 객체, categories/reviews 배열, Date field를 가진 일관된 document가 됩니다.

### 2교시 체크포인트

- [ ] validation/normalization/transformation을 구분했습니다.
- [ ] stock 정상·경계·오류 값을 분류했습니다.
- [ ] category 변환 단계를 손으로 추적했습니다.
- [ ] CLI 인자와 최종 document field를 연결했습니다.

---

# 3교시. 단위 테스트와 경계값 — 60분

## 3-1. DB 없이 입력 함수를 test하는 이유 — 10분

`bookInput.js`는 MongoDB 연결 없이 실행 가능한 순수 변환 중심 모듈입니다. 입력 오류를 빠르고 반복 가능하게 확인하며 연결 실패와 validation 실패를 분리합니다.

```bash
npm test
```

Node.js 내장 test runner가 `test/*.test.js`를 실행합니다.

## 3-2. 정상·경계·오류 분류 — 10분

| 분류 | stock 예 | category 예 | 목적 |
| --- | --- | --- | --- |
| 정상 | 3 | database,mongodb | 대표 성공 |
| 경계 | 0 | 빈 값 | 허용 경계 확인 |
| 오류 | -1, 1.5, abc | 정책에 따라 | 거부와 메시지 |
| 정규화 | `' 3 '` | 공백·대문자·중복 | canonical form |

정상 사례 하나만 통과한다고 validation이 충분한 것은 아닙니다.

## 3-3. parseStock test — 10분

```js
test('parseStock은 0 이상의 정수를 반환한다', () => {
  assert.equal(parseStock('3'), 3)
  assert.equal(parseStock(0), 0)
})
```

```js
test('parseStock은 음수와 소수를 거부한다', () => {
  assert.throws(() => parseStock('-1'), /0 이상의 정수/)
  assert.throws(() => parseStock('1.5'), /0 이상의 정수/)
})
```

오류 타입만 아니라 사용자가 이해할 메시지 일부도 정규식으로 확인합니다.

## 3-4. parseCategories test — 10분

```js
assert.deepEqual(
  parseCategories(' Database, beginner, database '),
  ['database', 'beginner'],
)
```

array/object 비교는 `deepEqual`을 사용합니다. 원소 순서도 확인하므로 첫 등장 순서를 유지하는 Set 동작을 검증합니다.

## 3-5. document shape test — 10분

```js
const book = createBookDocument([
  '978-test',
  '테스트 도서',
  '테스트 저자',
  '2',
  'database,mongodb',
])

assert.equal(book.author.name, '테스트 저자')
assert.equal(book.inventory.stock, 2)
assert.deepEqual(book.categories, ['database', 'mongodb'])
```

날짜의 정확한 현재 시각을 고정 값으로 비교하지 않고 type과 필요한 범위를 확인합니다.

```js
assert.ok(book.createdAt instanceof Date)
```

## 3-6. 독립 test 추가 — 10분

최소 네 개를 추가합니다.

1. `parseStock('abc')` 오류
2. `parseStock('0')` 성공
3. `parseCategories()`가 빈 배열
4. 빈 title에서 `createBookDocument` 오류
5. author 앞뒤 공백 제거
6. courseSeed가 false

기준 답을 그대로 복사하기 전에 기대값을 먼저 적습니다.

### 3교시 체크포인트

- [ ] MongoDB 없이 입력 test를 실행했습니다.
- [ ] 정상·경계·오류 test를 구분했습니다.
- [ ] array는 deepEqual로 검증했습니다.
- [ ] 새 test 네 개 이상을 설계하거나 구현했습니다.

---

# 4교시. Create와 insertOne — 60분

## 4-1. collection 준비 — 10분

```js
async function prepareCollection(database) {
  const books = database.collection('books_course')
  await books.createIndex({ isbn: 1 }, { unique: true })
  await books.createIndex({ categories: 1 })
  return books
}
```

각 command가 실행될 때 index 생성 요청을 다시 해도 같은 정의가 이미 있으면 재사용됩니다. ISBN 고유성과 category 조회를 모든 command의 전제로 준비합니다.

## 4-2. add command 입력 — 10분

```bash
npm start -- add 978-00-0099 "새 도서" "학생 저자" 3 "database,mongodb"
```

실행 전 예상 document:

```js
{
  isbn: '978-00-0099',
  title: '새 도서',
  author: { name: '학생 저자', country: 'KR' },
  categories: ['database', 'mongodb'],
  publisherCode: 'STUDENT',
  inventory: { stock: 3, location: 'PRACTICE' },
  reviews: [],
  courseSeed: false,
  // 현재 year와 Date field
}
```

## 4-3. insertOne — 10분

```js
async function addBook(books, args) {
  const book = createBookDocument(args)
  const result = await books.insertOne(book)
  console.log(`도서 생성 완료: ${book.isbn}, id=${result.insertedId}`)
  await getBook(books, book.isbn)
}
```

순서:

1. raw args 검증/변환
2. document 한 건 insert
3. insertedId 출력
4. ISBN으로 사후 조회

insertedId는 MongoDB 내부 식별이고 ISBN은 사용자 업무 식별입니다. 둘 다 생성 증거에 유용합니다.

## 4-4. 생성 전후 count — 10분

기준 seed 후:

```bash
npm start -- list
```

3권을 확인합니다. add 후 다시 list하면 4권이어야 합니다.

| 시점 | 예상 count | 확인 명령 |
| --- | ---: | --- |
| seed 직후 | 3 | list |
| add 직후 | 4 | get + list |
| 같은 ISBN add 실패 뒤 | 4 | list |
| seed 재실행 뒤 | 3 | list |

## 4-5. unique 실패 — 10분

같은 add를 다시 실행합니다.

```bash
npm start -- add 978-00-0099 "중복 도서" "다른 저자" 1 practice
```

예상:

- ISBN unique index에서 오류
- 두 번째 document는 생성되지 않음
- 전체 count는 4 유지
- 기존 978-00-0099 내용은 그대로

사전 duplicate 조회를 추가하면 더 친절한 메시지를 줄 수 있지만 동시 요청 최종 보장은 unique index가 담당합니다.

## 4-6. 오류 입력 실험 — 10분

각 명령의 실패 계층을 기록합니다.

```bash
npm start -- add 978-x "음수 재고" "학생" -1 practice
npm start -- add 978-y "소수 재고" "학생" 1.5 practice
npm start -- add 978-z "인자 부족"
```

입력 변환 단계에서 실패하므로 insertOne까지 도달하지 않습니다. 목록 count가 바뀌지 않았는지 확인합니다.

### 4교시 체크포인트

- [ ] createBookDocument 결과를 실행 전에 적었습니다.
- [ ] insertedId와 ISBN 사후 조회를 확인했습니다.
- [ ] add 전후 count를 비교했습니다.
- [ ] unique와 validation 실패에서 state가 유지됨을 확인했습니다.

---

# 5교시. Read 목록: find, filter, projection, sort — 60분

## 5-1. list command — 10분

```bash
npm start -- list
npm start -- list database
```

첫 명령은 모든 book, 두 번째는 categories에 database가 포함된 book만 반환합니다.

## 5-2. 동적 filter — 10분

```js
const filter = category
  ? { categories: category.toLowerCase() }
  : {}
```

- category 있음: 배열 포함 filter
- category 없음: 전체 filter `{}`

현재는 `trim()`을 하지 않으므로 shell 인자에 앞뒤 공백이 포함된 경우 예상과 다를 수 있습니다. 개선안:

```js
const normalized = String(category ?? '').trim().toLowerCase()
const filter = normalized ? { categories: normalized } : {}
```

## 5-3. projection — 10분

```js
projection: {
  _id: 0,
  isbn: 1,
  title: 1,
  'author.name': 1,
  categories: 1,
  'inventory.stock': 1,
}
```

목록에 필요한 field만 반환합니다. publisherCode, reviews, createdAt 등은 상세 조회에서만 필요하다고 가정합니다.

중첩 projection 결과는 author와 inventory object 구조를 유지합니다.

## 5-4. sort와 toArray — 10분

```js
const rows = await books
  .find(filter, { projection })
  .sort({ title: 1 })
  .toArray()
```

title이 같은 문서가 있을 수 있으므로 완전히 안정적인 순서가 필요하면 ISBN을 추가합니다.

```js
.sort({ title: 1, isbn: 1 })
```

cursor를 toArray로 소비한 뒤 `rows.length`를 출력합니다.

## 5-5. category 시나리오 — 10분

seed 기준 예상:

| 명령 | 예상 count | 제목 |
| --- | ---: | --- |
| list | 3 | 전체 |
| list database | 2 | 데이터..., MongoDB... |
| list beginner | 2 | 데이터..., Node.js... |
| list mongodb | 1 | MongoDB 첫걸음 |
| list unknown | 0 | 없음 |

add로 새 category를 만든 뒤 결과가 어떻게 달라지는지 기록합니다.

## 5-6. 조회 0건 처리 — 10분

현재 코드는 `조회 결과: 0권`과 빈 배열을 출력합니다. 개선할 수 있습니다.

```js
if (rows.length === 0) {
  console.log('조건에 맞는 도서가 없습니다.')
  return
}
```

0건은 예외가 아니라 filter에 맞는 data가 없는 정상 상태입니다. 사용자 검색에서는 어떤 category를 사용했는지도 메시지에 포함할 수 있습니다.

### 5교시 체크포인트

- [ ] category 유무에 따른 filter를 설명했습니다.
- [ ] 목록 projection field의 선택 근거를 말했습니다.
- [ ] title sort와 안정 정렬을 구분했습니다.
- [ ] 0건을 정상 결과로 처리했습니다.

---

# 6교시. Read 한 건과 종합 반복 — 60분

## 6-1. get command — 10분

```bash
npm start -- get 978-00-0001
```

```js
async function getBook(books, isbn) {
  if (!isbn) {
    throw new Error('조회할 isbn을 입력하세요.')
  }

  const book = await books.findOne(
    { isbn },
    { projection: { _id: 0 } },
  )

  if (!book) {
    console.log('도서를 찾지 못했습니다.')
    return
  }

  console.log(JSON.stringify(book, null, 2))
}
```

## 6-2. findOne 조건과 unique — 10분

ISBN unique index가 있으므로 business identifier로 한 document를 찾습니다. 제목은 중복 가능하므로 한 건 식별 조건에 적합하지 않습니다.

```bash
npm start -- get not-found
```

없는 ISBN은 null이며 오류가 아니라 없음 메시지입니다.

```bash
npm start -- get
```

인자 자체가 없으면 입력 오류를 throw합니다. 없음과 잘못된 요청을 구분합니다.

## 6-3. 추천 반복 시나리오 — 15분

각 단계의 예상 count와 대상 값을 먼저 적습니다.

```bash
npm start -- seed
npm start -- list
npm start -- list database
npm start -- add 978-00-0099 "실습용 MongoDB" "학생 저자" 4 "database,practice"
npm start -- get 978-00-0099
npm start -- list practice
npm start -- list
npm start -- add 978-00-0099 "중복" "누구" 1 test
npm start -- list
```

예상 count 흐름:

```text
3 → 3 → 2 → 4 → 1건 상세 → 1 → 4 → 중복 실패 → 4
```

## 6-4. 독립 확장 — 10분

다음 중 하나를 설계합니다.

### author 목록

```bash
npm start -- list-author "김데이터"
```

filter: `{ 'author.name': authorName }`

### 출판 연도 목록

```bash
npm start -- list-year 2026
```

연도 문자열을 정수로 검증한 뒤 `{ publishedYear: year }` filter를 사용합니다.

### 최소 재고 목록

```bash
npm start -- list-stock 3
```

parseStock 재사용 후 `{ 'inventory.stock': { $gte: stock } }`를 사용합니다.

## 6-5. command routing 읽기 — 10분

step-6은 if/else로 command를 연결합니다.

```js
if (command === 'seed') {
  await seedBooks(books)
} else if (command === 'list') {
  await listBooks(books, args[0])
} else if (command === 'get') {
  await getBook(books, args[0])
} else if (command === 'add') {
  await addBook(books, args)
} else {
  showHelp()
  throw new Error(`알 수 없는 command: ${command}`)
}
```

알 수 없는 command는 help를 보여주고 비정상 상태로 종료합니다. 7일차에는 command map으로 확장됩니다.

## 6-6. 출구 티켓 — 5분

1. 빈 get 인자와 존재하지 않는 ISBN은 어떻게 다른가?
2. add 후 get을 즉시 실행하는 이유는?
3. seed를 실행하기 전에 반드시 확인할 state는?

---

# 7. 기준 코드 전체 흐름

```text
process.argv에서 command/args 분리
  → help면 DB 연결 없이 출력
  → withDatabase connect
  → books_course + index 준비
  → command별 함수 실행
      seed: 전체 삭제 + sample insertMany
      list: filter + projection + sort + toArray
      get: ISBN validation + findOne
      add: args validation/transform + insertOne + get
  → callback 완료
  → finally close
  → 오류는 main catch에서 출력
```

## 7-1. 관심사 분리

| 파일/함수 | 책임 |
| --- | --- |
| `lib/mongodb.js` | env, 안전 database, 연결 생명주기 |
| `lib/sampleBooks.js` | 기준 seed document |
| `lib/bookInput.js` | raw args 검증·정규화·document 생성 |
| `index.js` | command routing과 DB operation |
| `test/bookInput.test.js` | 입력 함수의 정상·경계·오류 검증 |

입력 오류를 DB 함수 안에서 뒤늦게 처리하지 않고 독립 module과 test로 분리했습니다.

## 7-2. Create/Read의 결과 type

| 작업 | 반환/결과 | 반드시 확인할 값 |
| --- | --- | --- |
| insertOne | InsertOneResult | insertedId |
| insertMany | InsertManyResult | insertedCount |
| find | cursor | toArray 결과 length |
| findOne | document 또는 null | 존재 여부와 field |

## 7-3. state reset과 persistence

`seed`만 전체 초기화합니다. list/get/add는 collection을 비우지 않습니다. command를 여러 번 실행해도 add data가 유지되는 것이 정상입니다.

## 7-4. error 계층

```text
shell parsing 오류
  → required arg/validation 오류
  → MongoDB 연결 오류
  → unique/index DB 오류
  → query 0건 정상 상태
```

메시지와 해결 행동이 다르므로 하나의 실패 문자열로 뭉치지 않습니다.

---

# 8. 추가 입력·조회 예제

## 예제 A. ISBN 형식 검증

현재 requireText만 사용하므로 `x`도 ISBN으로 저장됩니다. 교육용 형식을 제한하려면:

```js
function parseIsbn(value) {
  const isbn = requireText(value, 'isbn')

  if (!/^978-[0-9-]+$/.test(isbn)) {
    throw new Error('isbn 형식을 확인하세요.')
  }

  return isbn
}
```

실제 ISBN 규칙은 더 복잡하므로 요구 범위와 검증 정확도를 문서화합니다.

## 예제 B. publishedYear 입력

```js
function parseYear(value) {
  const year = Number(value)
  const currentYear = new Date().getFullYear()

  if (!Number.isInteger(year) || year < 1000 || year > currentYear + 1) {
    throw new Error('출판 연도를 확인하세요.')
  }

  return year
}
```

미래 출간 예정 책을 허용할지 업무 규칙을 먼저 정합니다.

## 예제 C. country 입력

국가 코드를 받으면 trim과 uppercase normalization을 하고 허용 code 목록 또는 별도 source 검증을 검토합니다.

```js
const country = requireText(value, 'country').toUpperCase()
```

## 예제 D. category exact vs 부분 문자열

`{ categories: 'data' }`는 `database`의 부분 문자열로 일치하지 않습니다. category는 canonical exact token으로 저장하고 조회합니다. free text 검색과 tag 검색을 구분합니다.

## 예제 E. projection 변형

관리자 목록에는 publisherCode와 courseSeed가 필요할 수 있습니다.

```js
projection: {
  _id: 0,
  isbn: 1,
  title: 1,
  publisherCode: 1,
  courseSeed: 1,
}
```

화면마다 별도 projection을 설계합니다.

## 예제 F. limit과 안정 정렬

```js
const rows = await books
  .find(filter, { projection })
  .sort({ title: 1, isbn: 1 })
  .limit(10)
  .toArray()
```

## 예제 G. countDocuments

목록을 모두 가져오지 않고 건수만 필요하면:

```js
const count = await books.countDocuments({ categories: 'database' })
```

list 결과 length와 같은 filter인지 비교합니다.

---

# 9. 연습 문제

## CLI와 입력

1. 제목 따옴표를 제거해 argv가 어떻게 깨지는지 관찰합니다.
2. 빈 title, 빈 author, stock 누락의 오류 메시지를 비교합니다.
3. stock `0`, `-1`, `1.5`, `abc` test를 작성합니다.
4. category 대문자·공백·중복 normalization을 직접 추적합니다.
5. ISBN 형식 validation 정책을 정의하고 test를 작성합니다.

## Create

6. category 없이 책을 생성하고 빈 배열이 의도와 맞는지 토론합니다.
7. stock 0 책을 생성하고 get으로 numeric type을 확인합니다.
8. 같은 ISBN을 두 번 생성해 count가 늘지 않는지 확인합니다.
9. add 전후 전체 count를 기록합니다.
10. insertedId와 ISBN 각각의 식별 역할을 설명합니다.

## Read

11. database, beginner, mongodb, unknown category 결과를 비교합니다.
12. author.name exact filter command를 설계합니다.
13. publishedYear integer filter command를 설계합니다.
14. 최소 stock filter와 재고 역순 sort를 추가합니다.
15. 없는 get과 인자 없는 get 메시지를 구분합니다.

## test와 설계

16. createBookDocument가 Date 두 개를 만드는지 test합니다.
17. publisherCode와 location 기본값을 test합니다.
18. parseCategories가 빈 원소를 제거하는지 test합니다.
19. add command의 DB 통합 test를 만들려면 어떤 fixture/cleanup이 필요한지 적습니다.
20. seed를 실제 서비스에서 별도 권한으로 제한해야 하는 이유를 적습니다.

<details>
<summary>핵심 힌트</summary>

- shell 문제는 `console.log(process.argv.slice(2))`로 먼저 봅니다.
- author filter는 점 표기법을 사용합니다.
- 최소 재고는 parseStock 재사용 후 `$gte`입니다.
- Date는 `instanceof Date`로 type을 확인할 수 있습니다.
- DB 통합 test는 강의 전용 test database/collection, 독립 seed, cleanup, 병렬 실행 격리가 필요합니다.

</details>

---

# 10. 자주 만나는 문제와 진단

## title이 여러 인자로 나뉩니다

공백이 있는 title과 author를 큰따옴표로 감쌉니다. shell parsing 결과를 먼저 확인합니다.

## stock이 0인데 오류가 납니다

`if (!stock)`처럼 truthy 검사로 0을 거부하지 않았는지 봅니다. 기준은 `Number.isInteger(stock) && stock >= 0`입니다.

## stock 공백이 0으로 바뀝니다

`Number('') === 0` 특성이 있습니다. 공백 입력도 거부하려면 변환 전에 `requireText`와 비슷한 검사를 추가합니다.

## category가 검색되지 않습니다

- add 때 lowercase normalization됐는지
- list에서 입력을 lowercase 처리했는지
- 앞뒤 공백이 남았는지
- exact array token인지
- seed를 다시 실행해 add document가 사라졌는지

를 확인합니다.

## duplicate key 오류

ISBN unique index가 작동한 결과입니다. 다른 ISBN을 사용하거나 의도적으로 기준 상태를 재현할 때만 seed합니다. index를 제거하지 않습니다.

## add는 성공했는데 다음 명령에서 없습니다

- 같은 `MONGODB_DB`와 `books_course`인지
- 중간에 seed를 실행했는지
- add가 validation/unique 오류로 실제 실패했는지
- get ISBN의 공백/문자가 같은지

를 확인합니다.

## list 결과가 매번 순서가 다릅니다

명확한 sort와 동률 해소 field를 확인합니다. title만 같을 수 있으면 ISBN을 추가합니다.

## help인데 MongoDB 연결 오류가 나면 안 됩니다

기준 코드는 help에서 `withDatabase` 전에 return합니다. command 처리 순서가 바뀌지 않았는지 봅니다.

## test는 통과하지만 add가 실패합니다

단위 test는 입력 변환만 검증합니다. MongoDB 연결, index, 실제 insert는 별도 계층입니다. 오류 메시지를 계층별로 분류합니다.

---

# 11. 형성평가 — 20점

## 문항

1. `process.argv.slice(2)`에서 command와 args를 어떻게 나누는지 설명하세요. (2점)
2. 공백 title에 shell 따옴표가 필요한 이유는? (2점)
3. validation, normalization, transformation을 category 예로 설명하세요. (2점)
4. parseStock이 `0`은 허용하고 `1.5`는 거부하는 기준은? (2점)
5. createBookDocument가 만드는 중첩 구조 두 개와 배열 두 개를 적으세요. (2점)
6. 입력 함수를 MongoDB 없이 test하는 장점은? (2점)
7. seed의 목적과 위험을 하나씩 적으세요. (2점)
8. insertOne 성공을 확인할 두 증거는? (2점)
9. find와 findOne의 반환/없음 차이는? (2점)
10. 사전 중복 조회가 있어도 unique index가 필요한 이유는? (2점)

<details>
<summary>평가 기준</summary>

1. 첫 user arg를 command, 나머지를 args로 구조 분해합니다.
2. shell이 공백을 인자 경계로 해석하기 때문입니다.
3. 빈 값 거부, lowercase/trim/dedupe, array document field 생성을 구분합니다.
4. 0 이상의 정수입니다.
5. author/inventory, categories/reviews입니다.
6. 빠르고 연결 오류와 입력 오류를 분리합니다.
7. 기준 상태 재현과 기존 collection 전체 삭제입니다.
8. insertedId와 ISBN 사후 get/count 등을 적습니다.
9. find는 cursor→array 여러 건, findOne은 document/null입니다.
10. 동시 요청 사이의 중복 경쟁을 DB 경계에서 막습니다.

</details>

## 점수 해석

- 17~20점: Update/Delete/Search 단계 진행
- 13~16점: 입력 변환 또는 Create/Read 반복 보충
- 9~12점: test matrix와 seed→add→get 흐름 재실행
- 0~8점: argv와 document mapping부터 재학습

---

# 12. 완료 기준

- [ ] step-6와 books_course 지속 collection을 확인했습니다.
- [ ] process.argv에서 command와 args를 추적했습니다.
- [ ] shell 따옴표 오류를 설명했습니다.
- [ ] seed의 삭제 범위와 기준 count를 확인했습니다.
- [ ] requireText, parseStock, parseCategories를 설명했습니다.
- [ ] raw args가 중첩 document가 되는 과정을 추적했습니다.
- [ ] 정상·경계·오류 단위 test를 실행했습니다.
- [ ] add로 document 한 건을 생성했습니다.
- [ ] insertedId와 ISBN get으로 생성을 검증했습니다.
- [ ] 같은 ISBN unique 오류와 state 유지를 확인했습니다.
- [ ] list 전체/category filter를 실행했습니다.
- [ ] projection, sort, toArray 결과 length를 설명했습니다.
- [ ] get 성공, null, 인자 오류를 구분했습니다.
- [ ] seed→list→add→get→list 시나리오를 기록했습니다.
- [ ] 형성평가에서 13점 이상을 받았습니다.

## 회복 경로

1. npm test 통과
2. seed 후 3권 확인
3. 정상 add 후 4권과 get 확인
4. duplicate add 실패 후 4권 유지
5. category list와 없는 get 실행

## 확장 경로

1. author/year/minStock list command
2. ISBN·year validation과 test
3. stable sort와 limit
4. countDocuments summary
5. 강의 전용 integration test 설계

## 다음 단계 연결

오늘은 Create와 Read로 state를 만들고 확인했습니다. 7일차에는 복합 search, 부분 Update, 안전 Delete를 추가합니다. 특히 `matchedCount`와 `modifiedCount`가 다른 이유를 살피고, 같은 category를 두 번 추가했을 때 배열 중복은 막히더라도 `updatedAt` 같은 동시 변경 때문에 `modifiedCount`가 0이 아닐 수 있음을 관찰합니다.

> 재고를 현재 값과 같은 값으로 update하면 document는 찾았지만 바뀐 것은 없다. 이것을 대상 없음과 어떻게 구분할까?
