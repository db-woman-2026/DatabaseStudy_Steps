# 02. SQL과 관계

## SQL의 역할

SQL은 관계형 데이터베이스에 구조와 작업을 전달하는 언어입니다.

```sql
CREATE TABLE members (...);
INSERT INTO members (name, email) VALUES ('민지', 'minji@example.com');
SELECT * FROM members;
UPDATE members SET name = '김민지' WHERE id = 1;
DELETE FROM members WHERE id = 1;
```

SQL 문장은 크게 구조를 만드는 명령, 데이터를 읽는 명령, 데이터를 바꾸는 명령으로 나눠볼 수 있습니다.

## 키와 제약조건

- `PRIMARY KEY`: 행을 고유하게 구분합니다.
- `FOREIGN KEY`: 다른 테이블의 행을 가리킵니다.
- `NOT NULL`: 반드시 값이 있어야 합니다.
- `UNIQUE`: 같은 값을 중복 저장하지 않습니다.
- `CHECK`: 허용할 값의 조건을 정합니다.

제약조건은 애플리케이션 코드가 실수하더라도 데이터베이스가 잘못된 데이터를 막는 마지막 안전선입니다.

## 관계와 JOIN

도서와 저자를 별도 테이블로 두면 한 저자의 정보를 여러 책에 반복해서 저장하지 않아도 됩니다. `books.author_id`가 `authors.id`를 가리키고, `JOIN`으로 두 테이블을 다시 연결합니다.

## 트랜잭션

여러 변경이 모두 성공하거나 모두 취소돼야 할 때 트랜잭션을 사용합니다. 대출 기록을 만들었는데 재고 변경이 실패하는 것처럼 일부만 반영되는 상황을 막습니다.

## 확인하기

1. 외래키는 어떤 두 데이터를 연결하나요?
2. `WHERE` 없는 `UPDATE`와 `DELETE`가 위험한 이유는 무엇인가요?
3. 두 변경을 하나의 트랜잭션으로 묶어야 하는 예를 생각해보세요.
