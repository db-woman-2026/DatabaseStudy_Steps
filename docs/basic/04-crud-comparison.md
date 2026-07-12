# 04. CRUD 비교

CRUD는 데이터를 생성(Create), 조회(Read), 수정(Update), 삭제(Delete)하는 네 가지 기본 작업입니다.

| 목적 | SQL | MongoDB Node.js Driver |
| --- | --- | --- |
| 생성 | `INSERT` | `insertOne()` |
| 여러 건 조회 | `SELECT` | `find()` |
| 한 건 조회 | `SELECT ... LIMIT 1` | `findOne()` |
| 수정 | `UPDATE` | `updateOne()` |
| 삭제 | `DELETE` | `deleteOne()` |

표현은 다르지만 공통 흐름은 같습니다.

1. 어떤 데이터를 대상으로 할지 조건을 정합니다.
2. 실행 전에 조건이 맞는지 조회합니다.
3. 생성·수정·삭제 결과의 처리 건수를 확인합니다.
4. 다시 조회해서 최종 상태를 검증합니다.

## MongoDB 수정 연산자

- `$set`: 특정 필드를 새 값으로 바꿉니다.
- `$inc`: 숫자를 증가하거나 감소시킵니다.
- `$push`: 배열에 값을 추가합니다.
- `$addToSet`: 배열에 중복 없이 값을 추가합니다.

문서 전체를 덮어쓰기보다 의도한 필드만 수정하면 예상하지 못한 데이터 손실을 줄일 수 있습니다.

## 안전한 삭제

```js
const target = await collection.findOne({ isbn })

if (!target) {
  console.log("삭제할 문서가 없습니다.")
  return
}

const result = await collection.deleteOne({ _id: target._id })
console.log(result.deletedCount)
```

## 확인하기

1. 수정 전에 대상을 조회하는 이유는 무엇인가요?
2. `updateMany()`와 `deleteMany()`를 사용할 때 어떤 확인이 더 필요한가요?
3. CRUD 네 작업 중 실수했을 때 가장 복구하기 어려운 작업은 무엇인가요?
