# Step 1. Database Fundamentals와 RDBMS 기초

## 이번 단계 목표

- 데이터베이스, 테이블, 행, 열의 관계를 설명합니다.
- SQLite 파일을 만들고 테이블 구조를 정의합니다.
- 준비된 SQL에 값을 전달해 행을 생성합니다.
- 테이블 구조와 저장된 행을 직접 조회합니다.

## 시작 전 확인

```bash
git switch step-1
git status
npm start
```

실행할 때마다 `data/library-step-1.sqlite`를 새로 만들기 때문에 같은 결과로 반복 연습할 수 있습니다. 다른 파일이나 기존 프로젝트 데이터는 사용하지 않습니다.

## 프로젝트에서 볼 파일

| 파일 | 역할 |
| --- | --- |
| `index.js` | SQLite 파일, 테이블, 샘플 행을 만드는 실습 코드 |
| `data/library-step-1.sqlite` | 실행 중 생성되는 강의용 데이터베이스 파일 |
| `docs/basic/01-database-rdbms.md` | Database와 RDBMS 선수 자료 |

`data/`의 SQLite 파일은 실행 결과물이므로 Git에 포함되지 않습니다.

## 코드 흐름

### 1. 강의용 파일 준비

```js
fs.mkdirSync(dataDir, { recursive: true })

if (fs.existsSync(databasePath)) {
  fs.rmSync(databasePath)
}
```

항상 같은 초기 상태를 만들기 위해 이 단계 전용 파일만 삭제한 뒤 다시 생성합니다.

### 2. SQLite 연결

```js
const database = new DatabaseSync(databasePath)
database.exec("PRAGMA foreign_keys = ON")
```

`DatabaseSync` 객체가 SQL을 전달하는 연결 역할을 합니다. 외래키 검사는 다음 단계에서 사용하지만 첫 연결부터 켜두는 습관을 들입니다.

### 3. 테이블 만들기

```sql
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

`PRIMARY KEY`, `NOT NULL`, `UNIQUE`, `DEFAULT`가 어떤 잘못된 값을 막는지 한 항목씩 확인합니다.

### 4. 준비된 SQL로 행 생성

```js
const insertMember = database.prepare(`
  INSERT INTO members (name, email)
  VALUES (?, ?)
`)

insertMember.run("김민지", "minji@example.com")
```

SQL 문자열에 직접 값을 이어 붙이지 않고 `?` 자리에 값을 전달합니다.

### 5. 구조와 데이터 조회

```js
database.prepare("PRAGMA table_info(members)").all()
database.prepare("SELECT * FROM members ORDER BY id").all()
```

코드가 성공했다는 메시지만 믿지 않고 실제 테이블과 행을 다시 조회합니다.

## 실행 결과에서 확인할 것

- `members` 테이블에 네 개의 column이 보입니다.
- 세 명의 회원이 서로 다른 `id`를 가집니다.
- `joined_at`은 입력하지 않아도 기본값이 들어갑니다.
- 실행 후 `data/library-step-1.sqlite` 파일이 생깁니다.

## 직접 해볼 연습

1. 회원 한 명을 더 추가합니다.
2. `members`에 `phone TEXT` column을 추가해봅니다.
3. 같은 email을 두 번 넣고 `UNIQUE` 제약조건 오류를 확인합니다.
4. 마지막 `SELECT`에서 `name`이 특정 값인 행만 조회합니다.

## 자주 만나는 문제

### `node:sqlite`를 찾을 수 없습니다

Node.js 22.13 이상인지 `node --version`으로 확인합니다.

### 이전에 수정한 데이터가 사라집니다

이 단계는 반복 가능한 실습을 위해 시작할 때 강의용 파일을 초기화합니다. 데이터를 유지하는 것이 목표가 아니라 테이블 생성과 조회 흐름을 여러 번 연습하는 것이 목표입니다.

## 완료 기준

- 테이블, 행, 열, primary key를 자신의 말로 설명할 수 있습니다.
- `CREATE TABLE`, `INSERT`, `SELECT`가 각각 무엇을 하는지 구분할 수 있습니다.
- 제약조건 오류가 데이터베이스에서 발생하는 이유를 설명할 수 있습니다.
