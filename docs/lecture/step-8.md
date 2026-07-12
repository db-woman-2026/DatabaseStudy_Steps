# Step 8. MongoDB CRUD 종합 실습과 복합 JSON 데이터 처리

## 이번 단계 목표

- 하나의 collection에서 전체 CRUD 흐름을 반복합니다.
- reviews 배열에 중첩 문서를 추가합니다.
- 집계 pipeline으로 전체 재고, 카테고리, 리뷰를 요약합니다.
- 생성부터 최종 검증까지 스스로 실행 순서를 구성합니다.

## 최종 CLI 기능

| 구분 | 명령 |
| --- | --- |
| 초기화 | `seed` |
| Create | `add`, `add-review` |
| Read | `list`, `get`, `search`, `stats` |
| Update | `update-stock`, `add-category`, `add-review` |
| Delete | `remove ... confirm` |

## 실행 준비

```bash
git switch step-8
npm ci
npm test
npm start -- seed
```

## 복합 JSON 리뷰 추가

```bash
npm start -- add-review 978-00-0001 민지 5 "실습 흐름이 이해하기 쉬웠어요."
```

입력은 다음 중첩 문서로 변환되어 `reviews` 배열에 추가됩니다.

```js
{
  reviewer: "민지",
  score: 5,
  comment: "실습 흐름이 이해하기 쉬웠어요.",
  createdAt: new Date(),
}
```

```js
await books.updateOne(
  { isbn },
  {
    $push: { reviews: review },
    $set: { updatedAt: new Date() },
  },
)
```

리뷰는 도서와 함께 읽고 도서별 배열 크기가 강의 범위에서 작기 때문에 포함했습니다. 실제 서비스에서 리뷰가 매우 많아지면 별도 collection을 검토합니다.

## 집계 실습

```bash
npm start -- stats
```

### 전체 재고

`$group`으로 도서 수, 총 재고, 평균 재고를 계산합니다.

### 카테고리별 요약

```js
[
  { $unwind: "$categories" },
  {
    $group: {
      _id: "$categories",
      bookCount: { $sum: 1 },
      totalStock: { $sum: "$inventory.stock" },
    },
  },
]
```

`$unwind`는 categories 배열의 각 값을 집계 가능한 행처럼 펼칩니다.

### 리뷰 요약

reviews 배열을 펼친 뒤 도서별 리뷰 수와 평균 점수를 계산합니다. 리뷰가 없는 도서는 이 결과에 나오지 않는 이유도 확인합니다.

## 권장 종합 시나리오

아래 명령을 순서대로 실행하고 매 단계의 문서 수와 변경 내용을 기록합니다.

```bash
npm start -- seed
npm start -- list
npm start -- add 978-00-0099 "실전 MongoDB" "학생 저자" 4 "database,mongodb"
npm start -- get 978-00-0099
npm start -- update-stock 978-00-0099 7
npm start -- add-category 978-00-0099 practice
npm start -- add-review 978-00-0099 민지 5 "CRUD를 반복해서 익혔어요."
npm start -- search mongodb 2
npm start -- stats
npm start -- remove 978-00-0099 confirm
npm start -- list
```

## 최종 연습 문제

1. `update-title` 명령을 추가합니다.
2. 리뷰의 평균 점수가 4 이상인 도서만 찾는 명령을 만듭니다.
3. `publisherCode`별 도서 수와 재고를 집계합니다.
4. 삭제 대신 `deletedAt`을 기록하는 soft delete를 구현합니다.
5. 실수로 삭제한 문서를 복원할 수 있는 백업 흐름을 설계합니다.
6. RDBMS의 `JOIN`, `GROUP BY`, 트랜잭션과 MongoDB의 문서·집계를 비교해봅니다.

## 자주 만나는 문제

### 리뷰 score 오류가 납니다

score는 1부터 5 사이 정수만 허용합니다. 입력 변환 규칙은 `npm test`로 확인할 수 있습니다.

### stats에서 리뷰 결과가 비어 있습니다

`seed` 직후 리뷰가 있는 샘플은 한 권입니다. 모두 삭제했거나 reviews가 빈 배열이면 `$unwind` 이후 결과가 없을 수 있습니다.

## 완료 기준

- Create, Read, Update, Delete 명령을 도움 없이 한 번씩 실행할 수 있습니다.
- 중첩 객체와 배열을 조건·수정·집계에서 다룰 수 있습니다.
- 처리 전 대상 조회와 처리 후 결과 검증을 습관처럼 수행할 수 있습니다.
- RDBMS와 MongoDB의 구조 선택 차이를 자신의 말로 설명할 수 있습니다.
