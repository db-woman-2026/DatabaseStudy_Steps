# Step 4. MongoDB와 JSON 문서 데이터 기초

## 이번 단계 목표

- MongoDB 서버, database, collection, document의 관계를 설명합니다.
- Node.js Driver로 강의용 데이터베이스에 연결합니다.
- 중첩 객체와 배열이 포함된 문서를 저장합니다.
- `find()`와 `findOne()`으로 문서를 다시 조회합니다.

## RDBMS 단계와의 연결

앞 단계에서는 저자, 도서, 대출을 여러 테이블로 나눴습니다. 이번 단계에서는 도서 한 권을 읽을 때 항상 함께 필요한 저자 요약, 카테고리, 재고 정보를 하나의 문서 안에 넣어봅니다.

이것은 기존 SQLite 프로젝트를 이어가는 것이 아닙니다. 같은 도서 관리 주제를 사용해 데이터 구조의 차이를 비교하는 별도 MongoDB 실습입니다.

## 실행 준비

MongoDB 서버 또는 Atlas 연결 주소가 필요합니다.

```bash
git switch step-4
cp .env.example .env
npm ci
npm start
```

`.env` 기본값:

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=database_study_course
```

실수로 실제 데이터베이스를 초기화하지 않도록 `MONGODB_DB`는 반드시 `database_study_`로 시작해야 합니다.

## 새로 추가된 파일

| 파일 | 역할 |
| --- | --- |
| `lib/mongodb.js` | 환경 변수, 안전한 DB 이름 검사, 연결과 종료 |
| `lib/sampleBooks.js` | 중첩 JSON 구조의 샘플 도서 문서 |
| `.env.example` | 강의용 연결 설정 예시 |

## JSON 문서 구조

```js
{
  isbn: "978-00-0001",
  title: "데이터를 배우는 시간",
  author: {
    name: "김데이터",
    country: "KR",
  },
  categories: ["database", "beginner"],
  inventory: {
    stock: 3,
    location: "A-01",
  },
}
```

`author`와 `inventory`는 중첩 객체이고 `categories`는 배열입니다.

## 코드 흐름

### 1. 연결

```js
await client.connect()
const database = client.db(databaseName)
```

연결은 비동기 작업이므로 `await`를 사용하고 작업이 끝나면 `close()`합니다.

### 2. 현재 단계 collection 초기화

```js
const books = database.collection("books_step4")
await books.deleteMany({})
```

강의용 database 안에서도 현재 단계 전용 collection만 사용합니다.

### 3. 여러 문서 생성

```js
const result = await books.insertMany(sampleBooks)
console.log(result.insertedCount)
```

반환된 처리 건수로 생성 결과를 확인합니다.

### 4. 여러 건과 한 건 조회

```js
await books.find({}).toArray()
await books.findOne({ isbn: "978-00-0001" })
```

`find()`는 cursor를 반환하므로 `toArray()`로 결과를 읽습니다. `findOne()`은 문서 한 개 또는 `null`을 반환합니다.

## 실행 결과에서 확인할 것

- `books_step4`에 문서 세 개가 생성됩니다.
- 목록 조회에는 선택한 필드만 보입니다.
- 한 건 조회에서는 중첩 객체와 배열이 JSON 모양으로 보입니다.

## 직접 해볼 연습

1. 샘플 도서를 한 권 더 추가합니다.
2. `inventory.stock`이 2 이상인 문서만 조회합니다.
3. `categories`에 `database`가 포함된 문서를 찾습니다.
4. projection에서 `author.name`만 추가로 출력합니다.

## 자주 만나는 문제

### `ECONNREFUSED`가 나옵니다

로컬 MongoDB 서버가 실행 중인지, Atlas를 사용한다면 연결 주소와 네트워크 허용 설정이 맞는지 확인합니다.

### DB 이름 안전 오류가 납니다

`.env`의 `MONGODB_DB`를 `database_study_`로 시작하는 강의 전용 이름으로 바꿉니다.

## 완료 기준

- table/row와 collection/document를 비교할 수 있습니다.
- 중첩 객체와 배열이 MongoDB 문서에 어떻게 저장되는지 설명할 수 있습니다.
- 연결, 생성, 조회, 종료 순서를 코드에서 찾을 수 있습니다.
