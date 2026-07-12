# Step 3. SQL 기반 데이터 조회와 조작

## 이번 단계 목표

- `WHERE`, `ORDER BY`, `GROUP BY`로 필요한 결과를 만듭니다.
- `COUNT`, `SUM`으로 여러 행을 요약합니다.
- `UPDATE`와 `DELETE`의 처리 건수를 확인합니다.
- 대출과 재고 변경을 하나의 트랜잭션으로 실행합니다.

## 실행

```bash
git switch step-3
npm start
```

`data/library-step-3.sqlite`는 매 실행마다 같은 샘플 데이터로 초기화됩니다.

## 조회 실습

### 조건과 정렬

```sql
SELECT title, published_year, stock
FROM books
WHERE stock >= ?
ORDER BY published_year DESC, title ASC
```

`WHERE`는 행을 고르고 `ORDER BY`는 결과의 순서를 정합니다. `?` 값은 JavaScript에서 별도로 전달합니다.

### 그룹과 집계

```sql
SELECT
  authors.name,
  COUNT(books.id) AS book_count,
  SUM(books.stock) AS total_stock
FROM authors
LEFT JOIN books ON books.author_id = authors.id
GROUP BY authors.id, authors.name
```

여러 도서 행을 저자별 그룹으로 묶어 도서 수와 총 재고를 계산합니다.

## 변경 실습

### UPDATE

```sql
UPDATE members
SET email = ?
WHERE id = ?
```

`WHERE`가 없으면 모든 회원의 email이 바뀝니다. 변경 전 조건을 `SELECT`로 먼저 확인하고 `result.changes`도 확인합니다.

### DELETE

```sql
DELETE FROM loans
WHERE returned_at IS NOT NULL
```

완료된 대출만 대상으로 합니다. 삭제는 되돌리기 어려우므로 조건과 처리 건수를 반드시 봅니다.

## 트랜잭션 실습

도서 대출에는 두 변경이 필요합니다.

1. `books.stock`을 1 감소시킵니다.
2. `loans`에 대출 행을 생성합니다.

둘 중 하나만 성공하면 데이터가 맞지 않습니다.

```js
database.exec("BEGIN")

try {
  // 재고 감소와 대출 생성
  database.exec("COMMIT")
} catch (error) {
  database.exec("ROLLBACK")
}
```

재고가 없으면 오류를 만들고 두 변경을 모두 취소합니다.

## 실행 결과에서 확인할 것

- 재고 2권 이상 도서가 최신 출판 연도 순으로 보입니다.
- 저자별 도서 수와 총 재고가 집계됩니다.
- email 수정과 완료 대출 삭제가 각각 1건입니다.
- 새 대출이 생성되고 해당 도서의 재고가 감소합니다.

## 직접 해볼 연습

1. 제목에 `데이터`가 들어간 도서만 검색합니다.
2. 출판 연도별 평균 재고를 구합니다.
3. 재고가 0인 책을 대출해 `ROLLBACK`을 확인합니다.
4. 수정 전에 같은 `WHERE` 조건으로 대상 행을 출력합니다.
5. 대출 반납 시 `returned_at`과 재고 증가를 하나의 트랜잭션으로 구현합니다.

## 자주 만나는 문제

### `changes`가 0입니다

`WHERE` 조건에 맞는 행이 없거나 재고 조건을 통과하지 못했습니다. 같은 조건을 `SELECT`에서 먼저 확인합니다.

### 트랜잭션이 이미 시작됐다는 오류가 납니다

모든 성공 경로에 `COMMIT`, 모든 실패 경로에 `ROLLBACK`이 있는지 확인합니다.

## 완료 기준

- 조회의 필터·정렬·집계를 구분할 수 있습니다.
- `UPDATE`와 `DELETE` 전에 확인해야 할 조건을 설명할 수 있습니다.
- 대출 작업을 트랜잭션으로 묶어야 하는 이유를 설명할 수 있습니다.
