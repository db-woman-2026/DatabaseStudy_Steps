# Step 4. MongoDB와 JSON/BSON 문서 기초

앞의 3일은 데이터를 테이블로 나누고 외래 키와 JOIN으로 연결했습니다. 4일차에는 같은 도서 정보를 MongoDB 문서 한 건으로 저장합니다. 중첩 객체와 배열을 사용할 때 애플리케이션이 맡아야 할 검증과 안전 범위도 확인합니다.

## 0. 먼저 생각할 질문

1. JSON 문자열, JavaScript 객체, BSON 문서는 어떻게 다른가?
2. MongoDB 서버, 데이터베이스, 컬렉션, 문서, 필드는 어떤 계층인가?
3. SQL에서 나눈 저자·재고·카테고리를 한 문서에 넣으면 무엇이 쉬워지고 어떤 비용이 생기는가?
4. URI와 데이터베이스 이름은 왜 코드 밖 환경 변수로 관리하는가?
5. `find()`가 즉시 배열을 반환하지 않고 커서를 반환하는 이유는 무엇인가?
6. 생성과 조회가 성공했음을 어떤 ID·건수·사후 조회로 증명하는가?

## 1. 수업 목표

### 개념

- JSON과 BSON의 관계 및 String, Number, Date, ObjectId, Array, embedded 문서를 구분합니다.
- 배포 환경/서버, 데이터베이스, 컬렉션, 문서, 필드, `_id` 계층을 설명합니다.
- 테이블/행/열과 컬렉션/문서/필드를 공통점과 차이점으로 비교합니다.
- 유연한 스키마가 무규칙을 뜻하지 않는 이유를 설명합니다.
- 중첩 객체와 배열을 문서에 포함하는 장점과 성장 위험을 설명합니다.

### 실습

- `.env.example`을 복사하고 강의용 데이터베이스 이름을 설정합니다.
- `MongoClient` 연결, 콜백 작업, `close()` 흐름을 추적합니다.
- 현재 단계 전용 `books_step4` 컬렉션만 초기화합니다.
- `insertMany()` 결과의 `insertedCount`를 확인합니다.
- `find()` 커서에 프로젝션·정렬을 구성하고 `toArray()`로 소비합니다.
- `findOne()`으로 ISBN 한 권을 조회하고 `null`을 처리합니다.
- 배열 값과 점 표기법으로 중첩 필드를 조회합니다.

### 작업 원칙

- 실제 서비스 URI와 데이터베이스를 강의 실습에 사용하지 않습니다.
- `deleteMany({})` 전에 데이터베이스와 컬렉션 이름을 소리 내어 확인합니다.
- 문서 구조가 객체처럼 보인다는 이유로 타입과 검증을 생략하지 않습니다.
- 비동기 오류가 나도 연결 정리 경로가 실행되는지 확인합니다.

## 2. 수업 결과물

- RDBMS 행과 MongoDB 문서 비교표
- MongoDB 계층 구조 그림
- 예시 문서의 필드·타입·중첩 깊이 분석표
- 기본 목록, 한 건, 배열 조건, 중첩 필드 조건 조회 결과
- 정상 연결과 의도된 연결/안전 오류 진단 기록
- 새 도서 문서 한 건과 사후 조회 결과
- 형성평가 및 포함하기 쉬운 데이터/주의할 데이터 회고

## 3. 시작 전 준비

### 3.1 브랜치와 패키지

```bash
git switch step-4
git branch --show-current
git status
npm ci
npm run check
```

`step-4`부터 `mongodb` Node.js Driver가 dependency에 추가됩니다. `npm ci`는 lockfile에 고정된 버전을 설치합니다.

### 3.2 환경 변수

```bash
cp .env.example .env
```

로컬 기본 예:

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=database_study_course
```

- `.env`는 개인 연결 정보가 들어갈 수 있어 Git에 커밋하지 않습니다.
- `MONGODB_DB`는 반드시 `database_study_`로 시작합니다.
- 실제 업무 데이터베이스 이름이나 URI를 넣지 않습니다.

### 3.3 MongoDB 연결 확인

로컬 MongoDB 서버 또는 강의 전용 Atlas 데이터베이스가 필요합니다.

```bash
npm start
```

연결에 실패해도 바로 코드를 바꾸지 않습니다. 오류 진단 절의 순서대로 서버, URI, 네트워크, 인증, 데이터베이스 이름을 분리해 확인합니다.

## 4. 360분 시간표

| 시간 | 블록 | 내용 | 필수 결과 |
| --- | --- | --- | --- |
| 00:00~01:00 | 1교시 | RDBMS→문서, JSON/객체/BSON | 구조·타입 비교표 |
| 01:00~02:00 | 2교시 | MongoDB 계층, `_id`, 유연한 스키마 | 계층 그림과 문서 해부 |
| 02:00~03:00 | 3교시 | 환경 변수, 연결, 비동기/await, 안전 경계 | 연결 생명주기 추적 |
| 03:00~04:00 | 4교시 | 컬렉션 초기화, insertMany, 결과 객체 | 문서 3건 생성·검증 |
| 04:00~05:00 | 5교시 | find, 커서, 프로젝션, 정렬, findOne | 목록·상세 조회 |
| 05:00~06:00 | 6교시 | 배열·중첩 조건, 변형 문서, 비교 실습 | 조건 조회와 새 문서 |

---

# 1교시. 관계형 행에서 BSON 문서로 — 60분

## 1-1. 3일차 회수 — 10분

SQL에서 도서 제목과 저자 이름을 함께 보려면 `books.author_id → authors.id` 관계를 JOIN했습니다. 재고는 books 열, 대출은 loans 테이블, 카테고리는 별도 테이블이 필요할 수 있습니다.

다음 질문에 답합니다.

- 도서 상세 화면에서 제목·저자 요약·재고 위치를 항상 함께 읽는다면 JOIN 없이 한 저장 단위에서 읽을 수 있을까?
- 저자 이름이 바뀌면 여러 도서 문서의 복사본을 어떻게 할까?

오늘은 첫 질문의 편의부터 체험하고, 5일차에 두 번째 질문을 모델링 판단으로 다룹니다.

## 1-2. 같은 도서를 두 방식으로 표현 — 15분

### 관계형

```text
authors
{ id: 1, name: 김데이터, country: KR }

books
{ id: 10, isbn: 978-00-0001, title: 데이터를 배우는 시간, author_id: 1, stock: 3 }
```

### 문서형

```js
{
  isbn: '978-00-0001',
  title: '데이터를 배우는 시간',
  author: {
    name: '김데이터',
    country: 'KR',
  },
  categories: ['database', 'beginner'],
  inventory: {
    stock: 3,
    location: 'A-01',
  },
}
```

문서 하나를 읽으면 도서 상세에 필요한 작은 저자 요약과 재고가 함께 옵니다. 대신 author 정보가 여러 도서에 복사될 수 있고, 구조가 다른 문서가 섞이지 않도록 규칙이 필요합니다.

## 1-3. JavaScript 객체와 JSON — 10분

```js
const book = {
  title: 'MongoDB 첫걸음',
  createdAt: new Date('2026-07-02T00:00:00.000Z'),
}

const jsonText = JSON.stringify(book)
```

`book`은 런타임 JavaScript 객체이고 `jsonText`는 텍스트 문자열입니다. JSON으로 직렬화할 때 Date는 ISO 문자열 모양이 됩니다. MongoDB Driver에는 보통 JSON 문자열이 아니라 JavaScript 객체를 전달하며 Driver가 Date 같은 값을 BSON 타입으로 직렬화합니다.

## 1-4. BSON 타입 — 10분

| 예시 필드 | JavaScript 값 | 저장 의미 |
| --- | --- | --- |
| `title` | String | 문자열 |
| `inventory.stock` | Number | 숫자 비교·집계 가능 |
| `courseSeed` | Boolean | true/false |
| `createdAt` | Date | 날짜 정렬·범위 조건 |
| `categories` | Array | 여러 원소 |
| `author` | Object | embedded 문서 |
| `_id` | 생략 | 기본 ObjectId 생성 |

`stock: '3'` 문자열과 `stock: 3` 숫자는 다른 타입입니다. 유연한 문서라도 타입 일관성이 조회와 집계에 중요합니다.

## 1-5. 구조 선택 비교 활동 — 10분

다음 데이터를 관계형 테이블 분리와 문서 포함 중 어느 쪽으로 먼저 검토할지 이유를 적습니다.

1. 주문 당시 배송 주소
2. 회원의 현재 주소
3. 도서의 카테고리 2~5개
4. 초당 생성되는 센서 값
5. 상품 상세의 작은 크기 옵션 목록
6. 게시글의 수십만 댓글

<details>
<summary>토론 기준</summary>

- 과거 snapshot인 주문 배송 주소와 bounded 배열인 카테고리는 포함 후보입니다.
- 독립적으로 바뀌고 공유되는 회원 주소는 참조/별도 관리 후보입니다.
- 무한 성장 가능한 센서 값과 대규모 댓글은 한 문서 배열에 계속 넣지 않습니다.
- 정답은 읽기·변경·크기 요구에 따라 달라집니다.

</details>

## 1-6. 확인 — 5분

- JSON 문자열과 JavaScript 객체를 한 문장씩 정의합니다.
- BSON이 JSON보다 표현할 수 있는 타입 두 개를 적습니다.
- 문서 포함의 장점과 비용을 하나씩 적습니다.

### 1교시 체크포인트

- [ ] 같은 도서를 행과 문서로 비교했습니다.
- [ ] 객체와 JSON 문자열을 구분했습니다.
- [ ] Date와 ObjectId가 BSON 타입임을 설명했습니다.
- [ ] 중첩 구조가 항상 정답은 아님을 설명했습니다.

---

# 2교시. MongoDB 계층과 예시 문서 — 60분

## 2-1. 구조 계층 — 10분

```text
MongoDB server/deployment
└── database_study_course           database
    └── books_step4                 collection
        ├── book document 1
        ├── book document 2
        └── book document 3
```

오늘 `deleteMany({})`가 적용되는 범위는 서버 전체도 데이터베이스 전체도 아닌 `books_step4` 컬렉션의 문서입니다.

## 2-2. 관계형 용어와 비교 — 10분

| 관계형 | MongoDB | 비슷한 점 | 중요한 차이 |
| --- | --- | --- | --- |
| 데이터베이스 | 데이터베이스 | 관련 데이터 묶음 | 제품별 namespace/운영 차이 |
| 테이블 | 컬렉션 | 같은 목적의 여러 건 | 문서마다 필드가 다를 수 있음 |
| 행 | 문서 | 한 대상/사건 | 문서는 중첩 객체·배열 포함 |
| 열 | 필드 | 이름 있는 값 | 문서마다 존재 여부·타입이 다를 수 있음 |
| PK | `_id`/unique index | 고유 식별 | 참조·생성 방식 차이 |

완전히 같다고 치환하지 않고 학습 연결을 위한 비교로 사용합니다.

## 2-3. `_id` — 10분

예시 object에는 `_id`가 없습니다.

```js
await books.insertMany(sampleBooks)
```

저장 시 각 문서에 `_id`가 추가됩니다. 기본 ObjectId는 고유 식별에 사용되고 `_id` unique index가 자동으로 존재합니다. 오늘 목록 프로젝션은 `_id: 0`으로 숨기지만 저장되지 않은 것이 아닙니다.

ISBN도 업무상 식별자지만 step-4에서는 아직 unique index를 만들지 않습니다. 5일차에 고유성 보장을 추가합니다.

## 2-4. 첫 sampleBooks 해부 — 15분

```js
{
  isbn: '978-00-0001',
  title: '데이터를 배우는 시간',
  author: { name: '김데이터', country: 'KR' },
  categories: ['database', 'beginner'],
  inventory: { stock: 3, location: 'A-01' },
  publishedYear: 2025,
  reviews: [],
  courseSeed: true,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
}
```

| 필드 path | type | 필수로 볼지 | 변경 빈도 | 함께 읽는가 |
| --- | --- | --- | --- | --- |
| isbn | String | 예 | 낮음 | 예 |
| author.name | String | 예 | 낮음/중간 | 예 |
| categories | Array<String> | 예 | 중간 | 목록에서 사용 |
| inventory.stock | Number | 예 | 높음 | 예 |
| reviews | Array<Document> | 예 | 높음/성장 | 상세에서 사용 |
| createdAt | Date | 예 | 생성 후 불변 | 필요 시 |

이 표는 5일차 포함/참조 판단의 입력이 됩니다.

## 2-5. 유연한 스키마 실험 사고 — 10분

다음 문서들도 같은 컬렉션에 기술적으로 저장될 수 있습니다.

```js
{ title: '제목만 있는 책' }
{ title: 123, inventory: { stock: '많음' } }
{ isbn: 'x', stock: 3 }
```

문제:

- `inventory.stock >= 2` 조건이 모든 문서에서 같은 의미가 아닙니다.
- title 정렬에서 숫자와 문자열 타입이 섞입니다.
- 어떤 코드가 `book.author.name`을 읽을 때 오류가 날 수 있습니다.

MongoDB가 유연하다는 것은 설계·검증이 필요 없다는 뜻이 아닙니다. 오늘 예시 generator가 일관된 구조를 만들고, 6일차에는 입력 변환과 테스트를 추가합니다.

## 2-6. 확인 — 5분

1. `books_step4`는 데이터베이스인가 컬렉션인가?
2. `_id`가 프로젝션에 없다고 저장되지 않은 것인가?
3. 같은 컬렉션에 다른 타입이 섞일 때 생길 문제 두 가지는?

### 2교시 체크포인트

- [ ] MongoDB 계층을 정확한 이름으로 그렸습니다.
- [ ] 예시 문서의 중첩 필드 path를 적었습니다.
- [ ] `_id`의 고유 식별 역할을 설명했습니다.
- [ ] 스키마 flexibility와 데이터 consistency를 함께 설명했습니다.

---

# 3교시. 연결, 환경 변수, 안전 경계 — 60분

## 3-1. `.env` 로딩 — 10분

`lib/mongodb.js`:

```js
const envPath = path.join(__dirname, '..', '.env')

if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}
```

`.env`가 있으면 Node.js가 환경 변수로 로딩합니다. 파일이 없으면 코드의 로컬 기본값을 사용합니다.

```js
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const databaseName = process.env.MONGODB_DB || 'database_study_course'
```

URI에 인증 정보가 들어갈 수 있으므로 출력 로그나 Git에 노출하지 않습니다.

## 3-2. 데이터베이스 이름 guard — 10분

```js
if (!databaseName.startsWith('database_study_')) {
  throw new Error('MONGODB_DB는 database_study_로 시작해야 합니다.')
}
```

`.env`에 `MONGODB_DB=production`을 넣고 `npm start`가 연결 전에 중단되는지 관찰한 뒤 원래대로 복원합니다.

guard는 완벽한 보안 장치가 아니라 실수를 줄이는 교육용 경계입니다. URI 자체가 실제 서비스라면 안전한 접두사의 새 데이터베이스를 만드는 것도 조직 정책상 허용되지 않을 수 있으므로 애초에 강의 전용 배포 환경을 사용합니다.

## 3-3. MongoClient — 10분

```js
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 3000,
})
```

- `client`: 배포 환경과 통신하는 Driver 객체
- `serverSelectionTimeoutMS`: 사용할 서버를 찾지 못할 때 3초 안에 오류

연결 문제를 빠르게 피드백하기 위한 강의 설정입니다. 운영 값은 네트워크와 복구 정책에 따라 결정합니다.

## 3-4. `withDatabase()` 생명주기 — 15분

```js
async function withDatabase(work) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
  })

  try {
    await client.connect()
    return await work(client.db(databaseName), databaseName)
  } finally {
    await client.close()
  }
}
```

순서:

```text
client 생성
  → connect await
  → database 객체와 이름을 work 함수에 전달
  → work의 비동기 작업 완료/오류
  → finally에서 close await
```

`return await work(...)`는 work가 끝나기 전에 finally로 넘어가지 않게 하고 오류도 finally를 거쳐 전파되게 합니다.

## 3-5. 비동기/await 추적 — 10분

다음 `await`를 지우면 Promise 완료 전에 다음 단계가 실행되거나, 결과 대신 Promise를 출력하거나, 연결이 작업 전에 닫힐 수 있습니다.

```js
await client.connect()
await books.deleteMany({})
await books.insertMany(sampleBooks)
await cursor.toArray()
await client.close()
```

## 3-6. 오류 전파 — 5분

`index.js`의 `main().catch(...)`는 오류 메시지를 출력하고 `process.exitCode = 1`을 설정합니다. `finally`의 close와 바깥 catch의 사용자 메시지는 서로 다른 책임입니다.

### 3교시 체크포인트

- [ ] `.env`와 기본값의 선택 순서를 설명했습니다.
- [ ] 안전 접두사 오류를 재현하고 복원했습니다.
- [ ] `withDatabase`의 try/finally 흐름을 그렸습니다.
- [ ] 비동기 작업마다 await가 필요한 이유를 설명했습니다.

---

# 4교시. 컬렉션 초기화와 문서 생성 — 60분

## 4-1. 컬렉션 선택 — 10분

```js
await withDatabase(async (database, databaseName) => {
  const books = database.collection('books_step4')
})
```

`database.collection()`은 컬렉션 작업 객체를 얻습니다. SQL처럼 테이블을 먼저 CREATE하는 흐름과 다르며 첫 insert 때 컬렉션이 만들어질 수 있습니다. 오늘 전용 이름 `books_step4`를 사용해 뒤 단계 컬렉션과 분리합니다.

## 4-2. 초기화 안전성 — 10분

```js
await books.deleteMany({})
```

빈 필터 `{}`는 컬렉션의 모든 문서와 일치합니다. 실행 전 세 항목을 확인합니다.

1. 데이터베이스 이름이 `database_study_`로 시작하는가?
2. 컬렉션이 정확히 `books_step4`인가?
3. seed 실습을 위해 초기화한다는 의도가 맞는가?

`dropDatabase()`나 다른 컬렉션 삭제를 사용하지 않습니다. Read의 `find({})`와 Delete의 `deleteMany({})`는 같은 전체 일치 필터를 쓰지만 부작용이 완전히 다릅니다.

## 4-3. sampleBooks 세 건 — 10분

| ISBN | categories | stock | reviews |
| --- | --- | ---: | ---: |
| 978-00-0001 | 데이터베이스, beginner | 3 | 0 |
| 978-00-0002 | 데이터베이스, mongodb | 5 | 1 |
| 978-00-0003 | nodejs, beginner | 1 | 0 |

실행 전 다음 값을 계산합니다.

- 문서 수: 3
- 총 재고: 9
- 데이터베이스 category: 2권
- beginner category: 2권
- review가 있는 도서: 1권

이 예측은 8일차 집계에서도 다시 사용합니다.

## 4-4. insertMany 결과 — 10분

```js
const insertResult = await books.insertMany(sampleBooks)
console.log(`생성한 문서: ${insertResult.insertedCount}개`)
```

예상 `insertedCount`는 3입니다. 생성 성공을 다음 세 증거로 확인합니다.

- insertedCount가 3
- `find({}).toArray()` 길이가 3
- 각 ISBN을 findOne으로 조회 가능

오류가 없었다는 사실만으로 저장 건수와 내용이 맞다고 단정하지 않습니다.

## 4-5. `_id` 생성 관찰 — 5분

예시 object에 `_id`를 직접 쓰지 않았지만 저장 문서에는 고유 `_id`가 생깁니다. 다음 프로젝션으로 관찰합니다.

```js
const ids = await books
  .find({}, { projection: { isbn: 1 } })
  .toArray()

console.log(ids)
```

`_id`는 특별히 제외하지 않으면 기본 포함됩니다. `_id`와 ISBN의 책임을 구분합니다.

## 4-6. 안내 실습 — 네 번째 문서 15분

`lib/sampleBooks.js` 배열에 다음 책을 추가합니다.

```js
{
  isbn: '978-00-0090',
  title: '문서 데이터 실험실',
  author: {
    name: '최문서',
    country: 'KR',
  },
  categories: ['mongodb', 'practice'],
  inventory: {
    stock: 2,
    location: 'C-01',
  },
  publishedYear: 2026,
  reviews: [],
  courseSeed: false,
  createdAt: new Date(),
}
```

실행 전 예측:

- insertedCount: 4
- 목록: 4권
- mongodb category: 2권
- 총 재고: 11

실행 뒤 예상과 비교하고, 기준 수업을 계속하려면 임시 문서를 제거해 3건 상태로 복원합니다.

### 4교시 체크포인트

- [ ] 데이터베이스와 컬렉션 이름을 확인한 뒤 초기화했습니다.
- [ ] 빈 필터 `{}`의 범위를 설명했습니다.
- [ ] insertedCount와 사후 조회를 함께 확인했습니다.
- [ ] 중첩 객체·배열·Date를 가진 새 문서를 만들었습니다.

---

# 5교시. find, 커서, 프로젝션, findOne — 60분

## 5-1. find와 커서 — 15분

```js
const cursor = books.find({})
```

`find()`는 모든 결과 문서가 든 배열을 즉시 반환하지 않습니다. 조회 조건과 옵션을 가진 커서를 반환합니다.

```js
const savedBooks = await books
  .find(
    {},
    {
      projection: {
        _id: 0,
        isbn: 1,
        title: 1,
        categories: 1,
      },
    },
  )
  .sort({ title: 1 })
  .toArray()
```

흐름:

```text
filter 정의
  → projection 정의
  → sort 정의
  → cursor를 toArray로 소비
```

데이터가 매우 많을 때 모두 toArray로 메모리에 올리는 것은 부적절할 수 있습니다. 커서 iteration과 limit/batch를 검토하지만 오늘 seed 3건에서는 배열로 확인합니다.

## 5-2. 빈 필터 — 5분

```js
find({})
```

모든 문서와 일치합니다. `{}`는 조건이 없다는 뜻이지 결과가 빈 객체라는 뜻이 아닙니다.

## 5-3. 프로젝션 — 10분

```js
{
  projection: {
    _id: 0,
    isbn: 1,
    title: 1,
    categories: 1,
  },
}
```

- inclusion `1`: 반환할 필드
- exclusion `0`: 제외할 필드
- 보통 inclusion과 exclusion을 섞지 않지만 `_id: 0`은 함께 사용 가능

프로젝션은 저장 문서를 바꾸지 않고 반환 모양만 줄입니다.

중첩 프로젝션:

```js
{
  projection: {
    _id: 0,
    title: 1,
    'author.name': 1,
    'inventory.stock': 1,
  },
}
```

## 5-4. 정렬 — 10분

```js
.sort({ title: 1 })
```

- `1`: 오름차순
- `-1`: 내림차순

재고 내림차순, 같은 재고에서 제목 오름차순:

```js
.sort({ 'inventory.stock': -1, title: 1, isbn: 1 })
```

동률에서 재현 가능한 결과가 필요하면 마지막에 고유한 필드를 추가합니다.

## 5-5. findOne — 10분

```js
const oneBook = await books.findOne(
  { isbn: '978-00-0001' },
  { projection: { _id: 0 } },
)
```

- 일치하면 문서 한 건
- 없으면 `null`

step-4에는 ISBN unique index가 아직 없으므로 중복 문서가 기술적으로 있을 수 있습니다. `findOne()`이라는 메서드 이름이 필터의 고유성을 보장하지 않습니다. 5일차에 unique index를 추가합니다.

## 5-6. 없음 처리 — 10분

```js
const missing = await books.findOne({ isbn: 'not-found' })

if (!missing) {
  console.log('도서를 찾지 못했습니다.')
}
```

조회 결과 없음은 연결 실패나 예외와 다른 정상 상태입니다. 빈 결과를 사용자에게 이해 가능한 메시지로 바꿉니다.

### 5교시 체크포인트

- [ ] 커서와 배열을 구분했습니다.
- [ ] 프로젝션이 저장 문서를 바꾸지 않음을 설명했습니다.
- [ ] 중첩 필드를 프로젝션했습니다.
- [ ] findOne의 null과 unique 조건을 구분했습니다.

---

# 6교시. 중첩·배열 조건과 종합 비교 — 60분

## 6-1. 배열 값 조회 — 10분

```js
const databaseBooks = await books
  .find(
    { categories: 'database' },
    { projection: { _id: 0, isbn: 1, title: 1, categories: 1 } },
  )
  .toArray()
```

`categories`가 배열이어도 scalar 값 `database` 조건으로 해당 원소 포함 여부를 찾습니다. 기준 결과는 2권입니다.

여러 값 중 하나:

```js
{ categories: { $in: ['mongodb', 'nodejs'] } }
```

두 값을 모두 포함:

```js
{ categories: { $all: ['database', 'beginner'] } }
```

기준에서 두 값을 모두 가진 책은 첫 번째 한 권입니다.

## 6-2. 중첩 필드 조건 — 10분

```js
const rows = await books
  .find(
    { 'inventory.stock': { $gte: 2 } },
    { projection: { _id: 0, title: 1, inventory: 1 } },
  )
  .sort({ 'inventory.stock': -1 })
  .toArray()
```

기준 결과:

1. MongoDB 첫걸음 — 5
2. 데이터를 배우는 시간 — 3

`inventory.stock`은 점 표기법 필드 path입니다.

## 6-3. 중첩 객체 전체 일치 주의 — 10분

```js
{ inventory: { stock: 3 } }
```

저장 inventory에는 `location`도 있으므로 embedded 문서 전체 일치 조건은 기대와 다릅니다. 특정 하위 값이 목적이면 점 표기법을 사용합니다.

```js
{ 'inventory.stock': 3 }
```

## 6-4. 복합 AND와 OR — 10분

같은 필터 객체의 서로 다른 필드는 기본 AND입니다.

```js
{
  categories: 'database',
  'inventory.stock': { $gte: 4 },
}
```

데이터베이스 category이면서 stock 4 이상인 책은 MongoDB 첫걸음 한 권입니다.

명시적 OR:

```js
{
  $or: [
    { 'author.name': '김데이터' },
    { categories: 'nodejs' },
  ],
}
```

## 6-5. SQL과 MongoDB 비교 실습 — 10분

| 요구 | SQL | MongoDB |
| --- | --- | --- |
| 재고 2 이상 | `WHERE stock >= ?` | `{ 'inventory.stock': { $gte: 2 } }` |
| 제목/재고만 | `SELECT title, stock` | 프로젝션 |
| 재고 역순 | `ORDER BY stock DESC` | `.sort({ 'inventory.stock': -1 })` |
| 저자 이름 함께 | authors JOIN | embedded `author.name` 직접 읽기 |
| 여러 행/문서 | `.all()` | 커서 `.toArray()` |
| 한 건 없음 | `get()` → undefined | `findOne()` → null |

표현은 다르지만 필터, 프로젝션, 정렬, 결과 검증이라는 질문은 같습니다.

## 6-6. 출구 티켓 — 10분

1. `books.find({})`와 `books.deleteMany({})`에서 `{}`의 범위는 같지만 위험이 다른 이유는?
2. `findOne({ isbn })`만으로 ISBN 중복이 막히지 않는 이유는?
3. reviews를 문서 배열에 계속 넣을 때 반드시 물어야 할 질문은?

---

# 7. 기준 코드 전체 흐름

```text
.env 읽기
  → database 이름 guard
  → MongoClient 생성
  → connect
  → database/collection 선택
  → books_step4 전체 삭제
  → sampleBooks 3건 삽입
  → projection 목록 find + sort + toArray
  → ISBN findOne
  → callback 완료
  → finally close
```

## 7-1. RDBMS 단계와 초기화 차이

- SQLite: 현재 단계 `.sqlite` 파일을 삭제하고 스키마부터 다시 생성
- MongoDB: 강의용 데이터베이스 안의 현재 단계 컬렉션 문서를 `deleteMany({})`로 삭제

둘 다 반복 가능한 기준 상태가 목적이며, 삭제 범위를 가장 좁은 단계 전용 데이터로 제한합니다.

## 7-2. 출력 방식

목록은 `console.table`로 간단히 보고, 중첩 문서 한 건은 다음처럼 들여쓰기합니다.

```js
console.log(JSON.stringify(oneBook, null, 2))
```

Date와 ObjectId가 JSON 직렬화에서 문자열 같은 표현으로 보일 수 있어도 DB 저장 타입과 출력 형식을 구분합니다.

## 7-3. 매 실행 초기화의 의미

step-4는 매 실행마다 3건으로 돌아갑니다. 오늘 목적은 연결·문서 구조·기본 조회를 같은 상태에서 반복하는 것입니다. 6일차부터는 명령을 실행할 때마다 상태가 유지되는 `books_course`를 사용합니다.

## 7-4. 오류와 정리 경로

콜백 안의 insert나 find가 실패하면 오류는 `main().catch(...)`까지 전달되지만 그 전에 `withDatabase`의 finally가 client를 닫습니다. 사용자에게 오류를 알리는 책임과 자원을 정리하는 책임을 분리합니다.

---

# 8. 추가 조회 예제

## 예제 A. 출판 연도 범위

```js
const rows = await books
  .find(
    { publishedYear: { $gte: 2025, $lte: 2026 } },
    { projection: { _id: 0, title: 1, publishedYear: 1 } },
  )
  .sort({ publishedYear: -1, title: 1 })
  .toArray()
```

## 예제 B. 리뷰가 있는 도서

```js
{ 'reviews.0': { $exists: true } }
```

배열의 첫 원소 존재 여부로 비어 있지 않은 배열을 찾습니다. 기준에서는 MongoDB 첫걸음 한 권입니다.

## 예제 C. 특정 리뷰 점수

```js
{ reviews: { $elemMatch: { score: { $gte: 4 } } } }
```

배열 문서 원소 하나가 조건을 만족하는지 찾습니다. 여러 조건이 같은 배열 원소에 적용되어야 할 때 `$elemMatch`가 중요합니다.

## 예제 D. 필드 존재 여부

```js
{ subtitle: { $exists: false } }
```

subtitle 필드가 없는 문서를 찾습니다. `null` 값과 필드 missing을 구분해야 하는 요구에서는 `$exists`를 함께 사용합니다.

## 예제 E. limit

```js
const newest = await books
  .find({}, { projection: { _id: 0, title: 1, publishedYear: 1 } })
  .sort({ publishedYear: -1, isbn: 1 })
  .limit(2)
  .toArray()
```

limit 전에 재현 가능한 정렬을 정의합니다.

## 예제 F. 여러 stock 범위

```js
{
  'inventory.stock': {
    $gte: 2,
    $lte: 4,
  },
}
```

같은 필드에 최소와 최대 조건을 함께 둡니다. 기준에서는 stock 3인 첫 책이 일치합니다.

## 예제 G. 예상 행 수 기록

```js
const filter = { categories: 'beginner' }
const count = await books.countDocuments(filter)
const rows = await books.find(filter).toArray()
```

`count`와 `rows.length`를 비교합니다. 실제 큰 데이터에서는 건수 비용과 snapshot 일관성을 별도로 고려하지만, 수업에서는 필터 검증 도구로 사용합니다.

---

# 9. 연습 문제

## 기초

1. 예시 book을 한 권 더 추가하고 insertedCount를 확인합니다.
2. stock 2 이상인 책을 재고 역순으로 조회합니다.
3. 데이터베이스 category 도서의 title과 author.name만 출력합니다.
4. 없는 ISBN을 findOne하고 null 메시지를 출력합니다.
5. publishedYear 2025 이상인 책을 최신순으로 조회합니다.

## 배열과 중첩

6. beginner category를 가진 책을 찾습니다.
7. 데이터베이스와 beginner를 모두 가진 책을 `$all`로 찾습니다.
8. reviews가 비어 있지 않은 책을 찾습니다.
9. score 5 리뷰가 있는 책을 `$elemMatch`로 찾습니다.
10. inventory.location이 A-로 시작하는 도서를 찾는 필터를 작성합니다.

## 연결과 안전

11. 데이터베이스 이름을 잘못 설정해 guard 오류를 재현하고 복원합니다.
12. MongoDB 서버를 중지했을 때 timeout 메시지를 연결 오류로 분류합니다.
13. `withDatabase` 콜백 안에서 의도적으로 오류를 던져 finally close 흐름을 설명합니다.
14. `deleteMany({})` 대신 `courseSeed: true`만 지울 때 필터를 작성합니다.
15. 실제 서비스 URI를 강의에 쓰면 안 되는 이유를 기술·운영 관점으로 적습니다.

## 모델 비교

16. author 포함의 읽기 장점과 이름 변경 비용을 적습니다.
17. reviews 배열이 10만 개가 되면 생길 문제와 대안을 적습니다.
18. 주문 배송 주소를 포함해야 하는 이유를 snapshot 관점에서 설명합니다.
19. SQL과 MongoDB에서 재고 2 이상, 제목/재고만, 재고 역순 요구를 나란히 작성합니다.
20. 유연한 스키마에서 타입 일관성을 유지할 세 방법을 제안합니다.

<details>
<summary>힌트</summary>

- 중첩 필드는 `inventory.stock`, `author.name` 점 표기법을 사용합니다.
- 배열 원소 하나 포함은 `{ categories: 'beginner' }`입니다.
- 두 category 모두는 `$all`입니다.
- 리뷰 존재는 `reviews.0`에 `$exists`를 사용할 수 있습니다.
- location 시작 문자열은 정규식 조건을 검토합니다.
- 연결 오류, guard 오류, 조회 0건은 서로 다른 상태입니다.

</details>

---

# 10. 자주 만나는 문제와 진단 순서

## `ECONNREFUSED`

로컬 URI라면 MongoDB 서버가 실행 중인지 확인합니다. 코드의 필터나 프로젝션을 고치기 전에 연결 계층 문제를 해결합니다.

## 서버 selection timeout

다음 순서로 확인합니다.

1. URI host와 port
2. 로컬 서버 실행
3. Atlas network access
4. DNS와 인터넷
5. 인증 설정

비밀이 포함된 URI 전체를 화면 공유나 로그에 출력하지 않습니다.

## authentication failed

사용자 이름·비밀번호·auth source·URI encoding을 확인합니다. 비밀번호 특수문자는 URI encoding이 필요할 수 있습니다. 실제 값을 문서나 Git에 붙이지 않습니다.

## 데이터베이스 이름 안전 오류

`.env`의 `MONGODB_DB`가 `database_study_`로 시작하는지 확인합니다. 대소문자와 앞뒤 공백도 확인합니다.

## 중복 ISBN 오류가 나지 않습니다

step-4에는 아직 ISBN unique index가 없습니다. 같은 ISBN 문서가 저장될 수 있습니다. 5일차에서 인덱스로 막습니다.

## find 결과가 빈 배열입니다

1. `find({}).limit(1)`로 원본 문서를 봅니다.
2. 필드 path와 대소문자를 확인합니다.
3. 숫자와 문자열 타입을 구분합니다.
4. 배열 조건인지 embedded 문서 조건인지 확인합니다.
5. step-4가 실행 때 컬렉션을 초기화했는지 봅니다.

## 프로젝션에 필드가 안 보입니다

실제 원본 문서의 필드 path를 확인합니다. `author.name`과 `authorName`은 다릅니다. inclusion 프로젝션에 필요한 경로가 정확한지 봅니다.

## `await` 관련 syntax 오류

`await`가 비동기 function 안에 있는지 확인합니다. 이 코드에서는 `main()`과 `withDatabase` 콜백이 비동기입니다.

## 프로그램이 끝나지 않습니다

client가 닫혔는지 확인합니다. 기준 `withDatabase`의 finally와 완료되지 않은 Promise를 점검합니다.

## Date가 문자열처럼 출력됩니다

`JSON.stringify`는 Date를 ISO 문자열로 직렬화합니다. MongoDB에 저장된 BSON 타입이 실제 Date인지 JavaScript 값이나 DB 도구에서 확인합니다.

## 추가한 문서가 다음 실행에 사라집니다

step-4는 시작할 때 `books_step4`를 전체 초기화하고 sampleBooks를 다시 넣습니다. CRUD 상태 유지 단계가 아니라 반복 가능한 구조 학습 단계입니다.

---

# 11. 형성평가 — 20점

## 문항

1. JSON 문자열과 BSON 문서의 차이를 Date 예로 설명하세요. (2점)
2. 서버→데이터베이스→컬렉션→문서 계층을 오늘 이름으로 쓰세요. (2점)
3. `_id`의 역할과 프로젝션 `_id: 0`의 의미를 설명하세요. (2점)
4. 유연한 스키마에서 타입 일관성이 필요한 이유를 쓰세요. (2점)
5. author를 문서에 포함했을 때 장점과 비용을 하나씩 쓰세요. (2점)
6. 데이터베이스 이름 guard와 단계 전용 컬렉션이 막으려는 사고는? (2점)
7. `withDatabase`의 finally가 필요한 이유는? (2점)
8. find 커서와 toArray 결과를 구분하세요. (2점)
9. `categories: 'database'`가 배열에 적용되는 의미는? (2점)
10. `findOne({ isbn })`가 ISBN 고유성을 자동 보장하지 않는 이유는? (2점)

<details>
<summary>평가 기준</summary>

1. JSON 텍스트는 Date를 문자열로 표현하고 BSON은 Date 타입을 저장할 수 있음을 포함합니다.
2. `database_study_course → books_step4 → book document`를 서버 아래에 둡니다.
3. 고유 식별이며 프로젝션 제외는 반환 화면만 바꿉니다.
4. 비교·정렬·집계와 코드 필드 접근이 일관되게 동작해야 합니다.
5. 한 번 읽기와 중복 갱신 비용을 함께 봅니다.
6. 실제/다른 단계 데이터를 전체 삭제하는 실수를 줄입니다.
7. 성공과 오류 모두 client 연결을 정리합니다.
8. find는 커서, toArray는 소비된 문서 배열입니다.
9. 배열 원소 중 같은 값이 있는 문서를 찾습니다.
10. 메서드는 한 건만 반환할 뿐 DB 제약이 아니며 unique index가 필요합니다.

</details>

## 점수 해석

- 17~20점: 문서 모델링·인덱스 단계 진행
- 13~16점: hierarchy/커서/점 표기법 중 약한 부분 반복
- 9~12점: 예시 문서를 손으로 해부하고 기본 조회 재실행
- 0~8점: JSON·객체·BSON 구분과 연결 흐름부터 재학습

---

# 12. 완료 기준

- [ ] `step-4`와 강의 전용 MongoDB 환경을 확인했습니다.
- [ ] JSON, JavaScript 객체, BSON 문서를 구분했습니다.
- [ ] MongoDB 계층을 오늘 데이터베이스/컬렉션 이름으로 설명했습니다.
- [ ] 예시 문서의 중첩 객체·배열·Date 필드를 분석했습니다.
- [ ] 유연한 스키마의 이점과 일관성 책임을 설명했습니다.
- [ ] 데이터베이스 이름 guard 오류를 이해했습니다.
- [ ] `withDatabase`의 connect/work/finally close 흐름을 추적했습니다.
- [ ] `books_step4`만 초기화하고 3건을 생성했습니다.
- [ ] insertedCount와 사후 조회를 확인했습니다.
- [ ] find 커서에 프로젝션과 정렬을 적용했습니다.
- [ ] findOne 성공과 null 결과를 처리했습니다.
- [ ] 배열 값과 중첩 필드 조건을 각각 실행했습니다.
- [ ] SQL 조건 조회와 MongoDB 필터를 비교했습니다.
- [ ] 형성평가에서 13점 이상을 받았습니다.

## 회복 경로

1. `.env`와 안전 데이터베이스 이름 준비
2. 기준 `npm start`로 3건 생성
3. 전체 목록 프로젝션 조회
4. ISBN findOne과 없는 ISBN null 확인
5. categories와 inventory.stock 조건 조회

## 확장 경로

1. 리뷰 `$elemMatch` 조건
2. 존재하지 않는 필드 `$exists` 조건
3. 커서 limit와 안정 정렬
4. 예시 문서 구조 validation 초안
5. SQL/MongoDB 같은 요구 쿼리 비교표 확장

## 다음 단계

오늘은 author·inventory·categories를 자연스럽게 한 문서에 넣었습니다. 5일차에는 항상 함께 읽는다는 이유만으로 포함을 결정하지 않고 변경 빈도, 공유, 크기, 일관성, 배열 성장까지 평가합니다. ISBN 고유성과 반복 검색을 위한 인덱스도 추가합니다.

> 저자 이름이 바뀔 때 책 1,000권의 `author.name`을 모두 바꿔야 한다면, 포함 모델을 유지할 근거와 참조 모델로 바꿀 근거는 각각 무엇일까?
