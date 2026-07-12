# Step 2. 관계형 데이터 모델링과 SQL 기초

## 이번 단계 목표

- 하나의 큰 데이터 묶음을 여러 테이블로 나누는 이유를 설명합니다.
- 기본키와 외래키로 테이블 관계를 표현합니다.
- `NOT NULL`, `UNIQUE`, `CHECK` 제약조건의 역할을 확인합니다.
- `JOIN`으로 나뉜 데이터를 다시 하나의 결과로 조회합니다.

## 이전 단계와 달라지는 점

`step-1`에서는 `members` 테이블 하나만 사용했습니다. 이번 단계에서는 도서 관리에 필요한 데이터를 다음 네 테이블로 나눕니다.

```text
authors 1 ─── N books
members 1 ─── N loans N ─── 1 books
```

도서에 저자 이름을 반복 저장하지 않고 `author_id`로 저자를 가리킵니다. 대출 기록도 회원과 도서의 ID를 저장합니다.

## 실행

```bash
git switch step-2
npm start
```

`data/library-step-2.sqlite`가 새로 생성됩니다.

## 데이터 구조

### authors

- `id`: 저자를 구분하는 primary key
- `name`: 중복을 허용하지 않는 저자 이름

### books

- `isbn`: 책의 외부 식별자, `UNIQUE`
- `author_id`: `authors.id`를 가리키는 foreign key
- `stock`: 음수가 될 수 없도록 `CHECK`

### members와 loans

`loans`는 누가 어떤 책을 빌렸는지 연결합니다. `returned_at`이 `NULL`이면 아직 반납하지 않은 대출입니다.

## 코드 흐름

### 1. 외래키 검사 켜기

```js
database.exec("PRAGMA foreign_keys = ON")
```

SQLite는 연결마다 외래키 검사를 켜야 합니다. 존재하지 않는 저자나 회원 ID를 저장하려 하면 오류가 발생합니다.

### 2. 관계 정의하기

```sql
author_id INTEGER NOT NULL,
FOREIGN KEY (author_id) REFERENCES authors(id)
```

column의 값이 다른 테이블의 primary key와 연결됩니다.

### 3. 생성 결과 ID 사용하기

```js
const authorId = insertAuthor.run("김데이터").lastInsertRowid
insertBook.run("978-00-0001", "데이터를 배우는 시간", authorId, 3)
```

저자를 먼저 만든 뒤 생성된 ID로 도서를 연결합니다.

### 4. JOIN으로 읽기

```sql
SELECT books.title, authors.name AS author
FROM books
JOIN authors ON authors.id = books.author_id
```

저장할 때는 나뉜 데이터가 조회 결과에서는 다시 합쳐집니다.

## 실행 결과에서 확인할 것

- 도서 세 권이 저자 이름과 함께 출력됩니다.
- 대출 한 건이 회원 이름, 도서 제목과 함께 출력됩니다.
- `PRAGMA foreign_key_list(books)`에서 `authors` 연결이 보입니다.

## 직접 해볼 연습

1. 새로운 저자와 도서를 한 권 추가합니다.
2. 존재하지 않는 `author_id`로 도서를 넣고 오류를 확인합니다.
3. `stock`에 `-1`을 넣고 `CHECK` 오류를 확인합니다.
4. 대출 조회에 회원 email을 추가합니다.
5. 대출이 한 번도 없는 도서도 보이도록 `LEFT JOIN`을 조사합니다.

## 자주 만나는 문제

### 외래키 오류가 나지 않습니다

`PRAGMA foreign_keys = ON`이 연결 직후 실행됐는지 확인합니다.

### JOIN 결과가 비어 있습니다

`ON` 조건에서 연결한 두 column이 실제로 같은 ID를 갖는지 각 테이블을 따로 조회합니다.

## 완료 기준

- primary key와 foreign key의 차이를 설명할 수 있습니다.
- 도서와 저자를 별도 테이블로 나눈 이유를 설명할 수 있습니다.
- `JOIN ... ON ...`이 어떤 행을 연결하는지 읽을 수 있습니다.
