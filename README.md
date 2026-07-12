# DatabaseStudy_Steps

`DatabaseStudy_Steps`는 RDBMS 기본 원리와 MongoDB 실전 CRUD를 단계별로 학습하는 독립 강의 프로젝트입니다.

Node.js의 변수, 함수, 배열, 객체, 비동기 실행을 이미 한 번 경험했다고 가정하지만 `NodeStudy_Steps`의 코드나 데이터는 가져오지 않습니다. 이 저장소는 도서 관리라는 별도 도메인, 별도 데이터, 별도 Git 이력을 사용합니다.

## 학습 목표

- 데이터베이스, 테이블, 행, 열, 키의 의미를 설명합니다.
- 관계형 모델과 SQL의 기본 조회·변경 흐름을 이해합니다.
- JSON 문서와 MongoDB 컬렉션의 특징을 관계형 모델과 비교합니다.
- MongoDB의 생성·조회·수정·삭제를 반복해서 직접 실행합니다.
- 중첩 객체, 배열, 조건 검색, 인덱스, 집계를 작은 도서 관리 예제에 적용합니다.

## 브랜치 학습 구조

브랜치는 독립 복사본이 아니라 바로 이전 단계를 부모로 갖는 누적형 계단 구조입니다.

```text
main -> step-1 -> step-2 -> step-3 -> step-4 -> step-5 -> step-6 -> step-7 -> step-8
```

- `main`: starter, 전체 학습 안내, Database 기초 읽기 자료
- `step-1~3`: SQLite로 진행하는 RDBMS와 SQL 과정
- `step-4~8`: MongoDB와 JSON 문서, 반복 CRUD 과정

특정 단계의 수정은 가장 이른 affected step에서 커밋하고 뒤 단계로 한 브랜치씩 병합합니다.

```bash
git merge-base --is-ancestor step-N step-(N+1)
```

## 단계별 강의

| 단계 | 강의 주제 | 핵심 실습 |
| --- | --- | --- |
| `step-1` | Database Fundamentals와 RDBMS 기초 | SQLite 데이터베이스와 첫 테이블 |
| `step-2` | 관계형 데이터 모델링과 SQL 기초 | 기본키·외래키·제약조건·JOIN |
| `step-3` | SQL 기반 데이터 조회와 조작 | 필터·집계·수정·트랜잭션 |
| `step-4` | MongoDB와 JSON 문서 데이터 기초 | 연결·문서 저장·기본 조회 |
| `step-5` | MongoDB 데이터 모델링과 컬렉션 설계 | 중첩 문서·배열·인덱스 |
| `step-6` | MongoDB CRUD 기초 | 생성과 다양한 조회 반복 |
| `step-7` | MongoDB CRUD 응용 | 수정·삭제·조건 검색 반복 |
| `step-8` | MongoDB CRUD 종합 | 복합 JSON·전체 CRUD·집계 |

8일 중 RDBMS 3일, MongoDB 5일로 구성해 약 4:6의 학습 비중을 갖습니다.

## 학습 방법

1. `docs/basic/README.md`에서 현재 단계와 연결되는 기초 문서를 읽습니다.
2. 학습할 브랜치로 이동합니다.
3. `docs/lecture/step-N.md`의 목표와 코드 흐름을 먼저 확인합니다.
4. `npm start`로 현재 단계의 예제를 실행합니다.
5. 문서의 연습 문제를 직접 수정하고 다시 실행합니다.
6. 다음 브랜치로 이동해 이전 단계에서 무엇이 달라졌는지 비교합니다.

```bash
git switch step-1
npm start
```

## 실행 환경

- Node.js 22.13 이상
- RDBMS 과정: Node.js 기본 `node:sqlite` 모듈
- MongoDB 과정: MongoDB 서버 또는 MongoDB Atlas, MongoDB Node.js Driver

RDBMS 단계는 별도 데이터베이스 설치 없이 실행됩니다. SQLite 파일은 `data/` 아래에 생성되고 Git에는 포함되지 않습니다.

MongoDB 단계에서는 환경 변수 예시를 복사합니다.

```bash
cp .env.example .env
npm ci
npm start
```

기본 데이터베이스 이름은 `database_study_course`입니다. 실습 코드는 안전을 위해 `database_study_`로 시작하지 않는 데이터베이스 이름을 거부합니다.

## 프로젝트 구조

```text
.
├── AGENTS.md
├── README.md
├── index.js
├── package.json
├── docs/
│   ├── basic/
│   └── lecture/
├── lib/              # MongoDB 단계부터 추가
└── data/             # 실행 중 생성되는 SQLite 파일
```

## 문서 구조

- `docs/basic/`: 데이터베이스 개념을 코드 실행 전에 읽는 선수 자료
- `docs/lecture/`: 현재 브랜치에서 직접 수행할 단계별 실습 자료
- `README.md`: 전체 과정, 브랜치 체인, 실행 환경 안내

## 안전 원칙

- SQLite 예제는 `data/` 안의 강의용 파일만 초기화합니다.
- MongoDB 예제는 `MONGODB_DB`로 지정한 강의용 데이터베이스만 사용합니다.
- 실제 서비스 데이터베이스 주소를 `.env`에 넣지 않습니다.
- 수정·삭제 전에 조회 조건과 대상 개수를 먼저 확인합니다.
- `.env`와 생성된 데이터 파일은 Git에 커밋하지 않습니다.
