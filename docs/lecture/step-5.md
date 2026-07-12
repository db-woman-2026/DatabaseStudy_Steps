# Step 5. MongoDB 데이터 모델링과 컬렉션 설계

## 이번 단계 목표

- 함께 읽는 데이터는 포함하고 독립적으로 관리할 데이터는 참조합니다.
- 중첩 객체, 배열, 참조 코드의 용도를 구분합니다.
- 고유 인덱스와 검색 인덱스를 만듭니다.
- projection으로 필요한 필드만 조회합니다.

## 이번 단계의 모델

도서 문서 안에는 다음 정보를 포함합니다.

- `author`: 도서 화면에서 항상 함께 보여줄 작은 저자 요약
- `categories`: 한 도서가 여러 분류에 속할 수 있는 문자열 배열
- `inventory`: 재고 수량과 위치를 함께 묶은 중첩 객체

출판사는 별도 `publishers_step5` collection에 저장하고 도서의 `publisherCode`로 참조합니다.

```text
books_step5.publisherCode -> publishers_step5.code
```

MongoDB가 이 연결을 외래키처럼 자동 검사하지는 않습니다. 애플리케이션이 올바른 코드를 저장해야 합니다.

## 실행

```bash
git switch step-5
cp .env.example .env
npm ci
npm start
```

## 포함과 참조 판단

### 포함한 author

```js
author: {
  name: "김데이터",
  country: "KR",
}
```

도서 목록과 상세에서 항상 함께 읽고 크기가 작아 문서 안에 포함했습니다.

### 참조한 publisher

```js
publisherCode: "DATA-LAB"
```

출판사에는 웹사이트 등 독립적으로 바뀌는 정보가 있어 별도 collection에 둡니다.

## 인덱스

```js
await books.createIndex({ isbn: 1 }, { unique: true })
await books.createIndex({ categories: 1 })
await books.createIndex({ "inventory.stock": 1 })
```

- `isbn`: 중복을 막고 한 권을 빠르게 찾습니다.
- `categories`: 카테고리별 목록을 자주 찾습니다.
- `inventory.stock`: 재고 조건 검색에 사용합니다.

인덱스는 읽기를 돕지만 저장 공간과 쓰기 비용을 사용합니다. 실제 조회 조건을 기준으로 선택합니다.

## 배열과 중첩 필드 조회

```js
books.find({ categories: "database" })
books.find({ "inventory.stock": { $gte: 2 } })
```

배열은 값 하나를 조건으로 전달해 포함 여부를 찾을 수 있습니다. 중첩 필드는 점 표기법을 사용합니다.

## projection

```js
{
  projection: {
    _id: 0,
    title: 1,
    "author.name": 1,
    "inventory.stock": 1,
  },
}
```

문서 전체가 필요하지 않을 때 필요한 필드만 반환합니다.

## 실행 결과에서 확인할 것

- `isbn_1` 인덱스는 unique입니다.
- categories와 inventory.stock 인덱스가 만들어집니다.
- database 카테고리 도서만 중첩 구조로 출력됩니다.
- publisherCode로 별도 출판사 문서를 조회합니다.

## 직접 해볼 연습

1. `reviews`를 포함할지 별도 collection으로 둘지 이유를 적어봅니다.
2. `publishedYear` 인덱스를 만들고 인덱스 목록을 확인합니다.
3. 재고가 2 이상이며 database 카테고리인 도서를 찾습니다.
4. 존재하지 않는 publisherCode를 넣었을 때 왜 저장되는지 설명합니다.
5. 출판사 정보를 도서와 함께 출력하는 코드를 작성합니다.

## 자주 만나는 문제

### unique index 생성이 실패합니다

이미 중복 ISBN 문서가 있으면 고유 인덱스를 만들 수 없습니다. 현재 단계 collection을 초기화하거나 중복 문서를 먼저 찾습니다.

### 중첩 필드가 projection에 보이지 않습니다

`inventory.stock`처럼 점 표기법과 실제 필드 이름이 맞는지 원본 문서 한 개를 먼저 출력합니다.

## 완료 기준

- 포함과 참조를 선택한 이유를 조회 방식과 변경 빈도로 설명할 수 있습니다.
- 배열과 중첩 필드 조건을 작성할 수 있습니다.
- 인덱스가 읽기와 쓰기에 주는 영향을 설명할 수 있습니다.
