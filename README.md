# 데이터베이스 단계별 실습

SQLite와 MongoDB로 같은 도서 관리 요구사항을 구현합니다. 데이터 구조를 예측하고 변경한 뒤 처리 건수와 저장 결과를 다시 조회합니다.

이 저장소에는 단계별 설명과 기준 코드가 있습니다. `$HOME\dongbu\database-study`에 Node.js 프로젝트와 개인 GitHub 저장소를 만들고 모든 파일을 직접 입력합니다.

## 시작 순서

1. [Windows 11 환경 준비](docs/windows-11.md) <span class="print-reference" data-print-reference="true">(인쇄본 위치: Database · 장 「Windows 11 x64 실습 환경 준비」 · 절 「1. Windows Terminal 설치」)</span>에서 Node.js, Git, VS Code, MongoDB, mongosh를 설치합니다.
2. [기초 읽기 자료](docs/basic/README.md) <span class="print-reference" data-print-reference="true">(인쇄본 위치: Database · 장 「데이터베이스 기초」 · 절 「문서 목록」)</span>에서 필요한 개념을 확인합니다.
3. [실습 구성](docs/lecture/course-plan.md) <span class="print-reference" data-print-reference="true">(인쇄본 위치: Database · 장 「데이터베이스 실습 구성」 · 절 「시작 조건」)</span>에서 주제별 결과와 검증 절차를 확인합니다.
4. [단계별 실습](docs/lecture/README.md) <span class="print-reference" data-print-reference="true">(인쇄본 위치: Database · 장 「데이터베이스 단계별 실습」 · 절 「관련 자료」)</span>에서 코드와 쿼리를 확인합니다.

개인 저장소의 `main`에서 모든 코드를 직접 입력합니다. 단계별 검사를 통과한 뒤 commit하고 push합니다.

## 실습 구성

| 단계 | 주제 | 결과 |
| --- | --- | --- |
| Step 1 | 데이터베이스와 첫 RDBMS | SQLite 테이블과 제약조건 |
| Step 2 | 관계형 모델링 | PK, FK, JOIN |
| Step 3 | SQL 조회·변경 | 집계와 트랜잭션 |
| Step 4 | MongoDB 문서 기초 | 연결, 생성, 조회 |
| Step 5 | 문서 모델링 | 포함, 참조, 인덱스 |
| Step 6 | MongoDB Create·Read | 입력 검증과 반복 조회 |
| Step 7 | MongoDB Update·Delete | 안전한 조건과 처리 건수 |
| Step 8 | 복합 문서와 Aggregation | 전체 CRUD와 집계 |

## 실행 환경

- Node.js 22.13 이상
- SQLite: Node.js 기본 `node:sqlite`
- MongoDB Community Server와 mongosh
- Windows Terminal의 PowerShell

SQLite 파일은 `data/` 아래의 실습 전용 파일만 사용합니다. MongoDB는 `database_study_`로 시작하는 전용 데이터베이스만 사용합니다. `.env`와 생성 데이터는 commit하지 않습니다.

## 매일 반복할 순서

1. 실행 결과를 먼저 적습니다.
2. 한 번에 한 조건만 바꿉니다.
3. 처리 건수와 오류 메시지를 기록합니다.
4. 같은 대상을 다시 조회합니다.
5. 실험용 변경과 데이터를 정리합니다.
6. `npm run check`를 통과시킵니다.
7. `git status`로 저장할 파일을 확인하고 commit한 뒤 개인 저장소에 push합니다.
