# 02. SQL과 관계

요구사항을 테이블 관계로 바꾸고 데이터를 조회·변경합니다.

## 1. SQL은 무엇을 표현하는가

SQL(Structured Query Language)은 관계형 데이터베이스의 구조와 데이터를 정의하고 조회하고 변경하는 언어입니다. JavaScript처럼 “첫 번째 행부터 반복하면서 조건을 검사하라”는 절차를 세세히 쓰기보다, 원하는 결과를 선언하는 방식이 중심입니다.

```sql
SELECT title, stock
FROM books
WHERE stock >= 2
ORDER BY title;
```

이 문장은 다음 요구를 표현합니다.

- 대상 테이블은 `books`입니다.
- 결과에 `title`, `stock`만 필요합니다.
- 재고가 2 이상인 행만 필요합니다.
- 제목 순으로 정렬합니다.

DBMS는 전체 테이블을 읽을지, 인덱스를 사용할지 같은 실행 방법을 결정합니다.

## 2. SQL 문장의 큰 분류

| 분류 | 목적 | 대표 명령 |
| --- | --- | --- |
| DDL | 구조 정의 | `CREATE`, `ALTER`, `DROP` |
| DML | 데이터 생성·변경·삭제 | `INSERT`, `UPDATE`, `DELETE` |
| Query | 데이터 조회 | `SELECT` |
| TCL | 트랜잭션 제어 | `BEGIN`, `COMMIT`, `ROLLBACK` |
| DCL | 권한 제어 | `GRANT`, `REVOKE` |

제품이나 교재에 따라 `SELECT`를 DML에 포함하기도 합니다. 각 문장이 스키마를 바꾸는지, 행을 읽는지, 현재 상태를 변경하는지 구분합니다.

## 3. SQL 읽는 순서와 논리 처리 순서

SQL은 보통 다음 순서로 작성합니다.

```sql
SELECT authors.name, COUNT(books.id) AS book_count
FROM authors
LEFT JOIN books ON books.author_id = authors.id
WHERE authors.name LIKE '김%'
GROUP BY authors.id, authors.name
HAVING COUNT(books.id) >= 2
ORDER BY book_count DESC
LIMIT 10;
```

개념적으로 결과를 만드는 순서는 작성 순서와 다릅니다.

```text
FROM/JOIN
  → WHERE
  → GROUP BY
  → HAVING
  → SELECT
  → ORDER BY
  → LIMIT
```

이 순서를 알면 `WHERE`에서 아직 만들어지지 않은 집계 별칭을 바로 쓰기 어려운 이유, `WHERE`와 `HAVING`의 역할 차이를 이해하는 데 도움이 됩니다.

## 4. 요구사항에서 엔터티 찾기

다음 문장을 읽어봅니다.

> 회원은 여러 도서를 빌릴 수 있다. 한 도서는 여러 시점에 여러 회원에게 대출될 수 있다. 각 대출에는 대출 시각과 반납 시각이 있다.

명사와 사건을 찾으면 후보 엔터티가 보입니다.

- 회원: `members`
- 도서: `books`
- 대출이라는 사건: `loans`

대출은 단순 연결선이 아니라 `loaned_at`, `returned_at`이라는 자기 속성을 가진 행입니다.

```text
members 1 ─── N loans N ─── 1 books
```

회원과 도서는 전체 기간으로 보면 N:M 관계이고, `loans`가 이를 두 개의 1:N 관계로 풀어냅니다.

## 5. 키를 구분하기

### super 키와 candidate 키

- super 키: 행을 고유하게 구분할 수 있는 속성의 집합
- candidate 키: 불필요한 속성을 뺀 최소 super 키

회원 테이블에서 `id`, `email`이 각각 고유하다면 둘 다 candidate 키가 될 수 있습니다.

### 기본 키와 alternate 키

candidate 키 중 대표로 선택한 것이 기본 키이고, 선택되지 않은 고유 키는 alternate 키라고 볼 수 있습니다. `id`를 PK로 선택하고 `email`에는 `UNIQUE`를 둘 수 있습니다.

### 외래 키

다른 테이블의 candidate/기본 키를 가리키는 열입니다.

```sql
author_id INTEGER NOT NULL,
FOREIGN KEY (author_id) REFERENCES authors(id)
```

외래 키는 단지 이름이 `_id`로 끝난다고 생기지 않습니다. `FOREIGN KEY ... REFERENCES ...` 제약을 정의하고 SQLite 연결에서 검사를 켜야 DBMS가 참조 무결성을 확인합니다.

### 복합키

두 개 이상의 열이 함께 행을 구분할 수도 있습니다.

```sql
PRIMARY KEY (student_id, course_id)
```

같은 학생이 같은 강좌를 한 번만 수강할 수 있다는 규칙을 표현합니다. 별도 `id`를 PK로 쓰더라도 `(student_id, course_id)`에 `UNIQUE`를 두어 같은 규칙을 표현할 수 있습니다.

## 6. 관계의 종류

### 1:1

회원 한 명당 하나의 상세 프로필만 있다면 1:1입니다. 실제로는 분리 이유가 보안, 선택 필드, 생명주기 차이인지 확인해야 합니다.

```text
members 1 ─── 1 member_profiles
```

### 1:N

저자 한 명이 여러 도서를 쓸 수 있고, 현재 모델에서 한 도서는 대표 저자 한 명을 가집니다.

```text
authors 1 ─── N books
```

N 쪽인 `books`가 `author_id` 외래 키를 가집니다.

### N:M

주문 하나에 여러 상품이 있고 상품 하나가 여러 주문에 등장할 수 있습니다.

```text
orders 1 ─── N order_items N ─── 1 products
```

`order_items`에는 연결 키뿐 아니라 주문 당시 수량과 단가를 저장할 수 있습니다.

```text
order_items(order_id, product_id, quantity, unit_price)
```

## 7. 중복과 이상 현상

도서와 저자를 한 테이블에 저장하면 다음처럼 저자 정보가 반복됩니다.

```text
+---------+----------------------+----------+----------------------+
| book_id | title                | author   | author_email         |
+---------+----------------------+----------+----------------------+
| 1       | 데이터를 배우는 시간 | 김데이터 | data@example.com     |
| 2       | SQL 첫걸음           | 김데이터 | data@example.com     |
+---------+----------------------+----------+----------------------+
```

### 수정 이상

저자 email이 바뀌면 모든 도서 행을 빠짐없이 수정해야 합니다. 한 행만 이전 값으로 남으면 같은 저자에 두 email이 생깁니다.

### 삽입 이상

아직 책을 쓰지 않은 저자를 등록하려면 도서 열에 NULL을 허용하거나 가짜 도서를 만들어야 합니다.

### 삭제 이상

저자의 마지막 도서를 삭제했더니 저자 연락처까지 함께 사라질 수 있습니다.

## 8. 정규화의 직관

정규화는 모든 데이터를 무조건 잘게 쪼개는 규칙이 아니라, 종속성과 중복으로 인한 이상을 줄이도록 관계를 구성하는 과정입니다.

### 제1정규형(1NF)

한 cell에 반복 그룹을 넣지 않고 원자적인 값으로 다룹니다.

나쁜 예:

```text
book.authors = "김데이터, 이노드"
```

관계형 설계에서는 저자 테이블과 도서-저자 연결 테이블로 나누는 방식을 검토합니다.

### 제2정규형(2NF)

복합키 일부에만 의존하는 속성을 분리합니다. `(order_id, product_id)`가 키인 주문 항목에서 `product_name`이 오직 `product_id`에만 의존한다면 상품 테이블로 분리할 수 있습니다.

### 제3정규형(3NF)

키가 아닌 속성이 또 다른 키가 아닌 속성을 결정하는 전이 종속을 줄입니다. 회원 테이블의 `postal_code`가 `city`를 결정한다면 주소 정책에 따라 별도 구조를 검토합니다.

정규형을 수학적으로 증명하기보다 “이 사실은 어느 대상에 속하는가?”, “한 곳만 바꿔도 일관성이 유지되는가?”를 확인합니다.

## 9. 제약조건과 참조 동작

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

이 스키마는 다음 규칙을 데이터베이스에 둡니다.

- 모든 도서는 ISBN과 제목이 있어야 합니다.
- ISBN은 중복될 수 없습니다.
- 저자는 실제 `authors.id`여야 합니다.
- 재고는 음수가 될 수 없습니다.

외래 키가 가리키는 부모 행을 삭제할 때의 정책도 설계 대상입니다.

- `RESTRICT`/`NO ACTION`: 참조 중이면 삭제 거부
- `CASCADE`: 부모 삭제 시 자식도 삭제
- `SET NULL`: 자식 외래 키를 NULL로 변경

대출 기록처럼 감사 이력이 중요한 데이터에 무조건 `CASCADE`를 사용하면 기록까지 사라질 수 있습니다. 편리함보다 업무 의미를 먼저 봅니다.

## 10. INSERT와 prepared statement

```sql
INSERT INTO members (name, email)
VALUES (?, ?)
```

```js
const statement = database.prepare(sql)
const result = statement.run("김민지", "minji@example.com")
```

값을 SQL 문자열에 직접 이어 붙이지 않습니다.

```js
// 피해야 할 예
database.exec(`SELECT * FROM members WHERE email = '${email}'`)
```

문자열 연결은 따옴표가 포함된 정상 값도 깨뜨릴 수 있고, 입력이 SQL 구조로 해석되는 SQL injection 위험을 만듭니다. 플레이스홀더와 바인딩은 SQL 구조와 데이터를 분리합니다.

## 11. JOIN을 행의 연결로 이해하기

### INNER JOIN

양쪽에 연결되는 행이 있을 때만 결과에 남습니다.

```sql
SELECT books.title, authors.name AS author
FROM books
JOIN authors ON authors.id = books.author_id;
```

각 `books` 행의 `author_id`와 같은 `authors.id`를 찾아 한 결과 행을 만듭니다.

### LEFT JOIN

왼쪽 테이블의 모든 행을 유지합니다.

```sql
SELECT authors.name, books.title
FROM authors
LEFT JOIN books ON books.author_id = authors.id;
```

도서가 없는 저자도 결과에 남고 `books.title`은 NULL이 됩니다.

### ON과 WHERE 차이

`ON`은 어떤 행을 연결할지 정의하고 `WHERE`는 연결 결과에서 남길 행을 고릅니다. 특히 LEFT JOIN 오른쪽 조건을 WHERE에 두면 NULL 행이 제거되어 사실상 INNER JOIN처럼 보일 수 있습니다.

```sql
-- 도서가 없어도 저자를 남기고, 재고가 있는 도서만 연결
SELECT authors.name, books.title
FROM authors
LEFT JOIN books
  ON books.author_id = authors.id
 AND books.stock > 0;
```

### 다중 JOIN

```sql
SELECT members.name, books.title, loans.loaned_at
FROM loans
JOIN members ON members.id = loans.member_id
JOIN books ON books.id = loans.book_id
WHERE loans.returned_at IS NULL;
```

결과의 기준 행은 `loans` 한 건입니다. 회원 한 명 또는 도서 한 권이 아니라 “한 번의 대출 사건”이 한 결과 행이 됩니다.

## 12. 집계의 기본

```sql
SELECT
  authors.name,
  COUNT(books.id) AS book_count,
  SUM(books.stock) AS total_stock
FROM authors
LEFT JOIN books ON books.author_id = authors.id
GROUP BY authors.id, authors.name;
```

`GROUP BY`는 여러 입력 행을 그룹별 한 결과 행으로 줄입니다.

- `COUNT(*)`: 그룹의 결과 행 수를 셉니다. LEFT JOIN의 NULL 확장 행도 셀 수 있습니다.
- `COUNT(books.id)`: NULL이 아닌 도서 ID만 세므로 도서가 없는 저자는 0이 됩니다.
- `SUM(books.stock)`: 그룹의 재고 합계입니다.

집계 결과를 읽을 때는 “한 결과 행이 무엇을 나타내는가?”를 먼저 답합니다. 위 결과 한 행은 저자 한 명입니다.

## 13. 안전한 UPDATE와 DELETE

```sql
UPDATE members
SET email = ?
WHERE id = ?;
```

실행 전에 같은 WHERE로 조회합니다.

```sql
SELECT id, name, email
FROM members
WHERE id = ?;
```

실행 후에는 영향받은 행 수와 새 값을 확인합니다.

```js
const result = updateStatement.run(newEmail, memberId)
console.log(result.changes)
```

`WHERE`를 생략하면 모든 행이 대상이 됩니다. 일부 DB 도구의 안전 모드에 의존하지 말고 코드와 검증 절차로 범위를 명확히 합니다.

삭제도 같은 다섯 단계를 사용합니다.

```text
조건 작성 → 대상 SELECT → 예상 건수 기록 → DELETE → changes와 사후 SELECT
```

## 14. 트랜잭션과 ACID

도서 대출은 두 변경으로 구성됩니다.

1. 재고를 1 줄입니다.
2. 대출 기록을 만듭니다.

하나만 성공하면 잘못된 상태입니다. 트랜잭션은 관련 변경을 한 단위로 묶습니다.

```sql
BEGIN;
UPDATE books SET stock = stock - 1 WHERE id = 1 AND stock > 0;
INSERT INTO loans (member_id, book_id) VALUES (2, 1);
COMMIT;
```

중간에 실패하면 `ROLLBACK`합니다.

### Atomicity(원자성)

모두 반영되거나 모두 취소됩니다.

### Consistency(일관성)

트랜잭션 전후에 제약조건과 업무 규칙을 만족하는 유효한 상태를 유지해야 합니다. 트랜잭션이 잘못된 업무 로직을 자동으로 올바르게 만들지는 않습니다.

### Isolation(격리성)

동시에 실행되는 트랜잭션이 서로의 중간 상태를 함부로 보지 않도록 합니다. 격리 수준에 따라 허용되는 현상이 다릅니다.

### Durability(지속성)

COMMIT된 결과는 장애가 생겨도 보존되어야 합니다.

## 15. 트랜잭션이 필요한 다른 예

### 쇼핑몰 주문

- 상품 재고 감소
- 주문 생성
- 주문 항목 생성
- 결제 상태 기록

외부 결제 API까지 포함되면 데이터베이스 transaction 하나만으로 해결되지 않아 보상 작업이나 상태 머신 같은 추가 설계가 필요합니다.

### 좌석 예약

- 남은 좌석 확인 및 감소
- 예약 행 생성

두 사용자가 마지막 한 좌석을 동시에 예약하지 않도록 조회와 변경 사이의 경쟁 상태도 고려합니다.

### 계좌 이체

- 보내는 계좌 잔액 감소
- 받는 계좌 잔액 증가
- 이체 내역 생성

가장 전형적인 원자성 예제입니다.

## 16. 개념 확인 문제

1. `loans`를 하나의 엔터티로 보는 이유는 무엇인가요?
2. `authors`와 `books`에서 외래 키는 어느 테이블에 두는 것이 자연스러운가요?
3. 도서가 없는 저자까지 보고 싶다면 INNER JOIN과 LEFT JOIN 중 무엇을 선택하나요?
4. LEFT JOIN 집계에서 `COUNT(*)`와 `COUNT(books.id)`가 다를 수 있는 이유는 무엇인가요?
5. UPDATE 전후에 확인할 세 가지 정보를 적으세요.
6. prepared statement가 실행 속도 외에 값 바인딩에도 필요한 이유는 무엇인가요?
7. 트랜잭션이 모든 업무 오류를 자동으로 막아주지 않는 이유는 무엇인가요?

<details>
<summary>개념 확인 해설</summary>

1. 대출 시각, 반납 시각처럼 대출 사건 자체의 속성이 있기 때문입니다.
2. 1:N의 N 쪽인 `books`에 `author_id`를 둡니다.
3. LEFT JOIN을 사용합니다.
4. LEFT JOIN은 연결 도서가 없어도 저자 행을 NULL로 확장해 남깁니다. `COUNT(*)`는 그 행을 세지만 `COUNT(books.id)`는 NULL을 세지 않습니다.
5. 같은 조건의 사전 SELECT, 예상 대상 건수, 실행 결과 `changes`, 사후 값 중 적어도 세 가지를 확인합니다.
6. SQL 구조와 입력값을 분리하여 따옴표 오류와 SQL injection 위험을 줄입니다.
7. 잘못된 조건으로 모든 행을 수정하는 코드도 트랜잭션 안에서 COMMIT하면 그대로 반영됩니다. 올바른 업무 조건과 검증은 개발자가 설계해야 합니다.

</details>

## 17. 확인 항목

- [ ] 1:1, 1:N, N:M을 각각 다른 예로 설명할 수 있습니다.
- [ ] 기본 키와 외래 키를 구분할 수 있습니다.
- [ ] 중복으로 인한 삽입·수정·삭제 이상을 설명할 수 있습니다.
- [ ] INNER JOIN과 LEFT JOIN의 결과 차이를 예측할 수 있습니다.
- [ ] prepared statement에 값을 별도로 전달해야 하는 이유를 설명할 수 있습니다.
- [ ] UPDATE/DELETE 전후 검증 절차를 말할 수 있습니다.
- [ ] 원자성과 트랜잭션이 필요한 실제 작업을 하나 설명할 수 있습니다.
