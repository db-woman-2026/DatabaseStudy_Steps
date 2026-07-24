# 데이터베이스 단계별 실습

[Windows 11 환경 준비](../windows-11.md) <span class="print-reference" data-print-reference="true">(Database · Windows 11 x64 실습 환경 준비 · 1. Windows Terminal 설치)</span>를 확인한 뒤 개인 저장소의 `main`에서 작업합니다. 코드와 쿼리는 직접 입력하고 실행 전 예상과 실행 후 검증을 함께 기록합니다.

## 관련 자료

- [실습 구성](./course-plan.md) <span class="print-reference" data-print-reference="true">(Database · 데이터베이스 실습 구성 · 시작 조건)</span>: 주제별 결과, 공통 검증 절차, 안전 경계
- [기초 읽기 자료](../basic/README.md) <span class="print-reference" data-print-reference="true">(Database · 데이터베이스 기초 · 문서 목록)</span>: RDBMS, SQL, JSON, MongoDB 개념

## 실습 방식

1. `git branch --show-current`에 `main`이 표시되는지 확인합니다.
2. 현재 단계의 데이터 구조와 안전 범위를 확인합니다.
3. 기준 실행 결과를 확인합니다.
4. 결과를 예측하고 코드나 쿼리를 직접 입력합니다.
5. 처리 건수와 저장된 데이터를 다시 조회합니다.
6. 독립 확인을 마친 뒤 commit하고 push합니다.

## 실습 목록

| 단계 | 문서 | 실습 |
| --- | --- | --- |
| Step 1 | [데이터베이스와 RDBMS](./step-1.md) <span class="print-reference" data-print-reference="true">(Database · Step 1. 데이터베이스와 RDBMS 기초 · 0. 먼저 생각할 질문)</span> | SQLite 데이터베이스와 첫 테이블 |
| Step 2 | [관계형 모델링과 SQL](./step-2.md) <span class="print-reference" data-print-reference="true">(Database · Step 2. 관계형 데이터 모델링과 SQL 기초 · 0. 먼저 생각할 질문)</span> | 키, 제약조건, JOIN |
| Step 3 | [SQL 조회·조작·트랜잭션](./step-3.md) <span class="print-reference" data-print-reference="true">(Database · Step 3. SQL 조회·조작·트랜잭션 · 0. 먼저 생각할 질문)</span> | 필터, 집계, 안전한 변경 |
| Step 4 | [MongoDB 문서 기초](./step-4.md) <span class="print-reference" data-print-reference="true">(Database · Step 4. MongoDB와 JSON/BSON 문서 기초 · 0. 먼저 생각할 질문)</span> | 연결, JSON 문서, 기본 조회 |
| Step 5 | [MongoDB 모델링](./step-5.md) <span class="print-reference" data-print-reference="true">(Database · Step 5. MongoDB 데이터 모델링과 인덱스 · 0. 먼저 생각할 질문)</span> | 포함, 참조, 배열, 인덱스 |
| Step 6 | [MongoDB CRUD 기초](./step-6.md) <span class="print-reference" data-print-reference="true">(Database · Step 6. MongoDB CRUD 기초: Create와 Read · 0. 먼저 생각할 질문)</span> | 생성, 목록, 한 건 조회 |
| Step 7 | [MongoDB CRUD 응용](./step-7.md) <span class="print-reference" data-print-reference="true">(Database · Step 7. MongoDB CRUD 응용: Search, Update, Delete · 0. 먼저 생각할 질문)</span> | 수정, 삭제, 조건 검색 |
| Step 8 | [복합 문서와 집계](./step-8.md) <span class="print-reference" data-print-reference="true">(Database · Step 8. 복합 JSON, Aggregation, CRUD 종합 · 0. 먼저 생각할 질문)</span> | 전체 CRUD와 Aggregation |
