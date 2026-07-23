# 데이터베이스 8일 실습

SQLite와 MongoDB로 같은 도서 관리 요구사항을 구현합니다. 하루 6시간씩 8일 동안 데이터 구조를 예측하고, 변경한 뒤 처리 건수와 저장 결과를 다시 조회합니다.

## 시작 순서

1. [Windows 11 환경 준비](docs/windows-11.md)에서 Node.js, Git, VS Code, MongoDB, mongosh를 설치합니다.
2. [기초 읽기 자료](docs/basic/README.md)에서 현재 일차에 필요한 개념을 확인합니다.
3. [8일 과정 계획](docs/lecture/course-plan.md)에서 시간표와 평가 기준을 확인합니다.
4. [단계별 실습](docs/lecture/README.md)을 1일차부터 순서대로 진행합니다.

개인 저장소의 `main`에서 모든 코드를 직접 입력합니다. 하루 실습이 끝나면 검사, commit, push까지 마친 뒤 다음 일차로 넘어갑니다.

## 과정 구성

| 일차 | 주제 | 결과 |
| --- | --- | --- |
| 1일차 | 데이터베이스와 첫 RDBMS | SQLite 테이블과 제약조건 |
| 2일차 | 관계형 모델링 | PK, FK, JOIN |
| 3일차 | SQL 조회·변경 | 집계와 트랜잭션 |
| 4일차 | MongoDB 문서 기초 | 연결, 생성, 조회 |
| 5일차 | 문서 모델링 | 포함, 참조, 인덱스 |
| 6일차 | MongoDB Create·Read | 입력 검증과 반복 조회 |
| 7일차 | MongoDB Update·Delete | 안전한 조건과 처리 건수 |
| 8일차 | 복합 문서와 Aggregation | 전체 CRUD와 집계 |

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
6. `npm.cmd run check`를 통과시킵니다.
7. `git diff`를 읽고 commit한 뒤 `origin/main`에 push합니다.
