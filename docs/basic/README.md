# 데이터베이스 기초

단계별 실습 전에 읽을 데이터베이스 기초 자료입니다. 네 문서에서 판단 기준, 비교 예제, 확인 문제를 다룹니다.

Windows 11에서 실습한다면 먼저 [Windows 11 환경 준비](../windows-11.md) <span class="print-reference" data-print-reference="true">(Database · Windows 11 x64 실습 환경 준비 · 1. Windows Terminal 설치)</span>를 확인합니다.

Node.js 문법을 다시 처음부터 설명하지는 않습니다. 대신 같은 JavaScript 객체가 RDBMS의 행과 MongoDB의 문서에서 어떻게 다르게 저장되는지 비교하며 읽습니다.

## 문서 목록

| 문서 | 내용 | 연결 단계 |
| --- | --- | --- |
| [01. 데이터베이스와 RDBMS](./01-database-rdbms.md) <span class="print-reference" data-print-reference="true">(Database · 01. 데이터베이스와 RDBMS · 1. 데이터, 정보, 데이터베이스)</span> | DBMS, 테이블, 스키마, 키, NULL, 제약조건, SQLite | `step-1` |
| [02. SQL과 관계](./02-sql-relations.md) <span class="print-reference" data-print-reference="true">(Database · 02. SQL과 관계 · 1. SQL은 무엇을 표현하는가)</span> | SQL, 키, 관계, 정규화, JOIN, 집계, 트랜잭션 | `step-2~3` |
| [03. JSON과 MongoDB](./03-json-mongodb.md) <span class="print-reference" data-print-reference="true">(Database · 03. JSON, BSON과 MongoDB · 1. JSON 복습)</span> | JSON/BSON, 문서, 포함/참조, 배열, 커서, 인덱스 | `step-4~5` |
| [04. CRUD 비교](./04-crud-comparison.md) <span class="print-reference" data-print-reference="true">(Database · 04. SQL과 MongoDB CRUD 비교 · 1. CRUD란 무엇인가)</span> | SQL/MongoDB CRUD, 결과 카운트, 연산자, 삭제, 원자성, 테스트 | `step-6~8` |

각 문서는 용어를 외우기보다 “어떤 데이터를 어떤 구조에 저장하고, 어떤 조건으로 다시 찾는가”에 집중해서 읽습니다.

## 읽는 방법

1. 각 절의 예제를 실행하기 전에 결과를 먼저 예상합니다.
2. 도서 예제를 쇼핑몰·학교·예약 데이터로 바꿔 같은 개념을 설명합니다.
3. 개념 확인 문제를 답한 뒤 접힌 해설을 확인합니다.
4. 마지막 체크리스트에서 설명하기 어려운 항목을 표시합니다.
5. 해당 `step-N.md` 실습 중 막혔을 때 관련 절로 돌아옵니다.

필요한 개념이 낯설 때 연결된 문서의 예제와 확인 문제를 봅니다.
