# Step 3. SQL 조회·조작·트랜잭션

앞에서 만든 관계형 스키마로 조건 조회, 정렬, 집계, 수정, 삭제를 연습합니다. 마지막에는 재고 감소와 대출 생성을 한 트랜잭션으로 묶어 둘 중 하나만 반영되는 상황을 막습니다.

## 0. 먼저 생각할 질문

1. 필요한 행과 열만 정확히 선택하려면 SQL의 각 절을 어떤 순서로 생각해야 하는가?
2. 한 결과 행이 원본 행인지 그룹 요약인지 어떻게 구분하는가?
3. `WHERE` 없는 UPDATE/DELETE와 잘못된 조건을 어떻게 실행 전에 발견하는가?
4. 처리 건수 0은 언제 오류이고 언제 정상인가?
5. 재고 감소와 대출 생성 중 하나만 성공하면 어떤 불일치가 생기는가?
6. `BEGIN`, `COMMIT`, `ROLLBACK`이 실제 저장 상태를 어떻게 바꾸는가?

## 1. 완료 목표

### 개념

- `SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`의 역할을 구분합니다.
- 비교·논리·범위·패턴·NULL 조건을 설명합니다.
- `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`와 그룹의 의미를 설명합니다.
- UPDATE/DELETE의 대상 범위와 영향 행 수를 설명합니다.
- transaction과 ACID의 원자성·일관성·격리성·지속성을 사례로 설명합니다.

### 실습

- 플레이스홀더를 사용한 필터와 다중 정렬을 작성합니다.
- JOIN한 행을 그룹으로 요약하고 `HAVING`으로 그룹을 거릅니다.
- 수정·삭제 전에 같은 WHERE로 대상을 조회합니다.
- `result.changes`와 사후 SELECT로 변경을 검증합니다.
- 재고가 있을 때만 감소하는 조건부 UPDATE를 작성합니다.
- 성공 시 COMMIT, 실패 시 ROLLBACK하는 대출 함수를 추적합니다.
- 반납 처리를 transaction으로 설계합니다.

### 작업 원칙

- 쿼리 실행 전에 결과 행 수와 정렬 순서를 예측합니다.
- SELECT에서 검증한 조건을 변경 SQL에 그대로 사용합니다.
- 오류를 catch했다는 사실보다 rollback 후 상태가 원래대로인지 확인합니다.
- transaction이 잘못된 업무 조건까지 자동으로 고치지 않는다는 점을 기억합니다.

## 2. 완료 결과

- 조건 조회 5개와 예상/실제 결과 표
- 저자별·연도별 집계와 그룹 단위 설명
- UPDATE/DELETE 사전 조회·처리 건수·사후 조회 기록
- 성공 대출과 실패 대출의 재고·대출 행 비교
- 반납 transaction 구현 또는 상세 의사코드
- RDBMS 종합 점검 답안과 오류 원인 정리

## 3. 시작 전 확인

> Windows 11에서는 [환경 준비](../windows-11.md) <span class="print-reference" data-print-reference="true">(인쇄본 위치: Database · 장 「Windows 11 x64 실습 환경 준비」 · 절 「1. Windows Terminal 설치」)</span>를 먼저 확인합니다. 명령은 이 교재의 PowerShell 코드 블록에 적힌 `git`, `node`, `npm` 형태를 그대로 사용합니다.

```powershell
git branch --show-current
git status
```

아래에서 `index.js` 전체를 입력한 뒤 실행합니다. 현재 단계 파일은 `data/library-step-3.sqlite`이며 실행마다 다음 기준 상태로 초기화됩니다.

### authors

| id | name |
| ---: | --- |
| 1 | 김데이터 |
| 2 | 이노드 |

### books

| id | title | author_id | year | stock |
| ---: | --- | ---: | ---: | ---: |
| 1 | 데이터를 배우는 시간 | 1 | 2025 | 3 |
| 2 | SQL 첫걸음 | 1 | 2024 | 2 |
| 3 | Node.js 실습 노트 | 2 | 2023 | 1 |
| 4 | 웹 개발자를 위한 데이터 | 1 | 2026 | 4 |

### members와 loans

- 회원: 김민지(1), 이준호(2)
- 대출 1: 김민지 → SQL 첫걸음, `returned_at = NULL`
- 대출 2: 이준호 → Node.js 실습 노트, 반납 완료

## 4. 소스 파일 전체 입력

개인 저장소의 기존 파일을 아래 전체 내용으로 바꿉니다. 이 저장소의 `step-N` 기준 브랜치로 이동하지 않습니다.

### `index.js`

`index.js`를 열고 파일 전체를 다음 내용으로 맞춥니다.

~~~js
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const dataDir = path.join(__dirname, "data")
const databasePath = path.join(dataDir, "library-step-3.sqlite")

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
    published_year INTEGER NOT NULL,
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

  INSERT INTO authors (name) VALUES ('김데이터'), ('이노드');
  INSERT INTO books (isbn, title, author_id, published_year, stock) VALUES
    ('978-00-0001', '데이터를 배우는 시간', 1, 2025, 3),
    ('978-00-0002', 'SQL 첫걸음', 1, 2024, 2),
    ('978-00-0003', 'Node.js 실습 노트', 2, 2023, 1),
    ('978-00-0004', '웹 개발자를 위한 데이터', 1, 2026, 4);
  INSERT INTO members (name, email) VALUES
    ('김민지', 'minji@example.com'),
    ('이준호', 'junho@example.com');
  INSERT INTO loans (member_id, book_id, returned_at) VALUES
    (1, 2, NULL),
    (2, 3, '2026-07-01 10:00:00');
`)

console.log("재고가 2권 이상인 도서")
console.table(
  database
    .prepare(`
      SELECT title, published_year, stock
      FROM books
      WHERE stock >= ?
      ORDER BY published_year DESC, title ASC
    `)
    .all(2),
)

console.log("저자별 도서 수와 총 재고")
console.table(
  database
    .prepare(`
      SELECT
        authors.name AS author,
        COUNT(books.id) AS book_count,
        SUM(books.stock) AS total_stock
      FROM authors
      LEFT JOIN books ON books.author_id = authors.id
      GROUP BY authors.id, authors.name
      ORDER BY book_count DESC
    `)
    .all(),
)

const updateEmail = database.prepare(`
  UPDATE members
  SET email = ?
  WHERE id = ?
`)
const emailResult = updateEmail.run("minji.new@example.com", 1)
console.log(`회원 email 수정: ${emailResult.changes}건`)

const deleteReturnedLoans = database.prepare(`
  DELETE FROM loans
  WHERE returned_at IS NOT NULL
`)
const deleteResult = deleteReturnedLoans.run()
console.log(`반납 완료 기록 정리: ${deleteResult.changes}건`)

function checkoutBook(memberId, bookId) {
  database.exec("BEGIN")

  try {
    const stockResult = database
      .prepare(`
        UPDATE books
        SET stock = stock - 1
        WHERE id = ? AND stock > 0
      `)
      .run(bookId)

    if (stockResult.changes !== 1) {
      throw new Error("대출 가능한 재고가 없습니다.")
    }

    database
      .prepare("INSERT INTO loans (member_id, book_id) VALUES (?, ?)")
      .run(memberId, bookId)

    database.exec("COMMIT")
    console.log(`대출 완료: member=${memberId}, book=${bookId}`)
  } catch (error) {
    database.exec("ROLLBACK")
    console.log(`대출 취소: ${error.message}`)
  }
}

checkoutBook(2, 1)

console.log("변경 후 현재 대출")
console.table(
  database
    .prepare(`
      SELECT members.name AS member, books.title AS book, loans.loaned_at
      FROM loans
      JOIN members ON members.id = loans.member_id
      JOIN books ON books.id = loans.book_id
      WHERE loans.returned_at IS NULL
      ORDER BY loans.id
    `)
    .all(),
)

database.close()
console.log(`SQLite 파일: ${databasePath}`)
~~~

### 입력 후 검사

```powershell
npm run check
npm start
```

문법 검사와 SQLite 실행이 모두 끝나야 다음 활동으로 이동합니다.

# 1. SELECT와 WHERE
## 1-1. Step 2 관계 회수
다음 문장을 완성합니다.

> `books.author_id`는 ______의 ______를 가리키는 ______이다. `loans`의 한 행은 ______ 한 번이며, 회원과 도서를 연결한다.

현재 단계 쿼리는 이 관계를 유지한 상태에서 어떤 행을 읽고 바꿀지 결정합니다.

## 1-2. SELECT의 질문 네 가지
```sql
SELECT title, published_year, stock
FROM books
WHERE stock >= ?
ORDER BY published_year DESC, title ASC;
```

1. 어디에서 읽는가? — `FROM books`
2. 어떤 행을 남기는가? — `WHERE stock >= ?`
3. 어떤 열을 보여주는가? — `SELECT title, ...`
4. 어떤 순서로 보여주는가? — `ORDER BY ...`

작성은 SELECT부터 하지만 개념적으로 `FROM → WHERE → SELECT → ORDER BY` 흐름으로 생각하면 결과를 예측하기 쉽습니다.

## 1-3. 비교 조건
| 의미 | 연산자 | 예 |
| --- | --- | --- |
| 같음 | `=` | `author_id = 1` |
| 다름 | `<>`, `!=` | `stock <> 0` |
| 크기 | `>`, `>=`, `<`, `<=` | `published_year >= 2025` |
| 범위 | `BETWEEN ... AND ...` | `published_year BETWEEN 2024 AND 2025` |
| 목록 | `IN (...)` | `id IN (1, 3, 4)` |

### 안내 실습 A

2025년 이후 출판된 책을 찾습니다.

```sql
SELECT id, title, published_year
FROM books
WHERE published_year >= ?
ORDER BY published_year;
```

```js
.all(2025)
```

예상: 2025년, 2026년 두 행입니다.

## 1-4. 논리 조건
```sql
SELECT title, published_year, stock
FROM books
WHERE published_year >= ? AND stock >= ?;
```

서로 다른 조건을 모두 만족해야 하면 `AND`, 하나 이상이면 `OR`, 조건을 뒤집으면 `NOT`입니다.

괄호가 없으면 `AND`와 `OR`의 우선순위 때문에 의도와 다른 행이 포함될 수 있습니다.

```sql
WHERE (author_id = 1 OR author_id = 2)
  AND stock >= 2
```

SQL 연산자 우선순위에만 기대지 말고 의도한 그룹을 괄호로 표시합니다.

### 결과 예측

```sql
WHERE author_id = 1 AND stock >= 3
```

김데이터 도서 중 stock 3, 4인 두 권입니다.

## 1-5. NULL 조건
반납하지 않은 대출:

```sql
SELECT id, member_id, book_id, loaned_at
FROM loans
WHERE returned_at IS NULL;
```

반납 완료 대출:

```sql
WHERE returned_at IS NOT NULL
```

`returned_at = NULL`은 사용하지 않습니다. NULL은 일반 값과 같다고 비교할 수 없는 unknown 상태입니다.

### 세 값 논리 직관

`returned_at > '2026-01-01'`에서 returned_at이 NULL이면 참도 거짓도 아닌 unknown이고 WHERE는 true인 행만 남깁니다.

## 1-6. LIKE와 escape
```sql
SELECT title
FROM books
WHERE title LIKE ?
ORDER BY title;
```

```js
.all("%데이터%")
```

- `%`: 길이 0 이상 임의 문자열
- `_`: 임의의 한 문자

사용자가 입력한 `%`와 `_`를 문자 그대로 찾고 싶다면 ESCAPE 정책이 필요합니다. 패턴의 의미를 확인하고 값을 플레이스홀더로 전달합니다.

### 1단원 확인
- [ ] SELECT의 네 질문을 구분했습니다.
- [ ] 비교와 논리 조건을 조합했습니다.
- [ ] NULL은 IS NULL로 조회했습니다.
- [ ] 제목 부분 검색을 플레이스홀더로 실행했습니다.

---

# 2. 정렬, 제한, 전체 집계
## 2-1. ORDER BY
기준 코드:

```sql
SELECT title, published_year, stock
FROM books
WHERE stock >= ?
ORDER BY published_year DESC, title ASC;
```

정렬 규칙:

1. 출판 연도 내림차순
2. 같은 연도에서는 제목 오름차순

현재 결과는 2026, 2025, 2024 순입니다. 첫 정렬 기준 값이 같을 때만 두 번째 기준이 사용됩니다.

### 안정적인 페이지 순서

여러 행의 정렬 값이 모두 같으면 DB가 임의 순서로 반환할 수 있습니다. 페이지네이션처럼 재현 가능한 순서가 필요하면 마지막에 unique한 ID를 추가합니다.

```sql
ORDER BY published_year DESC, title ASC, id ASC
```

## 2-2. LIMIT과 OFFSET
```sql
SELECT id, title, published_year
FROM books
ORDER BY published_year DESC, id ASC
LIMIT 2 OFFSET 0;
```

- 첫 페이지: LIMIT 2 OFFSET 0
- 둘째 페이지: LIMIT 2 OFFSET 2

OFFSET이 매우 커지면 앞 행을 건너뛰는 비용이 생길 수 있습니다. 실제 대규모 페이지에서는 마지막 정렬 키를 조건으로 쓰는 keyset pagination을 검토합니다. 여기서는 LIMIT과 안정 정렬을 확인합니다.

## 2-3. 집계 함수
```sql
SELECT
  COUNT(*) AS book_count,
  SUM(stock) AS total_stock,
  AVG(stock) AS average_stock,
  MIN(stock) AS minimum_stock,
  MAX(stock) AS maximum_stock
FROM books;
```

기준 데이터 예상:

- book_count: 4
- total_stock: 10
- average_stock: 2.5
- minimum_stock: 1
- maximum_stock: 4

여러 입력 행을 전체 하나의 그룹으로 보고 결과 한 행을 만듭니다.

## 2-4. COUNT의 차이
```sql
SELECT
  COUNT(*) AS all_loans,
  COUNT(returned_at) AS returned_loans
FROM loans;
```

- `COUNT(*)`: 모든 대출 행 2개
- `COUNT(returned_at)`: NULL이 아닌 반납 완료 1개

COUNT(열)은 NULL을 세지 않습니다. 이를 이용할 수도 있지만 의도를 별칭으로 명확히 합니다.

## 2-5. WHERE 후 집계
```sql
SELECT COUNT(*) AS available_titles, SUM(stock) AS available_copies
FROM books
WHERE stock > 0;
```

WHERE가 먼저 행을 고른 뒤 집계합니다. 현재 모든 도서가 재고 1 이상이므로 제목 4종, 복사본 10권입니다.

## 2-6. 안내 실습
김데이터(author_id 1)의 도서 수, 총 재고, 평균 재고를 구합니다.

```sql
SELECT COUNT(*) AS count, SUM(stock) AS total, AVG(stock) AS average
FROM books
WHERE author_id = ?;
```

예상: 3권, 총 9, 평균 3입니다.

### 2단원 확인
- [ ] 다중 정렬 우선순위를 설명했습니다.
- [ ] LIMIT에 명확한 ORDER BY가 필요한 이유를 말했습니다.
- [ ] 전체 집계 예상값을 손으로 계산했습니다.
- [ ] COUNT(*)와 COUNT(열)을 구분했습니다.

---

# 3. GROUP BY와 HAVING
## 3-1. 그룹 단위 먼저 정하기
“저자별 도서 수와 총 재고”에서 결과 한 행은 저자 한 명입니다. SQL을 쓰기 전에 그룹 키를 정합니다.

```text
그룹 1: 김데이터의 책 3행 → count 3, stock sum 9
그룹 2: 이노드의 책 1행 → count 1, stock sum 1
```

## 3-2. 기준 GROUP BY
```sql
SELECT
  authors.name AS author,
  COUNT(books.id) AS book_count,
  SUM(books.stock) AS total_stock
FROM authors
LEFT JOIN books ON books.author_id = authors.id
GROUP BY authors.id, authors.name
ORDER BY book_count DESC;
```

### 왜 authors.id와 name을 함께 그룹화하는가

저자 이름이 같을 수 있는 현실 모델에서도 ID가 그룹 식별자입니다. name은 출력에 필요합니다. SQLite가 느슨하게 허용하는 GROUP BY 표현에 의존하지 않고, 집계하지 않은 출력 열을 그룹 기준에 명확히 둡니다.

### 왜 LEFT JOIN인가

도서가 없는 저자도 0권으로 보고하려는 질문이라면 모든 저자를 유지합니다. INNER JOIN이면 도서 없는 저자가 사라집니다.

### 왜 COUNT(books.id)인가

LEFT JOIN의 도서 없는 저자도 NULL 확장 행 하나를 가지므로 `COUNT(*)`는 1로 셀 수 있습니다. `COUNT(books.id)`는 NULL을 세지 않아 0이 됩니다.

## 3-3. NULL SUM 다루기
도서 없는 저자의 `SUM(books.stock)`은 NULL일 수 있습니다. 0으로 표시하려면:

```sql
COALESCE(SUM(books.stock), 0) AS total_stock
```

NULL과 0의 업무 의미가 같을 때만 변환합니다.

## 3-4. WHERE와 HAVING
```sql
SELECT author_id, COUNT(*) AS book_count
FROM books
WHERE stock > 0
GROUP BY author_id
HAVING COUNT(*) >= 2;
```

- WHERE: 그룹 전에 개별 책 행을 거릅니다.
- HAVING: 그룹 뒤 집계 결과를 거릅니다.

“재고가 있는 책만 대상으로, 책이 두 권 이상인 저자”라는 질문입니다.

## 3-5. 안내 실습 A — 출판 연도별 집계
```sql
SELECT
  published_year,
  COUNT(*) AS book_count,
  AVG(stock) AS average_stock,
  SUM(stock) AS total_stock
FROM books
GROUP BY published_year
ORDER BY published_year DESC;
```

현재는 연도마다 한 권이라 평균과 재고가 같습니다. 같은 연도 책을 하나 추가해 그룹에 여러 행이 있을 때 다시 확인합니다.

## 3-6. 안내 실습 B — 대출 상태별 집계
```sql
SELECT
  CASE
    WHEN returned_at IS NULL THEN 'active'
    ELSE 'returned'
  END AS status,
  COUNT(*) AS loan_count
FROM loans
GROUP BY status
ORDER BY status;
```

저장 열이 없는 표시용 status 표현을 그룹 키로 사용합니다. 기준 데이터는 각 상태 1건입니다.

### 3단원 확인
- [ ] 결과 한 행의 그룹 단위를 먼저 정의했습니다.
- [ ] LEFT JOIN에서 COUNT(*)와 COUNT(id) 차이를 설명했습니다.
- [ ] WHERE와 HAVING의 처리 시점을 구분했습니다.
- [ ] 연도별 또는 상태별 집계를 실행했습니다.

---

# 4. 안전한 UPDATE와 DELETE
## 4-1. 변경 안전 루프
모든 변경은 다음 절차를 사용합니다.

```text
업무 의도
  → WHERE 조건 작성
  → 같은 WHERE로 SELECT
  → 예상 건수 기록
  → UPDATE/DELETE
  → result.changes 확인
  → 같은 식별자로 사후 SELECT
```

WHERE가 있다는 사실만으로 안전하지 않습니다. 잘못된 WHERE도 여러 행과 일치할 수 있습니다.

## 4-2. email UPDATE
기준 코드:

```js
const updateEmail = database.prepare(`
  UPDATE members
  SET email = ?
  WHERE id = ?
`)

const emailResult = updateEmail.run("minji.new@example.com", 1)
console.log(`회원 email 수정: ${emailResult.changes}건`)
```

### 사전 SELECT 추가

```js
const memberBefore = database
  .prepare("SELECT id, name, email FROM members WHERE id = ?")
  .get(1)

console.log("수정 전", memberBefore)
```

### 사후 SELECT 추가

```js
const memberAfter = database
  .prepare("SELECT id, name, email FROM members WHERE id = ?")
  .get(1)

console.log("수정 후", memberAfter)
```

예상 changes는 1입니다.

## 4-3. changes 0과 동일 값
없는 ID 999를 수정하면 changes는 0입니다.

```js
updateEmail.run("nobody@example.com", 999)
```

SQLite의 변경 카운트 동작은 설정과 실제 쓰기 방식에 따라 동일 값 대입을 변경으로 셀 수 있는 등 제품/API 차이가 있을 수 있습니다. 카운트는 사전·사후 조회 결과와 함께 확인합니다.

## 4-4. 반납 완료 대출 DELETE
```js
const targets = database
  .prepare(`
    SELECT id, member_id, book_id, returned_at
    FROM loans
    WHERE returned_at IS NOT NULL
  `)
  .all()
```

기준에서는 1건입니다.

```js
const deleteReturnedLoans = database.prepare(`
  DELETE FROM loans
  WHERE returned_at IS NOT NULL
`)

const deleteResult = deleteReturnedLoans.run()
console.log(deleteResult.changes)
```

삭제 후 같은 조건 조회 결과가 0건인지 확인합니다.

## 4-5. WHERE 없는 변경 사고 실험
실제로 기준 코드에 실행하지 않고 결과를 예측합니다.

```sql
UPDATE members SET email = 'same@example.com';
```

첫 행 이후 두 번째 행에서 UNIQUE 오류가 날 수 있고, statement 전체 동작을 제품 규칙과 transaction 맥락에서 확인해야 합니다.

```sql
DELETE FROM loans;
```

모든 대출 기록을 삭제합니다. 예제 초기화라 해도 의도와 범위를 명시합니다.

## 4-6. soft delete 토론
대출 기록은 감사와 이력에 중요하므로 반납 완료라고 물리 삭제하는 것이 실제 업무에 적절한지 토론합니다.

대안:

- `returned_at`을 유지하고 조회에서 상태로 구분
- 보존 기간 뒤 archive 테이블로 이동
- `deleted_at`을 두는 soft delete

현재 코드는 DELETE 동작만 확인하는 예입니다. 기술 기능을 쓸 수 있다는 것과 업무에서 써야 한다는 것은 다릅니다.

### 4단원 확인
- [ ] UPDATE 전후 한 회원을 조회했습니다.
- [ ] changes와 사후 상태를 함께 확인했습니다.
- [ ] DELETE 대상을 먼저 목록과 건수로 확인했습니다.
- [ ] 기록 보존 요구에 따라 삭제 정책이 달라짐을 설명했습니다.

---

# 5. 트랜잭션과 대출 처리
## 5-1. 일부 성공 상태
대출에는 두 변경이 필요합니다.

1. `books.stock`을 1 감소
2. `loans`에 대출 행 생성

가능한 잘못된 상태:

- stock만 감소하고 loan 없음: 책은 사라졌지만 누가 빌렸는지 모름
- loan만 생성하고 stock 유지: 실제보다 대출 가능 재고가 많아 보임

둘을 하나의 업무 작업으로 묶어야 합니다.

## 5-2. BEGIN, COMMIT, ROLLBACK
```js
database.exec("BEGIN")

try {
  // 관련 변경
  database.exec("COMMIT")
} catch (error) {
  database.exec("ROLLBACK")
}
```

- BEGIN: transaction 시작
- COMMIT: 모든 변경 확정
- ROLLBACK: transaction 시작 뒤 변경 취소

COMMIT 뒤에는 같은 transaction을 rollback할 수 없습니다. 성공/실패 경로가 정확히 한 번 종료되게 합니다.

## 5-3. 조건부 재고 감소
```sql
UPDATE books
SET stock = stock - 1
WHERE id = ? AND stock > 0
```

`SELECT stock` 후 JavaScript에서 감소 가능 여부를 검사하는 대신, 조건과 변경을 한 SQL statement에 둡니다.

```js
const stockResult = database
  .prepare(sql)
  .run(bookId)

if (stockResult.changes !== 1) {
  throw new Error("대출 가능한 재고가 없습니다.")
}
```

changes 0의 가능한 원인:

- book ID가 없음
- book은 있지만 stock 0

사용자 메시지를 구분하려면 추가 조회할 수 있지만, 대출을 계속 진행하면 안 된다는 결론은 같습니다.

## 5-4. 대출 행 생성과 COMMIT
```js
database
  .prepare("INSERT INTO loans (member_id, book_id) VALUES (?, ?)")
  .run(memberId, bookId)

database.exec("COMMIT")
```

member ID가 없으면 외래 키 오류가 발생합니다. 이때 앞에서 성공한 재고 감소도 ROLLBACK되어야 합니다.

## 5-5. 성공 경로 추적
기준 호출:

```js
checkoutBook(2, 1)
```

실행 전:

- book 1 stock: 3
- active loan: 김민지의 book 2 한 건

실행 후:

- book 1 stock: 2
- 이준호의 book 1 active loan 추가
- COMMIT

## 5-6. 실패 주입
### 없는 회원

```js
checkoutBook(999, 1)
```

재고 감소는 먼저 성공할 수 있지만 loan INSERT의 FK 오류로 catch에 들어갑니다. ROLLBACK 후 book 1 재고가 원래 값인지 확인합니다.

### 없는 책

```js
checkoutBook(1, 999)
```

재고 UPDATE changes 0에서 직접 오류를 던지고 ROLLBACK합니다.

### 재고 0 책

임시로 stock 0인 책을 추가하거나 기존 책 재고를 0으로 만든 뒤 호출합니다. loan 행이 추가되지 않았는지 확인합니다.

### 5단원 확인
- [ ] transaction이 막는 두 가지 부분 성공 상태를 설명했습니다.
- [ ] 조건부 UPDATE와 changes 검사 흐름을 설명했습니다.
- [ ] 성공 호출 뒤 재고와 loan을 모두 확인했습니다.
- [ ] FK 실패 뒤 재고가 rollback된 것을 조회했습니다.

---

# 6. ACID, 반납 transaction, 종합 점검
## 6-1. ACID를 현재 단계 코드에 연결
### Atomicity — 원자성

재고 감소와 loan 생성이 모두 반영되거나 모두 취소됩니다.

### Consistency — 일관성

CHECK, FK와 업무 조건을 만족하는 상태에서 다음 유효한 상태로 이동합니다. transaction 안에서 `stock = 999`로 잘못 바꾸고 COMMIT하면 업무 오류는 그대로 반영될 수 있습니다. 올바른 로직은 개발자의 책임입니다.

### Isolation — 격리성

동시에 두 대출이 실행될 때 서로의 중간 변경이 어떻게 보일지 다룹니다. SQLite의 locking과 transaction 모드는 별도 심화 주제이며, 조건부 UPDATE로 재고 음수를 막는 동작을 확인합니다.

### Durability — 지속성

COMMIT된 결과는 연결을 닫고 다시 열어도 데이터베이스 파일에 남아야 합니다. 단, 현재 단계 코드는 다음 `npm start`에서 같은 상태를 재현하려고 파일을 초기화합니다.

## 6-2. 반납 요구사항 분석
반납에는 두 변경이 필요합니다.

1. active loan의 `returned_at`을 현재 시각으로 설정
2. 해당 book stock을 1 증가

추가 규칙:

- 이미 반납된 loan은 다시 반납할 수 없습니다.
- 존재하지 않는 loan은 처리하지 않습니다.
- 둘 중 하나가 실패하면 모두 취소합니다.

## 6-3. 반납 transaction 예시
```js
function returnBook(loanId) {
  database.exec("BEGIN")

  try {
    const loan = database
      .prepare(`
        SELECT id, book_id
        FROM loans
        WHERE id = ? AND returned_at IS NULL
      `)
      .get(loanId)

    if (!loan) {
      throw new Error("반납 가능한 대출이 없습니다.")
    }

    const returnResult = database
      .prepare(`
        UPDATE loans
        SET returned_at = CURRENT_TIMESTAMP
        WHERE id = ? AND returned_at IS NULL
      `)
      .run(loanId)

    if (returnResult.changes !== 1) {
      throw new Error("대출 상태를 변경하지 못했습니다.")
    }

    const stockResult = database
      .prepare(`
        UPDATE books
        SET stock = stock + 1
        WHERE id = ?
      `)
      .run(loan.book_id)

    if (stockResult.changes !== 1) {
      throw new Error("도서 재고를 변경하지 못했습니다.")
    }

    database.exec("COMMIT")
  } catch (error) {
    database.exec("ROLLBACK")
    console.log(`반납 취소: ${error.message}`)
  }
}
```

조회와 UPDATE 모두 `returned_at IS NULL` 조건을 사용합니다. 동시 반납 시도에서도 UPDATE changes를 다시 확인합니다.

## 6-4. 독립 종합 쿼리
다음 보고서 중 하나를 작성합니다.

### A. 현재 대출 회원별 현황

결과 한 행: 회원 한 명

- 회원 이름
- 현재 대출 수
- 현재 대출 도서의 총 재고
- 대출 0인 회원 포함

### B. 저자별 재고 보고서

결과 한 행: 저자 한 명

- 저자 이름
- 도서 수
- 총 재고
- 평균 재고
- 총 재고 3 이상만 표시

### C. 출판 연도별 도서 현황

결과 한 행: 출판 연도

- 도서 수, 최소/최대/평균 재고
- 최신 연도부터 정렬

## 6-5. 마무리 확인
1. WHERE와 HAVING은 각각 어느 단계의 행을 거르는가?
2. UPDATE changes 0일 때 확인할 두 가지는?
3. rollback됐음을 증명하려면 어떤 두 테이블을 조회해야 하는가?

---

# 7. 기준 코드 실행 순서와 예상 상태

`npm start` 한 번 안에서도 여러 변경이 순서대로 일어납니다. 최종 출력만 보고 초기 상태로 오해하지 않도록 타임라인을 추적합니다.

| 순서 | 작업 | members | loans | book 1 stock |
| ---: | --- | --- | --- | ---: |
| 1 | seed INSERT | 2명 | active 1 + returned 1 | 3 |
| 2 | 조건 조회·집계 | 변화 없음 | 변화 없음 | 3 |
| 3 | 김민지 email 수정 | email 변경 | 변화 없음 | 3 |
| 4 | 반납 완료 loan 삭제 | 변화 없음 | active 1만 남음 | 3 |
| 5 | 이준호가 book 1 대출 | 변화 없음 | active 2 | 2 |

기준 실행의 “변경 후 현재 대출”에는 김민지의 SQL 첫걸음과 이준호의 데이터를 배우는 시간이 나옵니다.

## 7-1. seed를 SQL literal로 넣는 이유

step-3은 조회·조작에 집중하기 위해 여러 기준 행을 한 `database.exec()`에 준비합니다. 실제 사용자 입력을 SQL literal로 연결하라는 뜻이 아닙니다. 동적 입력은 계속 플레이스홀더로 전달합니다.

## 7-2. published_year 추가

Step 2 books에 `published_year INTEGER NOT NULL`이 추가됐습니다. 정렬·범위·그룹 실습을 위한 새 속성입니다.

## 7-3. 함수 경계

`checkoutBook(memberId, bookId)`가 transaction의 시작과 종료를 모두 책임집니다. 호출자가 중간 SQL을 따로 실행하지 않게 업무 단위를 함수로 묶습니다.

---

# 8. 추가 SQL 예제

## 예제 A. 재고 구간 분류

```sql
SELECT
  title,
  stock,
  CASE
    WHEN stock = 0 THEN 'out'
    WHEN stock <= 2 THEN 'low'
    ELSE 'enough'
  END AS stock_status
FROM books
ORDER BY stock, title;
```

## 예제 B. 대출 기간 계산 토론

SQLite 날짜 함수를 사용해 반납 완료 대출의 기간을 계산할 수 있습니다.

```sql
SELECT
  id,
  loaned_at,
  returned_at,
  julianday(returned_at) - julianday(loaned_at) AS loan_days
FROM loans
WHERE returned_at IS NOT NULL;
```

시간대와 반올림 규칙이 업무 요구에 맞는지 별도 확인합니다.

## 예제 C. correlated subquery 대신 JOIN 집계 비교

```sql
SELECT
  authors.name,
  (
    SELECT COUNT(*)
    FROM books
    WHERE books.author_id = authors.id
  ) AS book_count
FROM authors;
```

같은 결과를 JOIN+GROUP BY로도 만들 수 있습니다. 두 쿼리의 가독성을 비교하고 실제 성능은 실행 계획과 데이터 규모로 검증합니다.

## 예제 D. EXISTS

```sql
SELECT members.id, members.name
FROM members
WHERE EXISTS (
  SELECT 1
  FROM loans
  WHERE loans.member_id = members.id
    AND loans.returned_at IS NULL
);
```

현재 대출이 하나 이상 있는 회원을 찾습니다. 존재 여부만 필요할 때 유용합니다.

## 예제 E. 안전한 재고 일괄 표시

```sql
SELECT id, title, stock
FROM books
WHERE stock <= 1;
```

검증 후:

```sql
UPDATE books
SET stock = stock + 1
WHERE stock <= 1;
```

여러 행 변경 요구라면 대상 건수와 샘플을 먼저 출력하고 changes가 예상과 같은지 확인합니다.

---

# 9. 연습 문제

## 조회 기초

1. 제목에 `데이터`가 포함된 책을 제목순으로 찾습니다.
2. 2024~2026년 출판 도서를 최신순으로 찾습니다.
3. stock 2 이상이면서 김데이터 저자인 책을 JOIN으로 찾습니다.
4. 반납되지 않은 대출과 반납된 대출을 각각 조회합니다.
5. 재고가 가장 많은 책 두 권을 안정적인 순서로 찾습니다.

## 집계

6. 전체 책 수, 총 재고, 평균 재고를 구합니다.
7. 저자별 도서 수와 총 재고를 도서 없는 저자까지 포함해 구합니다.
8. 출판 연도별 평균 재고를 구합니다.
9. 현재 대출 수가 1건 이상인 회원만 HAVING으로 찾습니다.
10. COUNT(*)와 COUNT(returned_at) 결과 차이를 설명합니다.

## 변경과 transaction

11. email UPDATE 전에 대상을 출력하고 사후 값을 검증합니다.
12. 반납 완료 DELETE 전에 건수를 예상하고 삭제 뒤 0건인지 확인합니다.
13. stock 0 책 대출 실패에서 loan 수와 stock이 그대로인지 검증합니다.
14. 없는 member ID로 대출해 FK 실패와 rollback을 확인합니다.
15. `returnBook()`을 구현하고 같은 loan을 두 번 반납해 두 번째가 실패하는지 확인합니다.

## 도전

16. 회원별 전체 대출 수와 현재 대출 수를 한 결과에 표시합니다.
17. 저자별 최근 출판 연도와 총 재고를 표시합니다.
18. 재고 1 이하 도서에 보충 표시 열을 추가하는 UPDATE를 설계합니다.
19. 대출과 반납을 동시에 실행할 때 발생할 수 있는 경쟁을 설명합니다.
20. transaction 안에서 예외 후 ROLLBACK 자체도 실패할 가능성을 고려한 정리 구조를 조사합니다.

<details>
<summary>힌트</summary>

- 제목 검색: `WHERE title LIKE ?`, 값 `%데이터%`
- 저자 조건: books와 authors JOIN 후 `authors.id` 또는 name 조건
- 현재 대출 수: `COUNT(CASE WHEN returned_at IS NULL THEN 1 END)` 또는 조건 집계 방식 검토
- HAVING은 그룹 뒤 집계값에 사용합니다.
- rollback 검증은 `books.stock`과 `loans` 행 수를 둘 다 조회합니다.
- 반납은 active loan 확인, returned_at UPDATE, stock 증가를 transaction으로 묶습니다.

</details>

---

# 10. 자주 만나는 문제와 진단

## `misuse of aggregate` 오류

집계 함수를 WHERE에 사용하지 않았는지 확인합니다. 그룹 결과 조건은 HAVING을 사용합니다.

## GROUP BY 결과가 이상합니다

- 결과 한 행이 무엇인지 먼저 정의합니다.
- SELECT의 집계하지 않은 열이 GROUP BY에 있는지 확인합니다.
- JOIN으로 입력 행이 예상보다 늘지 않았는지 중간 결과를 봅니다.
- LEFT JOIN에서 COUNT(*) 대신 COUNT(right.id)가 필요한지 봅니다.

## SUM이 NULL입니다

입력 행이 없거나 모두 NULL일 수 있습니다. 업무상 0과 같은 의미라면 `COALESCE(SUM(...), 0)`를 사용합니다.

## LIKE 결과가 너무 많거나 적습니다

`%` 위치, 대소문자/collation, 실제 title 값을 확인합니다. 값은 플레이스홀더로 전달합니다.

## changes가 0입니다

같은 WHERE SELECT가 0건인지, 조건 값 타입과 ID가 맞는지 확인합니다. 조건부 재고 감소라면 책 없음과 stock 0을 구분합니다.

## transaction이 이미 시작됐다는 오류

모든 성공 경로에 COMMIT, 모든 실패 경로에 ROLLBACK이 있는지 확인합니다. transaction 함수 안에서 transaction 함수를 다시 호출하지 않았는지도 봅니다.

## ROLLBACK할 transaction이 없다고 나옵니다

BEGIN 전에 오류가 났거나 이미 COMMIT/ROLLBACK한 뒤 다시 종료했을 수 있습니다. transaction 시작 여부와 try 범위를 점검합니다.

## 실패했는데 stock이 줄었습니다

- BEGIN이 재고 UPDATE 전에 실행됐는지 확인합니다.
- catch에서 ROLLBACK이 실제 호출됐는지 확인합니다.
- 실패 실험 뒤 다른 성공 호출이 stock을 바꾸지 않았는지 타임라인을 분리합니다.
- 같은 book ID의 전후 값을 바로 조회합니다.

## DELETE한 기록이 다음 실행에서 돌아옵니다

매 `npm start`가 단계 파일을 초기화하고 seed를 다시 넣기 때문입니다. transaction의 지속성 실패가 아닙니다.

---

# 11. RDBMS 종합 점검

## A. 모델과 쿼리

1. authors-books와 members-loans-books 관계를 그려 PK/FK를 표시합니다.
2. 재고 2 이상인 책의 제목·저자·재고를 최신 출판 연도순으로 조회합니다.
3. 저자별 도서 수와 총 재고를 도서 없는 저자까지 표시합니다.

## B. 변경 안전성

4. member ID 2의 email을 바꾸는 사전 SELECT, UPDATE, 사후 SELECT를 작성합니다.
5. 반납 완료 대출을 삭제하기 전후 확인 절차와 changes 검사를 적습니다.

## C. 트랜잭션

6. 대출 처리의 두 변경과 부분 성공 문제를 설명합니다.
7. stock 0 또는 없는 member에서 rollback 후 확인할 상태를 적습니다.
8. 반납 transaction의 단계와 실패 조건을 의사코드로 작성합니다.

## D. 설명

9. WHERE와 HAVING 차이를 예로 설명합니다.
10. transaction이 잘못된 업무 로직을 자동으로 고치지 못하는 이유를 설명합니다.

<details>
<summary>확인 기준</summary>

- SQL 문법만 아니라 결과 행 단위와 예상 건수를 설명해야 합니다.
- LEFT JOIN 집계는 COUNT(right.id)와 NULL SUM 처리를 고려합니다.
- UPDATE/DELETE는 같은 조건의 사전 조회와 사후 검증이 있어야 합니다.
- transaction 답안에는 BEGIN, 성공 COMMIT, 실패 ROLLBACK이 모두 있어야 합니다.
- rollback 증거로 books와 loans 두 상태를 확인해야 합니다.

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
git commit -m "Complete database step 3"
git push
git status --short --branch
```

`main`과 `origin/main`이 같은 commit을 가리키고 작업 파일 목록이 비어 있으면 마쳤습니다.

# 12. 완료 기준

- [ ] 기준 데이터의 행과 최종 변화 타임라인을 설명했습니다.
- [ ] WHERE에서 비교·논리·NULL·LIKE 조건을 사용했습니다.
- [ ] 다중 ORDER BY와 LIMIT의 결과를 예측했습니다.
- [ ] COUNT/SUM/AVG/MIN/MAX를 전체 데이터에 적용했습니다.
- [ ] GROUP BY 결과 한 행의 단위를 설명했습니다.
- [ ] LEFT JOIN 집계에서 COUNT(*)와 COUNT(id)를 구분했습니다.
- [ ] WHERE와 HAVING을 구분했습니다.
- [ ] UPDATE 전후 같은 ID를 조회하고 changes를 확인했습니다.
- [ ] DELETE 대상과 건수를 실행 전에 확인했습니다.
- [ ] 성공 대출에서 stock 감소와 loan 생성을 모두 확인했습니다.
- [ ] 실패 대출에서 두 변경이 rollback된 것을 확인했습니다.
- [ ] ACID를 현재 단계 대출 사례에 연결해 설명했습니다.
- [ ] 반납 transaction을 구현하거나 상세 의사코드로 작성했습니다.
- [ ] 종합 점검의 답을 실행 결과와 비교했습니다.

## 다시 확인할 항목

1. 조건+정렬 SELECT 한 개
2. 저자별 LEFT JOIN 집계 한 개
3. email UPDATE의 사전/사후 검증
4. 반납 완료 DELETE의 대상/changes 검증
5. 성공·실패 checkoutBook 후 books/loans 조회

## 추가 연습

1. 현재 대출 회원별 집계 보고서
2. 반납 transaction 실제 구현과 중복 반납 테스트
3. 물리적 copy 모델의 대출 transaction 설계
4. `EXPLAIN QUERY PLAN`으로 조회 계획 관찰
5. SQLite transaction mode와 동시 쓰기 실험 설계

## 적용 질문

관계형 모델은 데이터를 나누고 외래 키와 transaction으로 일관성을 지킵니다. 같은 도서 데이터를 MongoDB의 중첩 문서로 저장할 때 달라지는 책임을 비교합니다.

> SQL에서 책·저자·재고를 여러 테이블과 열로 다뤘다. 도서 상세 화면에서 항상 함께 읽는 값들을 한 문서에 넣으면 무엇이 단순해지고, 무엇이 새 책임이 될까?
