# 데이터베이스 실습 구성

SQLite와 MongoDB로 같은 도서 관리 요구사항을 구현합니다. 데이터 구조를 예측하고 변경한 뒤 처리 건수와 저장 결과를 다시 조회합니다.

## 시작 조건

- [Windows 11 환경 준비](../windows-11.md) <span class="print-reference" data-print-reference="true">(Database · Windows 11 x64 실습 환경 준비 · 1. Windows Terminal 설치)</span>를 확인합니다.
- 개인 저장소의 현재 branch가 `main`인지 확인합니다.
- 환경 준비에서 직접 만든 개인 프로젝트의 `main`에서 시작합니다.
- `npm install`과 `npm run check`를 실행할 수 있습니다.
- `.env`의 `MONGODB_DB`가 `database_study_`로 시작하는 전용 데이터베이스인지 확인합니다.

## 주제별 결과

| 단계 | 주제 | 확인 결과 |
| --- | --- | --- |
| Step 1 | 데이터베이스와 RDBMS | SQLite 파일, 테이블, 기본 키, 제약조건을 확인합니다. |
| Step 2 | 관계형 데이터 모델링 | PK, FK, 관계, 정규화, JOIN을 코드와 조회 결과로 확인합니다. |
| Step 3 | SQL 조회와 변경 | 필터, 집계, UPDATE, DELETE, 트랜잭션을 검증합니다. |
| Step 4 | MongoDB 문서 기초 | 연결, BSON 문서 생성, 기본 조회, 배열·중첩 조건을 확인합니다. |
| Step 5 | 문서 모델링과 인덱스 | 포함, 참조, 배열 성장, unique·compound index를 비교합니다. |
| Step 6 | MongoDB Create와 Read | CLI 입력을 검증하고 생성·목록·단건 조회를 구현합니다. |
| Step 7 | MongoDB Update와 Delete | 복합 검색, 부분 수정, 처리 건수, 삭제 guard를 구현합니다. |
| Step 8 | 복합 문서와 Aggregation | review 문서, `$unwind`, `$group`, `$project`와 전체 CRUD를 확인합니다. |

## 공통 검증 절차

데이터를 읽거나 바꾸는 작업은 다음 기준으로 확인합니다.

1. 대상 데이터베이스, 파일, 테이블 또는 컬렉션을 확인합니다.
2. 실행 전 결과와 처리 건수를 예상합니다.
3. 명령, 쿼리 또는 코드를 실행합니다.
4. 반환 객체의 처리 건수를 확인합니다.
5. 같은 조건으로 다시 조회해 실제 저장 상태를 확인합니다.
6. 정상값, 경계값, 누락값, 존재하지 않는 값 중 관련 사례를 실행합니다.
7. `npm run check`와 단계별 검증 명령을 실행합니다.
8. `git status`로 저장할 파일을 확인하고 commit한 뒤 개인 저장소에 push합니다.

## 기초 자료

| 문서 | 확인할 개념 |
| --- | --- |
| [데이터베이스와 RDBMS](../basic/01-database-rdbms.md) <span class="print-reference" data-print-reference="true">(Database · 01. 데이터베이스와 RDBMS · 1. 데이터, 정보, 데이터베이스)</span> | DBMS, 테이블, 스키마, 키, NULL, 제약조건, SQLite |
| [SQL과 관계](../basic/02-sql-relations.md) <span class="print-reference" data-print-reference="true">(Database · 02. SQL과 관계 · 1. SQL은 무엇을 표현하는가)</span> | SQL, 관계, 정규화, JOIN, 집계, 트랜잭션 |
| [JSON과 MongoDB](../basic/03-json-mongodb.md) <span class="print-reference" data-print-reference="true">(Database · 03. JSON, BSON과 MongoDB · 1. JSON 복습)</span> | JSON/BSON, 문서, 포함/참조, 배열, 커서, 인덱스 |
| [CRUD 비교](../basic/04-crud-comparison.md) <span class="print-reference" data-print-reference="true">(Database · 04. SQL과 MongoDB CRUD 비교 · 1. CRUD란 무엇인가)</span> | SQL·MongoDB CRUD, 결과 카운트, 연산자, 원자성, 테스트 |

필요한 개념이 낯설 때 해당 문서의 예제와 확인 문제를 봅니다.

## 모델링 비교

| 개념 | 도서 관리 예시 | 다른 예시 |
| --- | --- | --- |
| 1:N 관계 | 저자-도서 | 고객-주문 |
| N:M 관계 | 회원-도서(대출) | 주문-상품 |
| 포함 문서 | 도서의 저자 요약 | 주문의 배송지 snapshot |
| 참조 | 도서의 출판사 | 주문의 고객 |
| 배열 | 도서 category·review | 상품 tag·옵션 |
| 집계 | category별 재고 | 상태별 매출 |

데이터 이름을 바꿔도 관계의 수, 변경 빈도, 함께 읽는 범위, 배열 성장 가능성을 같은 방식으로 검토합니다.

## 안전 경계

- SQLite는 `data/*.sqlite` 파일만 사용합니다.
- MongoDB는 `MONGODB_DB`가 `database_study_`로 시작할 때만 초기화 명령을 실행합니다.
- `seed`는 전용 컬렉션의 기존 데이터를 바꾸므로 대상 이름을 먼저 확인합니다.
- update와 delete는 대상 조회, 변경, 처리 건수, 재조회 순서로 검증합니다.
- `.env`, SQLite 결과 파일, 개인 데이터는 commit하지 않습니다.
- 오류가 나면 연결, 구문, 제약조건, 조회 조건, 현재 데이터 상태를 구분해 확인합니다.

## 완료 기준

- SQL의 테이블·키·관계와 MongoDB의 문서·포함·참조를 요구사항에 맞춰 선택할 수 있습니다.
- 조회 결과의 행 또는 문서 단위와 예상 건수를 설명할 수 있습니다.
- create, update, delete 뒤 반환된 처리 건수와 실제 저장 상태를 함께 확인합니다.
- 트랜잭션과 단일 문서 원자 연산이 필요한 이유를 실패 상황으로 설명할 수 있습니다.
- 인덱스와 aggregation 결과를 실행 계획과 중간 문서 형태로 확인합니다.
- 모든 변경이 개인 저장소의 `main`에 commit되고 원격 저장소에 push되어 있습니다.
