# Database Basic Course

이 폴더는 단계별 실습 전에 읽는 Database 선수 학습 자료입니다.

Node.js 문법을 다시 처음부터 설명하지는 않습니다. 대신 같은 JavaScript 객체가 RDBMS의 행과 MongoDB의 문서에서 어떻게 다르게 저장되는지 비교하며 읽습니다.

## 권장 순서

| 문서 | 핵심 내용 | 연결 단계 |
| --- | --- | --- |
| [01. Database와 RDBMS](./01-database-rdbms.md) | 데이터베이스, 테이블, 키, SQLite | `step-1` |
| [02. SQL과 관계](./02-sql-relations.md) | SQL, 제약조건, 관계, JOIN, 트랜잭션 | `step-2~3` |
| [03. JSON과 MongoDB](./03-json-mongodb.md) | 문서, 컬렉션, 중첩 구조, 인덱스 | `step-4~5` |
| [04. CRUD 비교](./04-crud-comparison.md) | SQL과 MongoDB CRUD 표현 비교 | `step-6~8` |

각 문서는 용어를 외우기보다 “어떤 데이터를 어떤 구조에 저장하고, 어떤 조건으로 다시 찾는가”에 집중해서 읽습니다.
