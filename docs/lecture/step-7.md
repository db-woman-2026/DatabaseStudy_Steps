# Step 7. MongoDB CRUD 응용: 수정·삭제와 조건 검색

## 이번 단계 목표

- 여러 필드를 묶은 조건 검색을 작성합니다.
- `$set`, `$addToSet`으로 필요한 필드만 수정합니다.
- 수정 전·후 문서와 처리 건수를 비교합니다.
- 삭제 대상을 먼저 확인하고 명시적 확인 후 삭제합니다.

## 실행 준비

```bash
git switch step-7
npm ci
npm start -- seed
```

`step-6`에서 만든 `books_course` collection과 seed 명령을 그대로 사용합니다.

## 조건 검색

```bash
npm start -- search database
npm start -- search database 3
```

검색어는 제목, 저자 이름, categories 중 하나에 포함되면 됩니다. 두 번째 값이 있으면 최소 재고 조건도 함께 적용합니다.

```js
{
  $or: [
    { title: pattern },
    { "author.name": pattern },
    { categories: pattern },
  ],
  "inventory.stock": { $gte: 3 },
}
```

사용자 검색어의 정규식 기호는 일반 문자로 바꾼 뒤 `RegExp`를 만듭니다.

## Update

### 재고 수정

```bash
npm start -- update-stock 978-00-0001 8
```

```js
await books.updateOne(
  { isbn },
  { $set: { "inventory.stock": stock, updatedAt: new Date() } },
)
```

문서 전체를 교체하지 않고 중첩 재고 필드만 바꿉니다.

### category 추가

```bash
npm start -- add-category 978-00-0001 sql
```

`$addToSet`은 배열에 같은 값이 없을 때만 추가합니다. 명령을 두 번 실행해 두 번째 `modifiedCount`가 0인지 확인합니다.

## Delete

먼저 confirm 없이 실행합니다.

```bash
npm start -- remove 978-00-0003
```

삭제 대상을 출력하지만 실제로 삭제하지 않습니다. 확인 후 다시 실행합니다.

```bash
npm start -- remove 978-00-0003 confirm
```

`deleteOne()`의 `deletedCount`가 1인지 확인하고 `list`로 남은 문서를 다시 조회합니다.

## 추천 반복 순서

1. `seed`와 `list`로 기준 상태를 확인합니다.
2. `search` 조건을 세 가지 이상 바꿉니다.
3. `update-stock` 실행 전·후 재고를 비교합니다.
4. 같은 category를 두 번 추가해 중복 방지를 확인합니다.
5. confirm 없는 삭제와 confirm 있는 삭제를 비교합니다.
6. `list`로 최종 상태를 검증합니다.

## 직접 해볼 연습

1. 출판 연도 범위를 받는 검색 조건을 추가합니다.
2. 재고를 새 값으로 교체하지 않고 `$inc`로 증가하는 명령을 만듭니다.
3. category를 제거하는 `$pull` 명령을 추가합니다.
4. 삭제 대신 `isActive: false`로 바꾸는 soft delete 방식을 구현합니다.
5. 여러 문서를 수정하는 명령에 사전 조회와 확인 절차를 설계합니다.

## 자주 만나는 문제

### `matchedCount`는 1인데 `modifiedCount`가 0입니다

이미 같은 값이 저장되어 있거나 `$addToSet` 배열에 같은 category가 있습니다. 오류가 아니라 변경할 내용이 없다는 뜻입니다.

### search의 특수문자가 이상하게 동작합니다

`escapeRegex()`를 거쳐 검색어의 정규식 기호를 일반 문자로 처리하는지 확인합니다.

## 완료 기준

- 조건 검색에서 `$or`와 다른 조건이 함께 적용되는 방식을 설명할 수 있습니다.
- `$set`, `$addToSet`, `$inc`, `$pull`의 차이를 구분할 수 있습니다.
- update와 delete 전후에 확인해야 할 값과 처리 건수를 설명할 수 있습니다.
