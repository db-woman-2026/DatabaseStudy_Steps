# Step 2. 관계형 데이터 모델링과 SQL 기초

Step 1의 회원 데이터를 확장해 저자·도서·회원·대출을 각 테이블로 나누고 기본 키와 외래 키로 연결합니다. 테이블을 나눈 이유와 JOIN 결과의 한 행이 무엇을 뜻하는지 설명할 수 있어야 합니다.

## 0. 먼저 생각할 질문

1. 회원·도서·저자·대출을 한 테이블에 모두 넣으면 어떤 중복과 이상이 생기는가?
2. 기본 키와 외래 키는 각각 무엇을 식별하고 무엇을 연결하는가?
3. 1:N과 N:M 관계를 실제 테이블에 어떻게 표현하는가?
4. `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`는 어떤 잘못된 상태를 막는가?
5. 나눠 저장한 데이터를 JOIN으로 읽을 때 결과 행 수를 어떻게 예측하는가?

## 1. 완료 목표

### 개념

- 엔터티, 속성, 관계, cardinality를 도서관 요구사항에 연결합니다.
- 기본 키, candidate 키, natural 키, surrogate 키, 외래 키를 구분합니다.
- 1:1, 1:N, N:M 관계와 연결 테이블의 필요성을 설명합니다.
- 중복으로 생기는 삽입·수정·삭제 이상과 정규화의 목적을 설명합니다.
- INNER JOIN과 LEFT JOIN의 차이, `ON`과 `WHERE`의 역할을 설명합니다.

### 실습

- 요구사항에서 테이블과 열 후보를 뽑습니다.
- `authors`, `books`, `members`, `loans` 스키마를 읽고 관계도를 그립니다.
- 외래 키 검사를 켜고 잘못된 참조를 재현합니다.
- 부모 행을 먼저 생성하고 `lastInsertRowid`로 자식 행을 연결합니다.
- 두 개와 세 개 테이블 JOIN을 작성하고 결과 행 수를 검증합니다.
- 연결 상대가 없는 행을 LEFT JOIN으로 보존합니다.

### 작업 원칙

- 테이블을 나누기 전에 중복과 변경 요구를 확인합니다.
- ID 숫자를 암기하지 않고 생성 결과를 사용합니다.
- 외래 키 오류를 우회하지 않고 저장 순서와 참조를 교정합니다.
- JOIN 실행 전에 기준 테이블과 예상 행 수를 적습니다.

## 2. 완료 결과

- 네 엔터티와 관계를 표시한 손그림 또는 텍스트 ERD
- 각 테이블의 PK·FK·제약조건 설명표
- NOT NULL, UNIQUE, CHECK, FOREIGN KEY 실패 기록 각 1개 이상
- INNER JOIN 두 개와 LEFT JOIN 한 개의 예상/실제 결과
- 도서가 없는 저자와 대출이 없는 도서를 포함한 변형 데이터
- 학교·쇼핑몰·예약 중 하나의 관계 모델
- 이해 점검 답안과 3문장 모델링 정리

## 3. 시작 전 확인

> Windows 11에서는 [환경 준비](../windows-11.md)를 먼저 확인합니다. `git`, `node`, `npm` 명령은 PowerShell에서도 같습니다. `npm.ps1` 오류가 나면 `npm.cmd`를 사용합니다.

```powershell
git branch --show-current
git status
```

현재 단계 파일은 `data/library-step-2.sqlite`입니다. `step-1` 파일과 다른 전용 파일이므로 두 단계 결과를 혼동하지 않습니다. 아래에서 `index.js` 전체를 입력한 뒤 실행하면 현재 단계 파일만 다시 만듭니다.

## 4. 소스 파일 전체 입력

개인 저장소의 기존 파일을 아래 전체 내용으로 바꿉니다. 이 저장소의 `step-N` 기준 브랜치로 이동하지 않습니다.

### `index.js`

`index.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const dataDir = path.join(__dirname, "data")
const databasePath = path.join(dataDir, "library-step-2.sqlite")

fs.mkdirSync(dataDir, { recursive: true })

if (fs.existsSync(databasePath)) {
  fs.rmSync(databasePath)
}

const database = new DatabaseSync(databasePath)
database.exec("PRAGMA foreign_keys = ON")

database.exec(`
  CREATE TABLE authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    FOREIGN KEY (author_id) REFERENCES authors(id)
  );

  CREATE TABLE members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    loaned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    returned_at TEXT,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`)

const insertAuthor = database.prepare("INSERT INTO authors (name) VALUES (?)")
const insertBook = database.prepare(`
  INSERT INTO books (isbn, title, author_id, stock)
  VALUES (?, ?, ?, ?)
`)
const insertMember = database.prepare(`
  INSERT INTO members (name, email)
  VALUES (?, ?)
`)
const insertLoan = database.prepare(`
  INSERT INTO loans (member_id, book_id)
  VALUES (?, ?)
`)

const dataAuthorId = insertAuthor.run("김데이터").lastInsertRowid
const nodeAuthorId = insertAuthor.run("이노드").lastInsertRowid

const databaseBookId = insertBook.run(
  "978-00-0001",
  "데이터를 배우는 시간",
  dataAuthorId,
  3,
).lastInsertRowid
insertBook.run("978-00-0002", "SQL 첫걸음", dataAuthorId, 2)
insertBook.run("978-00-0003", "Node.js 실습 노트", nodeAuthorId, 1)

const memberId = insertMember.run(
  "김민지",
  "minji@example.com",
).lastInsertRowid
insertLoan.run(memberId, databaseBookId)

console.log("도서와 저자 JOIN")
console.table(
  database
    .prepare(`
      SELECT books.id, books.title, authors.name AS author, books.stock
      FROM books
      JOIN authors ON authors.id = books.author_id
      ORDER BY books.id
    `)
    .all(),
)

console.log("현재 대출과 회원 JOIN")
console.table(
  database
    .prepare(`
      SELECT
        loans.id,
        members.name AS member,
        books.title AS book,
        loans.loaned_at
      FROM loans
      JOIN members ON members.id = loans.member_id
      JOIN books ON books.id = loans.book_id
      WHERE loans.returned_at IS NULL
    `)
    .all(),
)

console.log("foreign key 설정")
console.table(database.prepare("PRAGMA foreign_key_list(books)").all())

database.close()
console.log(`SQLite 파일: ${databasePath}`)
~~~

### 입력 후 검사

```powershell
npm.cmd run check
npm.cmd start
```

문법 검사와 SQLite 실행이 모두 끝나야 다음 활동으로 이동합니다.

# 1. 한 테이블의 중복 문제
## 1-1. 회원 테이블에서 관계 확장
다음 세 질문에 답합니다.

1. `members.id`를 두 행이 공유할 수 없는 이유는?
2. email 중복을 애플리케이션과 DB에서 모두 생각해야 하는 이유는?
3. 스키마와 실제 저장 행은 어떻게 다른가?

이 개념을 여러 테이블 관계로 확장합니다.

## 1-2. 요구사항 읽기
> 도서관은 회원을 관리한다. 도서는 저자 한 명의 책이며 ISBN, 제목, 재고를 가진다. 회원은 도서를 빌릴 수 있다. 한 회원은 여러 도서를 빌릴 수 있고, 같은 도서도 시간에 따라 여러 회원에게 대출된다. 대출에는 대출 시각과 선택적인 반납 시각이 있다.

문장에서 명사와 동사를 표시합니다.

- 명사 후보: 도서관, 회원, 도서, 저자, ISBN, 재고, 시각
- 동사/사건 후보: 저자가 도서를 쓴다, 회원이 도서를 빌린다, 반납한다

모든 명사가 테이블이 되는 것은 아닙니다. `ISBN`과 `재고`는 도서의 속성이고, `대출`은 시각이라는 자체 속성을 가진 사건이므로 테이블 후보입니다.

## 1-3. 나쁜 큰 테이블 관찰
```text
library_records
+---------+--------------+-------------------+-------------+----------------------+----------+----------+------------+
| loan_id | member_name  | member_email      | isbn        | book_title           | author   | stock    | returned_at|
+---------+--------------+-------------------+-------------+----------------------+----------+----------+------------+
| 1       | 김민지       | minji@example.com | 978-...0001 | 데이터를 배우는 시간 | 김데이터 | 3        | NULL       |
| 2       | 김민지       | minji@example.com | 978-...0002 | SQL 첫걸음           | 김데이터 | 2        | NULL       |
| 3       | 이준호       | junho@example.com | 978-...0001 | 데이터를 배우는 시간 | 김데이터 | 3        | 2026-07-01 |
+---------+--------------+-------------------+-------------+----------------------+----------+----------+------------+
```

색을 다르게 표시한다고 생각하며 반복 값을 찾습니다.

- 김민지의 이름과 email이 대출마다 반복됩니다.
- 같은 도서 제목, 저자, 재고가 대출마다 반복됩니다.
- 김데이터의 이름이 여러 도서와 대출에서 반복됩니다.

## 1-4. 세 가지 이상 현상
### 수정 이상

김민지 email이 바뀌면 모든 대출 행을 찾아 바꿔야 합니다. 한 행이 빠지면 같은 회원이 서로 다른 email을 가진 것처럼 보입니다.

### 삽입 이상

아직 대출되지 않은 새 도서를 등록하려면 회원·대출 관련 열을 NULL로 두거나 가짜 대출 행을 만들어야 합니다.

### 삭제 이상

어떤 도서의 마지막 대출 기록을 삭제했더니 도서 제목과 저자 정보도 함께 사라질 수 있습니다.

### 토론

“중복은 저장 공간만 조금 더 쓰는 문제”라는 설명이 왜 부족한지 적습니다. 서로 다른 복사본이 다른 값으로 바뀌면 일관성이 깨집니다.

## 1-5. 사실의 소유자 찾기
| 사실 | 소유 엔터티 | 이유 |
| --- | --- | --- |
| 회원 email | member | 대출과 무관하게 회원에게 속함 |
| ISBN·제목·재고 | book | 특정 대출이 없어도 도서에 속함 |
| 저자 이름 | author | 여러 도서가 공유할 수 있음 |
| 대출 시각·반납 시각 | loan | 회원-도서 연결 사건에 속함 |

### 1단원 확인
- [ ] 큰 테이블에서 반복되는 값을 찾았습니다.
- [ ] 삽입·수정·삭제 이상을 각각 설명했습니다.
- [ ] 네 엔터티를 요구사항에서 찾았습니다.
- [ ] 속성이 어느 엔터티에 속하는지 근거를 말했습니다.

---

# 2. 키, 관계, 정규화
## 2-1. 도서 대출 관계도
```text
authors 1 ─────────< N books

members 1 ─────────< N loans N >───────── 1 books
```

`authors 1 : N books`는 저자 한 명이 여러 도서를 가질 수 있고, 현재 모델에서 도서 한 권은 저자 한 명을 가진다는 뜻입니다.

`members`와 `books`는 시간 전체에서 N:M입니다. 회원은 여러 책을 빌리고, 책은 여러 시점에 여러 회원에게 빌려집니다. `loans`가 이 관계를 두 개의 1:N으로 나눕니다.

## 2-2. 엔터티별 식별자
### authors

- PK: 자동 증가 `id`
- 업무상 고유 규칙: 현재 단계 데이터에서는 `name UNIQUE`
- 주의: 실제 세계에는 동명이인 저자가 있으므로 이름 UNIQUE는 예제에만 적용한 단순화입니다.

### books

- PK: 자동 증가 `id`
- 업무상 고유 규칙: `isbn UNIQUE`
- FK: `author_id → authors.id`

### members

- PK: 자동 증가 `id`
- 업무상 고유 규칙: `email UNIQUE`

### loans

- PK: 자동 증가 `id`
- FK: `member_id → members.id`
- FK: `book_id → books.id`

대출 테이블의 `id`는 같은 회원이 같은 책을 여러 번 빌린 기록을 각각 구분합니다. `(member_id, book_id)`를 UNIQUE로 두면 재대출까지 막을 수 있으므로 현재 요구와 맞지 않습니다.

## 2-3. natural 키와 surrogate 키
| 테이블 | 자연키 후보 | 대체키 | 현재 단계 선택 |
| --- | --- | --- | --- |
| authors | 이름(현실에서는 불충분) | id | id PK + name UNIQUE |
| books | ISBN | id | id PK + ISBN UNIQUE |
| members | email | id | id PK + email UNIQUE |
| loans | 조합+시각 가능 | id | id PK |

내부 관계는 짧고 안정적인 ID로 연결하고, 업무상 고유 값은 별도 UNIQUE로 보장합니다.

## 2-4. 정규화 직관
수학적 정규형 정의보다 다음 질문을 사용합니다.

1. 이 열은 무엇에 대한 사실인가?
2. 같은 사실을 여러 행에 반복 저장하고 있는가?
3. 한 사실이 바뀔 때 한 곳만 바꾸면 되는가?
4. 다른 엔터티가 없어도 독립적으로 등록할 수 있는가?
5. 마지막 관련 행을 삭제해도 원본 사실이 남는가?

예:

- `books.author_name`을 직접 저장하면 저자 이름이 여러 책에서 반복됩니다.
- `books.author_id`로 저자 행을 가리키면 이름의 원본은 `authors` 한 곳입니다.
- 조회할 때 JOIN이 필요하지만 수정 일관성을 얻습니다.

## 2-5. N:M 변형
다음을 연결 테이블로 풉니다.

### 학생과 강좌

```text
students 1 ─ N enrollments N ─ 1 courses
enrollments: enrolled_at, grade
```

### 주문과 상품

```text
orders 1 ─ N order_items N ─ 1 products
order_items: quantity, unit_price
```

### 배우와 영화

```text
actors 1 ─ N castings N ─ 1 movies
castings: role_name, billing_order
```

연결 테이블에는 관계 자체의 속성이 들어갈 수 있습니다.

### 2단원 확인
- [ ] 네 테이블의 PK와 FK를 표시했습니다.
- [ ] members와 books의 N:M을 loans로 풀어 설명했습니다.
- [ ] loans의 한 행이 대출 사건 한 번임을 설명했습니다.
- [ ] 정규화가 중복 copy의 불일치를 줄인다고 설명했습니다.

---

# 3. DDL과 제약조건
## 3-1. 파일과 연결
```js
const databasePath = path.join(dataDir, "library-step-2.sqlite")
const database = new DatabaseSync(databasePath)
database.exec("PRAGMA foreign_keys = ON")
```

`step-1` 파일을 재사용하지 않습니다. 단계마다 스키마와 데이터 state를 독립적으로 재현합니다.

## 3-2. authors 스키마
```sql
CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
```

현재 단계 `name UNIQUE`는 한 저자를 두 번 만들지 않기 위한 단순 규칙입니다. 실제 저자 식별은 이름만으로 부족할 수 있고 생년, 외부 식별자, 별도 저자 ID가 필요할 수 있습니다.

## 3-3. books 스키마
```sql
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  FOREIGN KEY (author_id) REFERENCES authors(id)
);
```

규칙을 자연어로 번역합니다.

1. 모든 도서는 내부 ID를 가집니다.
2. ISBN과 제목은 필수입니다.
3. ISBN은 중복되지 않습니다.
4. 저자 ID는 필수이고 실제 authors 행이어야 합니다.
5. 재고를 생략하면 0이며 음수는 허용하지 않습니다.

### 제약조건이 없는 경우 상상

- 존재하지 않는 저자 999를 저장한 도서는 누구의 책인가?
- stock -1은 대출 가능 수량을 어떻게 해석해야 하는가?
- 같은 ISBN 두 행 중 어느 것이 실제 책인가?

## 3-4. members와 loans 스키마
```sql
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  loaned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);
```

`returned_at`은 아직 반납하지 않은 대출에서 NULL입니다. NULL을 “오류”가 아니라 업무 상태로 의도적으로 사용합니다.

## 3-5. 구조 검사
기준 코드는 books의 외래 키를 출력합니다.

```js
database.prepare("PRAGMA foreign_key_list(books)").all()
```

추가로 다음을 실행합니다.

```js
console.table(database.prepare("PRAGMA table_info(loans)").all())
console.table(database.prepare("PRAGMA foreign_key_list(loans)").all())
console.table(database.prepare("PRAGMA index_list(books)").all())
```

스키마 선언을 눈으로 읽는 것과 데이터베이스가 실제로 만든 구조를 조회하는 것을 함께 사용합니다.

## 3-6. 제약조건 실패 실험
기준 데이터 생성 뒤, 연결을 닫기 전에 임시로 추가하고 각 실험 후 제거합니다.

### CHECK 실패

```js
try {
  insertBook.run("978-test-negative", "잘못된 재고", dataAuthorId, -1)
} catch (error) {
  console.log("CHECK:", error.message)
}
```

### FOREIGN KEY 실패

```js
try {
  insertBook.run("978-test-author", "없는 저자", 9999, 1)
} catch (error) {
  console.log("FK:", error.message)
}
```

### UNIQUE 실패

```js
try {
  insertBook.run("978-00-0001", "중복 ISBN", dataAuthorId, 1)
} catch (error) {
  console.log("UNIQUE:", error.message)
}
```

### NOT NULL 실패

```js
try {
  insertBook.run("978-test-null", null, dataAuthorId, 1)
} catch (error) {
  console.log("NOT NULL:", error.message)
}
```

오류 메시지에서 위반한 제약 종류와 테이블/열을 표시합니다.

### 3단원 확인
- [ ] 네 테이블 DDL을 자연어 규칙으로 번역했습니다.
- [ ] 외래 키 검사를 연결 직후 켰습니다.
- [ ] 네 종류 제약 실패 중 두 개 이상을 실행했습니다.
- [ ] 오류를 없애기 위해 제약조건을 제거하지 않았습니다.

---

# 4. 부모와 자식 데이터 생성
## 4-1. 저장 순서 예측
외래 키가 있으므로 참조 대상인 부모 행이 먼저 존재해야 합니다.

```text
authors 생성
  → books 생성(author_id 필요)

members 생성 + books 생성
  → loans 생성(member_id, book_id 필요)
```

다음 순서가 실패하는 이유를 설명합니다.

```text
loan 먼저 생성 → member와 book 나중 생성
```

외래 키는 미래에 생길 행을 예약해 두지 않습니다.

## 4-2. statement 준비
```js
const insertAuthor = database.prepare(
  "INSERT INTO authors (name) VALUES (?)",
)

const insertBook = database.prepare(`
  INSERT INTO books (isbn, title, author_id, stock)
  VALUES (?, ?, ?, ?)
`)
```

각 테이블의 INSERT 문을 한 번 준비하고 값만 바꿔 반복합니다. 플레이스홀더 순서를 스키마 표 옆에 적습니다.

## 4-3. 생성 ID를 연결 값으로 사용
```js
const dataAuthorId = insertAuthor.run("김데이터").lastInsertRowid
const nodeAuthorId = insertAuthor.run("이노드").lastInsertRowid
```

```js
const databaseBookId = insertBook.run(
  "978-00-0001",
  "데이터를 배우는 시간",
  dataAuthorId,
  3,
).lastInsertRowid
```

ID가 1일 것이라고 가정하지 않고 실제 결과를 변수에 저장합니다. 데이터 초기화 방식이 바뀌거나 다른 행이 먼저 생성되어도 올바른 저자를 참조합니다.

## 4-4. 기준 데이터 추적표
코드를 읽고 실제 실행 전 다음 표를 채웁니다.

| 생성 순서 | 테이블 | 핵심 값 | 참조 값 |
| ---: | --- | --- | --- |
| 1 | authors | 김데이터 | 없음 |
| 2 | authors | 이노드 | 없음 |
| 3 | books | 데이터를 배우는 시간 | dataAuthorId |
| 4 | books | SQL 첫걸음 | dataAuthorId |
| 5 | books | Node.js 실습 노트 | nodeAuthorId |
| 6 | members | 김민지 | 없음 |
| 7 | loans | 첫 대출 | memberId + databaseBookId |

## 4-5. 안내 실습 — 새 저자와 책
다음 데이터를 올바른 순서로 추가합니다.

```text
저자: 최쿼리
도서: JOIN을 이해하는 법
ISBN: 978-00-0090
재고: 4
```

```js
const queryAuthorId = insertAuthor.run("최쿼리").lastInsertRowid
const joinBookId = insertBook.run(
  "978-00-0090",
  "JOIN을 이해하는 법",
  queryAuthorId,
  4,
).lastInsertRowid
```

실행 전 예측:

- authors: 3행
- books: 4행
- JOIN 결과: 4행
- 새 책의 저자: 최쿼리

## 4-6. 고아 참조 토론
MongoDB의 `publisherCode` 같은 참조는 실제 출판사 문서를 가리키는지 DB가 자동으로 검사하지 않습니다. 외래 키가 주는 보장과 비교해 기록합니다.

### 4단원 확인
- [ ] 부모→자식 저장 순서를 설명했습니다.
- [ ] 숫자 ID를 하드코딩하지 않고 생성 결과를 사용했습니다.
- [ ] 새 저자와 책을 연결해 추가했습니다.
- [ ] loans가 두 부모 ID를 모두 필요로 함을 설명했습니다.

---

# 5. INNER JOIN과 다중 JOIN
## 5-1. JOIN 전 원본 테이블 읽기
JOIN을 바로 실행하지 않고 각 입력을 먼저 봅니다.

```sql
SELECT id, name FROM authors ORDER BY id;
SELECT id, title, author_id, stock FROM books ORDER BY id;
```

손으로 연결선을 긋습니다.

```text
authors.id=1 김데이터
  ├─ books.author_id=1 데이터를 배우는 시간
  └─ books.author_id=1 SQL 첫걸음

authors.id=2 이노드
  └─ books.author_id=2 Node.js 실습 노트
```

## 5-2. 도서와 저자 JOIN
```sql
SELECT
  books.id,
  books.title,
  authors.name AS author,
  books.stock
FROM books
JOIN authors ON authors.id = books.author_id
ORDER BY books.id;
```

절별 해석:

- `FROM books`: 결과의 기준은 도서입니다.
- `JOIN authors`: 저자 행을 연결합니다.
- `ON authors.id = books.author_id`: 어떤 행끼리 연결할지 정합니다.
- `authors.name AS author`: 출력 열 별칭을 정합니다.
- `ORDER BY books.id`: 도서 ID 순으로 표시합니다.

외래 키가 유효하고 책마다 저자 한 명이므로 기준 데이터에서는 책 수와 결과 행 수가 같습니다.

## 5-3. 잘못된 ON 관찰
다음 잘못된 조건의 결과를 실행 전에 예측합니다.

```sql
FROM books
JOIN authors ON authors.id = books.id
```

도서 ID와 저자 ID는 우연히 같은 숫자일 수 있지만 관계를 표현하는 열이 아닙니다. 일부 행이 그럴듯하게 나와 더 위험합니다. JOIN 조건은 이름이나 현재 값의 우연이 아니라 스키마 관계에서 가져옵니다.

다음 조건을 생략하면 어떻게 되는지도 토론합니다.

```sql
FROM books
JOIN authors
```

가능한 모든 조합인 Cartesian product가 생겨 `책 수 × 저자 수` 행이 될 수 있습니다.

## 5-4. 세 테이블 대출 JOIN
```sql
SELECT
  loans.id,
  members.name AS member,
  books.title AS book,
  loans.loaned_at
FROM loans
JOIN members ON members.id = loans.member_id
JOIN books ON books.id = loans.book_id
WHERE loans.returned_at IS NULL;
```

결과 한 행은 회원도 도서도 아닌 “현재 반납되지 않은 대출 한 건”입니다.

흐름:

```text
loans 한 행
  → member_id로 회원 이름 연결
  → book_id로 책 제목 연결
  → returned_at이 NULL인 행만 유지
```

## 5-5. 안내 실습 — 출력 확장
현재 대출 결과에 다음 필드를 추가합니다.

- `members.email AS member_email`
- `books.isbn`
- `books.stock`

예상 행 수는 그대로 1입니다. SELECT 열을 늘리는 것은 결과 행 수를 늘리는 작업이 아닙니다.

```sql
SELECT
  loans.id,
  members.name AS member,
  members.email AS member_email,
  books.isbn,
  books.title AS book,
  books.stock,
  loans.loaned_at
...
```

### 5단원 확인
- [ ] JOIN 전 원본 ID를 따로 조회했습니다.
- [ ] ON 조건이 스키마의 PK-FK 연결임을 설명했습니다.
- [ ] 도서 JOIN과 대출 JOIN의 결과 기준을 구분했습니다.
- [ ] SELECT 열 수와 결과 행 수를 혼동하지 않았습니다.

---

# 6. LEFT JOIN과 모델링 연습
## 6-1. INNER JOIN의 누락 관찰
도서가 없는 저자 `무도서`를 추가합니다.

```js
insertAuthor.run("무도서")
```

기존 도서-저자 INNER JOIN을 실행하면 이 저자는 나오지 않습니다. INNER JOIN은 연결 상대가 있는 조합만 반환하기 때문입니다.

질문:

- “도서 목록에 저자 이름 표시”에서는 이 누락이 문제인가?
- “모든 저자와 보유 도서 표시”에서는 이 누락이 문제인가?

같은 데이터라도 질문에 따라 JOIN 종류가 달라집니다.

## 6-2. LEFT JOIN
```sql
SELECT
  authors.id,
  authors.name AS author,
  books.title
FROM authors
LEFT JOIN books ON books.author_id = authors.id
ORDER BY authors.id, books.id;
```

왼쪽 `authors`의 모든 행을 유지합니다. 도서가 없는 저자는 `books.title = NULL`로 한 행이 보입니다.

예상 행 수를 계산합니다.

- 김데이터: 2권 → 2행
- 이노드: 1권 → 1행
- 무도서: 0권 → NULL 확장 1행
- 합계: 4행

LEFT JOIN 결과 수는 왼쪽 테이블 행 수와 항상 같지 않습니다. 오른쪽에 여러 연결 행이 있으면 왼쪽 행이 반복됩니다.

## 6-3. ON과 WHERE
다음을 비교합니다.

```sql
-- 재고가 있는 책만 연결하되 모든 저자는 유지
SELECT authors.name, books.title
FROM authors
LEFT JOIN books
  ON books.author_id = authors.id
 AND books.stock > 0;
```

```sql
-- 연결 후 재고가 있는 결과만 남김: NULL 저자 행도 제거됨
SELECT authors.name, books.title
FROM authors
LEFT JOIN books ON books.author_id = authors.id
WHERE books.stock > 0;
```

LEFT JOIN 오른쪽 조건을 WHERE에 두면 `books.stock`이 NULL인 행이 조건을 통과하지 못합니다. 모든 저자를 유지하려던 목적이 깨질 수 있습니다.

## 6-4. 대출 없는 도서 찾기
```sql
SELECT books.id, books.title
FROM books
LEFT JOIN loans ON loans.book_id = books.id
WHERE loans.id IS NULL
ORDER BY books.id;
```

LEFT JOIN으로 연결 상대가 없는 NULL 행만 고르는 anti-join 패턴입니다.

현재 기준에서는 첫 책만 대출 기록이 있으므로 나머지 책이 나옵니다. 새 대출을 추가하면 결과가 어떻게 바뀔지 예측합니다.

## 6-5. 도메인 모델링 연습
다음 중 하나를 골라 4개 이상의 테이블과 관계를 설계합니다.

### 쇼핑몰

- 고객, 주문, 상품, 주문 항목
- 주문 당시 수량과 단가는 어디에 둘 것인가?
- 상품명 변경이 과거 주문 표시에 영향을 줘도 되는가?

### 학교

- 학생, 강좌, 강사, 수강
- 한 학생의 같은 강좌 중복 수강을 막을 것인가?
- 수강 성적은 어느 테이블에 둘 것인가?

### 병원 예약

- 환자, 의사, 진료 시간, 예약
- 같은 의사와 시각의 중복 예약을 어떻게 막을 것인가?
- 예약 취소를 DELETE할지 상태로 남길지?

기록 형식:

```text
table(column...)
PK:
FK:
UNIQUE/CHECK:
relationship:
한 결과 행의 의미:
```

## 6-6. 마무리 확인
1. `loans`에 member name 대신 member ID를 저장하는 이유는?
2. LEFT JOIN에서 왼쪽 3행이 결과 5행이 될 수 있는 이유는?
3. 내일 UPDATE와 대출 처리에서 여러 변경을 묶어야 하는 이유는?

---

# 7. 기준 코드 상세 해설

## 7-1. 네 CREATE TABLE을 한 `exec`에서 실행

```js
database.exec(`
  CREATE TABLE authors (...);
  CREATE TABLE books (...);
  CREATE TABLE members (...);
  CREATE TABLE loans (...);
`)
```

세미콜론으로 여러 DDL 문장을 구분합니다. 테이블 생성 순서도 참조 관계를 읽기 쉽게 부모부터 배치했습니다.

## 7-2. INSERT statement 역할 분리

```js
const insertAuthor = database.prepare(...)
const insertBook = database.prepare(...)
const insertMember = database.prepare(...)
const insertLoan = database.prepare(...)
```

테이블마다 열과 플레이스홀더 개수가 다르므로 의도가 분리됩니다. 각 statement 이름만 보고 어느 테이블을 변경하는지 알 수 있습니다.

## 7-3. ID 변수 이름

```js
const dataAuthorId = ...
const nodeAuthorId = ...
const databaseBookId = ...
const memberId = ...
```

`id1`, `id2` 대신 어떤 엔터티의 어떤 행인지 드러나는 이름을 사용합니다. 변수명만 읽어도 ID의 의미와 출처를 확인할 수 있어야 합니다.

## 7-4. 조회로 관계 검증

INSERT가 모두 성공해도 잘못된 저자 ID를 전달했다면 유효하지만 의미가 틀린 관계일 수 있습니다. JOIN 결과의 제목과 저자 이름을 읽어 업무적으로도 올바른 연결인지 확인합니다.

## 7-5. 연결 종료

모든 스키마/데이터 검증 뒤 `database.close()`를 호출합니다. `step-2.js`는 실행 과정 전체를 파일 하나의 생명주기로 관리합니다.

---

# 8. 추가 JOIN 예제

## 예제 A. 특정 저자의 책

```sql
SELECT books.title, books.stock
FROM books
JOIN authors ON authors.id = books.author_id
WHERE authors.name = ?
ORDER BY books.title;
```

```js
.all("김데이터")
```

이름이 예제 스키마에서 UNIQUE이므로 특정 저자를 고르지만 실제 모델에서는 저자 ID를 식별 조건으로 쓰는 편이 안정적입니다.

## 예제 B. 반납 상태 표시

```sql
SELECT
  members.name,
  books.title,
  CASE
    WHEN loans.returned_at IS NULL THEN '대출 중'
    ELSE '반납 완료'
  END AS loan_status
FROM loans
JOIN members ON members.id = loans.member_id
JOIN books ON books.id = loans.book_id;
```

저장 값과 표시용 문구를 구분합니다.

## 예제 C. 저자 없는 도서가 가능한가

현재 `author_id NOT NULL`과 외래 키 때문에 불가능합니다. 공동 저자나 저자 미상 요구가 생기면 NULL을 허용하기 전에 모델을 다시 검토합니다.

공동 저자 모델:

```text
authors 1 ─ N book_authors N ─ 1 books
book_authors(author_id, book_id, author_order)
```

## 예제 D. 현재 대출 중복 방지

현재 스키마는 같은 책의 반납되지 않은 대출을 여러 개 저장하는 것을 DB 제약 하나로 막지 않습니다. 재고 여러 권을 한 `books` 행의 stock으로 표현하기 때문입니다. “물리적 복사본 한 권씩 관리”가 필요하다면 다음 모델을 검토합니다.

```text
books 1 ─ N book_copies
book_copies(id, book_id, barcode, status)
loans(..., book_copy_id, ...)
```

모델은 요구사항의 정밀도에 따라 달라집니다.

## 예제 E. 결과 행의 기준

```sql
FROM authors JOIN books ...
```

책이 여러 개면 저자 행이 반복되므로 결과 한 행은 연결된 저자-책 조합입니다.

```sql
FROM loans JOIN members ... JOIN books ...
```

loans가 기준이면 결과 한 행은 대출 사건 한 번입니다. SELECT에 회원 열이 많아져도 기준은 바뀌지 않습니다.

---

# 9. 연습 문제

## 기초

1. 새 저자 한 명과 그 저자의 도서 두 권을 추가합니다.
2. 존재하지 않는 author ID로 책을 추가해 오류를 기록합니다.
3. stock -1과 중복 ISBN 오류를 각각 재현합니다.
4. 도서 JOIN 결과에 ISBN을 추가합니다.
5. 대출 JOIN 결과에 회원 email과 반납 시각을 추가합니다.

## 응용

6. 대출이 한 번도 없는 도서를 LEFT JOIN으로 찾습니다.
7. 도서가 없는 저자를 추가하고 모든 저자를 LEFT JOIN으로 출력합니다.
8. `ON books.stock > 0`과 `WHERE books.stock > 0` 결과를 비교합니다.
9. 두 번째 회원과 대출을 추가하고 결과 행 수를 예측·검증합니다.
10. 같은 회원이 같은 책을 다시 빌릴 수 있는 현재 스키마의 이유를 설명합니다.

## 모델링

11. 공동 저자를 지원하도록 `book_authors` 연결 테이블을 설계합니다.
12. 물리적 도서 복사본마다 barcode를 관리하도록 테이블을 추가합니다.
13. 쇼핑몰 order/order_items 관계를 그리고 quantity와 unit_price 위치를 정합니다.
14. 학생-강좌 수강에서 중복 수강을 막는 복합 UNIQUE를 설계합니다.
15. 저자 이름 UNIQUE가 현실에서 부적절할 수 있는 이유와 대안을 적습니다.

<details>
<summary>힌트</summary>

- 부모 행를 먼저 만들고 `lastInsertRowid`를 자식 INSERT에 전달합니다.
- 대출 없는 도서는 `LEFT JOIN loans ... WHERE loans.id IS NULL` 패턴을 사용합니다.
- N:M은 두 FK를 가진 연결 테이블로 풉니다.
- 공동 저자 연결 테이블에는 `(book_id, author_id)` UNIQUE와 `author_order`를 검토합니다.
- 물리적 복사본을 구분하면 재고 숫자 하나 대신 실제 copy 행 수와 상태를 사용할 수 있습니다.

</details>

---

# 10. 자주 만나는 문제와 진단

## 외래 키 오류가 나지 않습니다

```js
database.exec("PRAGMA foreign_keys = ON")
```

연결 직후 실행됐는지 확인합니다. 다음 값도 조회할 수 있습니다.

```js
console.log(database.prepare("PRAGMA foreign_keys").get())
```

## `FOREIGN KEY constraint failed`

오류 SQL이 books인지 loans인지 확인합니다. 참조할 부모 ID가 실제 존재하는지 각각 조회합니다.

```sql
SELECT * FROM authors WHERE id = ?;
SELECT * FROM members WHERE id = ?;
SELECT * FROM books WHERE id = ?;
```

## JOIN 결과가 비어 있습니다

1. 기준 테이블에 행이 있는지 확인합니다.
2. FK 값과 부모 PK 값을 따로 출력합니다.
3. ON의 테이블/열 이름이 맞는지 확인합니다.
4. WHERE 조건을 잠시 제거해 JOIN과 필터 문제를 분리합니다.

## JOIN 결과가 예상보다 많습니다

- 1:N 오른쪽에 여러 행이 있으면 왼쪽 행이 반복됩니다.
- ON 조건을 빠뜨려 Cartesian product가 생겼는지 확인합니다.
- 같은 관계를 두 번 JOIN하지 않았는지 확인합니다.
- 결과 한 행의 기준을 다시 정의합니다.

## LEFT JOIN인데 연결 없는 행이 사라집니다

오른쪽 테이블 조건을 WHERE에 두었는지 확인합니다. 모든 왼쪽 행을 유지하려면 조건을 ON에 둘지, `OR right.id IS NULL`이 필요한지 요구사항을 다시 봅니다.

## `UNIQUE constraint failed: authors.name`

같은 저자를 다시 INSERT하기 전에 조회하거나 기존 ID를 재사용합니다. 단, “이름이 같으면 같은 사람”이라는 현재 단계 규칙은 실제 시스템에서는 재검토해야 합니다.

## 숫자 ID를 직접 넣었더니 잘못 연결됩니다

생성 순서에 따라 ID가 달라질 수 있습니다. `lastInsertRowid`를 변수에 저장하고 의미 있는 변수 이름으로 전달합니다.

## step-1 데이터가 보이지 않습니다

`library-step-2.sqlite`라는 별도 파일을 사용하고 매번 새 스키마를 만듭니다. 코드는 개인 저장소의 `main`에 누적하지만 실행 데이터베이스 파일은 예제별로 분리합니다.

---

# 11. 이해 점검

## 문항

1. 큰 대출 테이블의 수정 이상을 예로 설명하세요.
2. 기본 키와 외래 키의 역할 차이를 설명하세요.
3. books에서 author_id를 두는 cardinality 이유를 설명하세요.
4. members와 books의 N:M을 loans가 어떻게 푸는지 설명하세요.
5. CHECK와 FOREIGN KEY가 각각 막는 잘못된 book 상태를 쓰세요.
6. 부모 행를 먼저 INSERT해야 하는 이유를 쓰세요.
7. `lastInsertRowid`를 하드코딩 ID 대신 써야 하는 이유는?
8. INNER JOIN과 LEFT JOIN의 차이를 도서 없는 저자로 설명하세요.
9. LEFT JOIN의 오른쪽 조건을 WHERE에 둘 때 생길 수 있는 변화는?
10. 대출 JOIN 결과 한 행이 무엇인지 쓰세요.

<details>
<summary>확인 기준</summary>

1. 같은 회원 email이 여러 대출 행에 반복되어 일부만 바뀌는 불일치를 설명합니다.
2. PK는 자기 행 식별, FK는 다른 테이블의 유효한 행 참조입니다.
3. 저자 1명에 책 N권이며 N 쪽 books가 FK를 가집니다.
4. loans가 member_id와 book_id를 가져 두 1:N 관계로 만듭니다.
5. 음수 재고와 없는 저자 참조 예가 적절합니다.
6. FK가 실제 존재하는 부모 키만 허용합니다.
7. ID 값과 생성 순서가 달라져도 실제 결과를 연결하기 위해서입니다.
8. INNER는 연결 책이 없어 누락, LEFT는 저자를 NULL 책과 함께 유지합니다.
9. 오른쪽 NULL 행이 조건을 통과하지 못해 왼쪽 행이 사라질 수 있습니다.
10. 회원-도서가 연결된 대출 사건 한 건입니다.

</details>

답을 위 확인 기준과 비교하고 근거가 부족한 항목은 관련 절의 실행 결과를 다시 확인합니다.

---

# 저장소에 기록하기

실험용 데이터를 정리하고 `npm.cmd run check`를 통과시킨 뒤 현재 단계의 코드와 기록을 저장합니다.

```powershell
git branch --show-current
git status --short
npm.cmd run check
git add .
git commit -m "Complete database step 2"
git push
git status --short --branch
```

`main`과 `origin/main`이 같은 commit을 가리키고 작업 파일 목록이 비어 있으면 마쳤습니다.

# 12. 완료 기준

- [ ] 개인 저장소의 `main`과 전용 SQLite 파일을 확인했습니다.
- [ ] 큰 테이블의 삽입·수정·삭제 이상을 설명했습니다.
- [ ] authors/books/members/loans 엔터티를 요구사항에서 찾았습니다.
- [ ] 네 테이블의 PK, FK, UNIQUE, CHECK를 표시했습니다.
- [ ] 1:N과 N:M 관계를 도서관 외 예제로도 설명했습니다.
- [ ] 부모→자식 순서로 행을 만들고 생성 ID를 연결했습니다.
- [ ] FOREIGN KEY와 CHECK 실패를 실제로 확인했습니다.
- [ ] 도서-저자 INNER JOIN 결과를 예측하고 검증했습니다.
- [ ] 대출-회원-도서 다중 JOIN을 실행했습니다.
- [ ] LEFT JOIN으로 연결 상대 없는 행을 보존했습니다.
- [ ] ON과 WHERE의 조건 위치 차이를 관찰했습니다.
- [ ] 다른 도메인의 4-테이블 모델을 설계했습니다.
- [ ] 이해 점검의 답을 실행 결과와 비교했습니다.

## 다시 확인할 항목

실행이 막히면 다음 다섯 활동은 완료합니다.

1. 네 테이블 ERD와 PK/FK 표시
2. 기준 `npm.cmd start` 실행
3. 없는 author ID FOREIGN KEY 실패
4. books-authors INNER JOIN
5. 도서 없는 저자를 포함하는 LEFT JOIN

## 추가 연습

1. 공동 저자를 위한 `book_authors` 스키마 구현
2. 물리적 복사본 `book_copies` 스키마 구현
3. 복합 UNIQUE를 가진 수강 테이블 구현
4. 외래 키 삭제 정책 `RESTRICT`, `CASCADE`, `SET NULL` 비교
5. JOIN 3개 이상인 도서-대출-회원-저자 보고서 작성

## 적용 질문

같은 네 테이블을 조회·집계하거나 변경할 때도 관계와 제약조건을 유지해야 합니다. 재고 감소와 대출 생성 중 하나만 성공할 때 생기는 문제를 적습니다.

> 재고 1권인 책을 두 회원이 거의 동시에 빌리려 할 때, `SELECT stock` 후 `UPDATE`하면 어떤 경쟁이 생길까?
