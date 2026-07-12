# Step 6. MongoDB CRUD 기초: 데이터 생성과 조회

## 이번 단계 목표

- CLI 명령을 반복 실행하며 Create와 Read를 구분합니다.
- `insertOne()`, `find()`, `findOne()`의 반환값을 확인합니다.
- 목록 조건과 한 건 식별 조건을 작성합니다.
- CLI 문자열을 검증된 중첩 MongoDB 문서로 변환합니다.

## 실습 방식

이번 단계부터 `books_course` collection을 계속 사용합니다. 먼저 `seed`로 기준 데이터를 만들고, 그다음 생성과 조회 명령을 여러 번 실행합니다.

```bash
git switch step-6
cp .env.example .env
npm ci
npm start -- seed
```

## 사용할 명령

```bash
npm start -- list
npm start -- list database
npm start -- get 978-00-0001
npm start -- add 978-00-0099 "새 도서" "학생 저자" 3 "database,mongodb"
```

명령을 한 번 실행할 때마다 MongoDB에 연결하고 작업 후 연결을 닫습니다.

## Create

### 입력값을 문서로 변환

`lib/bookInput.js`는 터미널에서 받은 문자열을 검사하고 중첩 문서로 바꿉니다.

```js
{
  isbn,
  title,
  author: { name, country: "KR" },
  categories,
  inventory: { stock, location: "PRACTICE" },
  reviews: [],
}
```

재고는 0 이상의 정수인지 확인하고 categories는 쉼표로 나눠 소문자와 중복을 정리합니다.

### insertOne

```js
const result = await books.insertOne(book)
console.log(result.insertedId)
```

생성 후 반환된 ID를 확인하고 같은 ISBN으로 다시 조회합니다.

## Read

### find

```js
const filter = category ? { categories: category } : {}
const rows = await books.find(filter).sort({ title: 1 }).toArray()
```

조건이 없으면 전체 목록, category가 있으면 해당 배열 값을 포함한 문서만 찾습니다.

### findOne

```js
const book = await books.findOne({ isbn })
```

ISBN unique index가 있으므로 한 권을 식별하는 조건으로 사용합니다.

## 추천 반복 순서

1. `seed`로 세 권을 만듭니다.
2. `list`로 세 권을 확인합니다.
3. `list database`로 두 권만 확인합니다.
4. `add`로 한 권을 생성합니다.
5. `get`으로 방금 만든 한 권을 확인합니다.
6. 다시 `list`를 실행해 총 네 권인지 확인합니다.
7. 같은 ISBN으로 다시 `add`하고 unique 오류를 확인합니다.

## 입력 함수 테스트

```bash
npm test
```

MongoDB 연결 없이 stock과 category 변환, 중첩 문서 생성 규칙을 확인합니다.

## 직접 해볼 연습

1. 저자 국가를 CLI 인자로 받도록 확장합니다.
2. 출판 연도를 입력하고 숫자 검증을 추가합니다.
3. 저자 이름으로 목록을 찾는 명령을 추가합니다.
4. `list` projection에 publisherCode를 추가합니다.
5. 처리 결과가 0건일 때 메시지를 더 친절하게 바꿉니다.

## 자주 만나는 문제

### 중복 key 오류가 납니다

ISBN에 unique index가 있습니다. 다른 ISBN을 사용하거나 `seed`로 초기화합니다.

### 터미널에서 제목이 여러 인자로 나뉩니다

공백이 있는 제목과 저자 이름을 큰따옴표로 감쌉니다.

## 완료 기준

- `insertOne`, `find`, `findOne`을 목적에 맞게 선택할 수 있습니다.
- 생성 결과 ID와 조회 결과 개수를 확인할 수 있습니다.
- seed → create → read 순서를 반복해 상태 변화를 설명할 수 있습니다.
