# Step 1. 데이터베이스와 RDBMS 기초

1일차에는 SQLite 데이터베이스 파일과 `members` 테이블을 만듭니다. 데이터 생성 전 확인, 제약조건 오류 읽기, 저장 결과 조회를 이후 실습에서도 같은 순서로 반복합니다.

## 0. 먼저 생각할 질문

수업이 끝나면 다음 질문에 답합니다.

1. 단순 JSON 파일 대신 DBMS를 사용하는 이유는 무엇인가?
2. 테이블, 행, 열, 스키마, 기본 키는 실제 회원 데이터에서 무엇인가?
3. 데이터 규칙을 JavaScript뿐 아니라 데이터베이스 제약조건에도 두는 이유는 무엇인가?
4. 입력값을 SQL 문자열에 붙이지 않고 플레이스홀더로 전달하는 이유는 무엇인가?
5. 실행 성공 메시지 외에 저장 결과를 무엇으로 검증할 것인가?

## 1. 수업 목표

### 개념

- 데이터, 데이터베이스, DBMS, RDBMS, SQLite를 구분합니다.
- 테이블, 행, 열, 스키마, 인스턴스, 기본 키를 설명합니다.
- `INTEGER`, `TEXT`, `NULL`, 기본값의 의미를 설명합니다.
- `PRIMARY KEY`, `AUTOINCREMENT`, `NOT NULL`, `UNIQUE`, `DEFAULT`의 역할을 설명합니다.

### 실습

- Node.js 버전과 현재 Git 브랜치를 확인합니다.
- 현재 단계 전용 SQLite 파일을 만들고 안전하게 초기화합니다.
- `CREATE TABLE`로 스키마를 정의합니다.
- prepared statement와 플레이스홀더로 여러 행을 생성합니다.
- `PRAGMA table_info`와 `SELECT`로 구조와 데이터를 검증합니다.
- 제약조건을 의도적으로 위반하고 오류 원인을 설명합니다.

### 작업 원칙

- 실행 전에 예상 결과를 적습니다.
- 오류 메시지를 지우지 않고 어떤 규칙이 작동했는지 읽습니다.
- 현재 단계 전용 데이터만 초기화합니다.
- 변경 후 반드시 다시 조회합니다.

## 2. 수업 결과물

다음 결과물을 남깁니다.

- `npm start` 기준 실행 결과
- `members` 스키마를 자신의 말로 설명한 표
- 정상 INSERT 1회와 `UNIQUE` 실패 1회의 관찰 기록
- `phone` 또는 `membership_level`을 추가한 확장 스키마
- 조건 SELECT 세 가지와 예상/실제 행 수
- 10문항 형성평가 답안과 한 문장 회고

## 3. 시작 전 준비

### 3.1 브랜치와 작업 상태

> Windows 11에서는 [환경 준비](../windows-11.md)를 먼저 확인합니다. `git`, `node`, `npm` 명령은 PowerShell에서도 같습니다. `npm.ps1` 오류가 나면 `npm.cmd`를 사용합니다.

```bash
git switch step-1
git branch --show-current
git status
```

예상 브랜치는 `step-1`입니다. 이전 개인 수정이 있다면 무작정 삭제하지 말고 별도로 보관한 뒤 수업 기준 상태를 준비합니다.

### 3.2 실행 환경

```bash
node --version
npm run check
npm start
```

- Node.js는 22.13 이상이어야 합니다.
- `npm run check`는 JavaScript 문법을 확인합니다.
- `npm start`는 현재 단계 전용 `data/library-step-1.sqlite`를 다시 만듭니다.

### 3.3 파일 안전 범위

오늘 코드가 삭제할 수 있는 파일은 다음 하나뿐입니다.

```text
data/library-step-1.sqlite
```

다른 SQLite 파일, 다른 프로젝트 파일, 실제 서비스 데이터베이스를 사용하지 않습니다. 초기화 코드를 수정할 때 경로를 먼저 출력하고 현재 단계 파일인지 확인합니다.

## 4. 360분 시간표

| 시간 | 블록 | 내용 | 필수 결과 |
| --- | --- | --- | --- |
| 00:00~01:00 | 1교시 | 데이터·파일·DBMS·RDBMS | 저장 방식 비교표와 용어 설명 |
| 01:00~02:00 | 2교시 | 테이블/행/열/스키마/키 | 회원 데이터 표와 키 선택 근거 |
| 02:00~03:00 | 3교시 | SQLite 파일, 연결, 초기화, PRAGMA | 기준 코드 흐름도와 안전 경계 확인 |
| 03:00~04:00 | 4교시 | CREATE TABLE, 타입, 제약조건 | 스키마 해부와 실패 예제 |
| 04:00~05:00 | 5교시 | INSERT, prepared statement, 결과 ID | 정상·경계·중복 입력 기록 |
| 05:00~06:00 | 6교시 | PRAGMA, SELECT, 조건 조회, 미니 실습 | 확장 테이블·조회·형성평가 |

---

# 1교시. 데이터, 파일, DBMS — 60분

## 1-1. 도입 질문 — 10분

다음 상황을 개인별로 2분 생각하고 짝과 비교합니다.

> 회원 10명의 이름과 email을 저장해야 합니다. 다음 달에는 10만 명이 되고, 여러 직원이 동시에 회원을 등록합니다. 같은 email은 허용하지 않습니다. 무엇이 달라져야 할까요?

예상 답을 “저장”, “검색”, “규칙”, “동시성”, “복구” 다섯 열로 나눠 적습니다.

| 관점 | 10명 JSON 파일 | 10만 명·동시 등록 |
| --- | --- | --- |
| 저장 | 파일 전체를 다시 써도 부담이 작음 | 부분 변경과 안전한 기록 필요 |
| 검색 | 배열 전체 순회 가능 | 인덱스와 효율적인 조건 조회 필요 |
| 규칙 | 코드의 `if`로 검사 가능 | 모든 저장 경로의 최종 제약 필요 |
| 동시성 | 한 명이 실행 | 같은 email 동시 등록 충돌 가능 |
| 복구 | 백업 파일 복사 | 일관된 상태와 복구 절차 필요 |

## 1-2. 개념 설명 — 15분

데이터베이스는 단순한 파일 이름이 아니라 일정한 구조와 규칙으로 관리되는 데이터 모음입니다. DBMS는 애플리케이션의 요청을 받아 저장·조회·변경·제약·동시성·복구를 담당하는 소프트웨어입니다.

오늘 구성은 다음과 같습니다.

```text
학습자
  ↓ npm start
Node.js index.js
  ↓ SQL
SQLite DBMS library
  ↓
data/library-step-1.sqlite
```

Node.js 코드가 직접 파일 바이트 위치를 계산하지 않습니다. `CREATE TABLE`, `INSERT`, `SELECT`라는 SQL로 의도를 전달하고 SQLite가 파일을 관리합니다.

## 1-3. 분류 활동 — 15분

다음 사례에서 단순 파일과 DBMS 중 어느 쪽이 더 자연스러운지 선택하고 이유를 한 줄로 적습니다. 정답은 하나가 아닐 수 있으며 조건을 함께 말해야 합니다.

1. 애플리케이션의 색상 설정 5개
2. 하루 100만 건의 주문과 결제 상태
3. 다른 회사에 전달할 월간 매출 CSV
4. 여러 상담원이 동시에 수정하는 고객 정보
5. 빌드가 생성한 정적 HTML 파일
6. 중복 계정을 막아야 하는 회원 정보

<details>
<summary>토론 기준</summary>

- 설정과 정적 결과물은 파일이 단순할 수 있습니다.
- 주문·고객·회원은 검색, 관계, 규칙, 동시 변경 요구 때문에 DBMS가 자연스럽습니다.
- 월간 매출의 원본은 DB에 있고 전달 형식으로 CSV를 생성할 수 있습니다. 파일과 DBMS는 서로 배타적이지 않습니다.

</details>

## 1-4. 용어 카드 — 10분

다섯 용어를 정의와 연결합니다.

| 용어 | 오늘의 예 |
| --- | --- |
| 데이터 | `"김민지"`, `"minji@example.com"` |
| 데이터베이스 | 회원 행들이 저장된 `library-step-1.sqlite`의 논리 데이터 |
| DBMS | SQLite |
| application | `index.js` |
| 쿼리/명령 | `SELECT`, `INSERT` 등 SQL |

## 1-5. 확인 — 10분

다음 문장을 완성합니다.

- JSON 파일도 데이터를 저장할 수 있지만, ______ 요구가 커지면 DBMS가 유리하다.
- `library-step-1.sqlite`는 ______이고 SQLite는 이를 관리하는 ______이다.
- SQL은 파일의 바이트 위치가 아니라 원하는 데이터 ______을 표현한다.

### 1교시 체크포인트

- [ ] 데이터베이스와 DBMS를 구분해 말했습니다.
- [ ] 파일이 적합한 사례와 DBMS가 적합한 사례를 하나씩 들었습니다.
- [ ] 오늘 코드·DBMS·파일의 흐름을 그렸습니다.

---

# 2교시. 관계형 데이터의 구조 — 60분

## 2-1. 표를 직접 읽기 — 10분

```text
members
+----+--------+---------------------+---------------------+
| id | name   | email               | joined_at           |
+----+--------+---------------------+---------------------+
|  1 | 김민지 | minji@example.com   | 2026-07-01 09:00:00 |
|  2 | 이준호 | junho@example.com   | 2026-07-02 10:30:00 |
+----+--------+---------------------+---------------------+
```

다음 질문에 정확한 위치와 값으로 답합니다.

1. 테이블 이름은 무엇인가?
2. 행는 몇 개인가?
3. 열은 몇 개인가?
4. `id=2`인 행의 email은 무엇인가?
5. 한 행은 무엇을 나타내는가?

## 2-2. 테이블, 행, 열 — 15분

### 테이블

같은 종류의 사실을 모읍니다. `members`의 한 행은 회원 한 명이라는 동일한 의미를 가져야 합니다. 첫 행은 회원, 둘째 행은 도서를 저장하는 식으로 섞지 않습니다.

### 행

한 개체 또는 사건 한 건입니다. `members`에서는 회원 한 명, 이후 `loans`에서는 대출 사건 한 번이 행입니다.

### 열

모든 행이 공유하는 속성과 규칙입니다. 이름뿐 아니라 타입, 필수 여부, 고유성, 기본값이 스키마에 포함됩니다.

### 스키마와 state

```text
schema: id는 INTEGER PK, email은 TEXT UNIQUE
state: 현재 김민지·이준호 두 행이 저장됨
```

스키마가 동일해도 INSERT/DELETE에 따라 state는 계속 변합니다.

## 2-3. 좋은 열 설계 — 10분

다음 회원 객체를 테이블 열으로 옮깁니다.

```js
{
  name: "박서연",
  email: "seoyeon@example.com",
  phone: null,
  isActive: true,
}
```

질문:

- `phone`은 필수인가?
- `isActive`의 기본값은 무엇인가?
- email은 중복 가능해야 하는가?
- 이름은 고유한가?
- 가입 시각은 누가 입력하는가?

설계는 값의 모양만 복사하는 작업이 아니라 업무 규칙을 결정하는 작업입니다.

## 2-4. 기본 키 선택 — 15분

후보를 비교합니다.

| 후보 | 장점 | 문제 |
| --- | --- | --- |
| `name` | 사람이 읽기 쉬움 | 동명이인, 이름 변경 |
| `email` | 업무상 중복 금지 | 변경 가능, 길고 외부 노출 값 |
| 자동 증가 `id` | 짧고 안정적, 내부 관계에 편리 | 자체 업무 의미는 없음 |

오늘은 `id`를 기본 키로 선택하고 email에는 `UNIQUE`를 둡니다. 식별과 업무 고유성의 책임을 나눕니다.

### 변형 문제

다음 데이터의 키 후보와 이유를 적습니다.

- 상품: 내부 `id`, SKU, 상품명
- 학생: 내부 `id`, 학번, 이름
- 공연 좌석: 공연 ID, 좌석 코드

공연 좌석은 `(performance_id, seat_code)` 조합이 고유하다는 점을 발견하는 것이 목표입니다.

## 2-5. NULL, 빈 문자열, 0 — 10분

다음 상태를 구분합니다.

```text
phone = NULL       전화번호가 없음/미입력
phone = ''         빈 문자열을 값으로 저장
stock = 0          재고를 알고 있고 0권
stock = NULL       재고를 알 수 없음
```

NULL을 허용할지는 “아직 모름” 상태가 업무적으로 존재하는지 보고 결정합니다.

### 2교시 체크포인트

- [ ] 한 행가 무엇을 의미하는지 설명했습니다.
- [ ] 스키마와 현재 데이터 state를 구분했습니다.
- [ ] name 대신 id를 PK로 선택한 이유를 말했습니다.
- [ ] NULL과 빈 문자열을 구분했습니다.

---

# 3교시. SQLite 파일과 기준 코드 흐름 — 60분

## 3-1. 전체 코드를 먼저 지도처럼 읽기 — 10분

`index.js`를 실행하지 않고 다음 여섯 구간을 찾아 줄 옆에 번호를 적습니다.

1. 모듈 불러오기
2. 전용 경로 만들기
3. 기존 실습 파일 초기화
4. SQLite 연결과 설정
5. 스키마와 데이터 만들기
6. 구조·행 검증과 연결 종료

코드를 위에서 아래로 읽되, 각 구간의 입력·출력·부작용을 적습니다.

## 3-2. 경로 만들기 — 10분

```js
const fs = require("fs")
const path = require("path")

const dataDir = path.join(__dirname, "data")
const databasePath = path.join(dataDir, "library-step-1.sqlite")
```

- `__dirname`: 현재 `index.js`가 있는 절대 디렉터리
- `path.join`: 운영체제에 맞는 경로 결합
- `dataDir`: 실습 결과를 모으는 폴더
- `databasePath`: 오늘 단계만의 파일

### 관찰 실습

연결 전에 임시로 다음 로그를 넣고 실행합니다.

```js
console.log({ dataDir, databasePath })
```

출력 경로가 현재 저장소의 `data/library-step-1.sqlite`인지 확인하고 로그를 제거합니다.

## 3-3. 반복 가능한 초기 상태 — 10분

```js
fs.mkdirSync(dataDir, { recursive: true })

if (fs.existsSync(databasePath)) {
  fs.rmSync(databasePath)
}
```

수업에서는 매번 같은 세 회원으로 시작해야 결과를 함께 비교할 수 있습니다. 그래서 현재 단계 파일만 삭제하고 다시 만듭니다.

주의할 점:

- `dataDir` 전체를 재귀 삭제하지 않습니다.
- 사용자 입력으로 받은 임의 경로를 삭제하지 않습니다.
- `library-step-2.sqlite` 등 다른 단계 파일을 삭제하지 않습니다.
- 실제 서비스에서 시작할 때 데이터베이스를 삭제하는 코드를 사용하지 않습니다.

## 3-4. SQLite 연결 — 10분

```js
const { DatabaseSync } = require("node:sqlite")
const database = new DatabaseSync(databasePath)
database.exec("PRAGMA foreign_keys = ON")
```

`DatabaseSync`는 동기 API입니다. SQL 실행이 끝날 때까지 다음 코드로 넘어가지 않아 첫 학습에서 흐름을 보기 쉽습니다. 2일차부터 사용할 외래 키 검사를 연결 직후 켭니다. SQLite는 연결마다 이 설정이 필요합니다.

## 3-5. 실행 전후 파일 관찰 — 10분

```bash
rm data/library-step-1.sqlite
ls -l data
npm start
ls -l data/library-step-1.sqlite
```

PowerShell에서는 다음 명령을 사용합니다.

```powershell
Remove-Item data/library-step-1.sqlite
Get-Item data
npm.cmd start
Get-Item data/library-step-1.sqlite
```

첫 `rm`은 현재 단계 전용 파일에만 사용합니다. 파일이 없다는 메시지가 나와도 괜찮습니다. `npm start` 뒤 SQLite 파일이 다시 생기는지 확인합니다.

### 예상

- 실행 전 파일이 없을 수 있습니다.
- `new DatabaseSync(databasePath)` 이후 파일이 생깁니다.
- 전체 코드가 끝나면 회원 세 행이 저장되어 있습니다.

## 3-6. 코드 흐름 설명 — 10분

짝에게 다음 문장을 완성해 설명합니다.

> `npm start`를 실행하면 먼저 ______를 준비하고 현재 단계 파일을 ______한다. 그다음 `DatabaseSync`로 ______하고, SQL로 ______와 ______를 만든다. 마지막에는 ______와 ______를 조회해 검증하고 연결을 닫는다.

### 3교시 체크포인트

- [ ] 코드의 여섯 구간을 표시했습니다.
- [ ] 삭제 대상 파일의 절대 경로를 확인했습니다.
- [ ] 매 실행마다 상태를 초기화하는 교육적 이유를 설명했습니다.
- [ ] `database` 객체가 연결 역할을 한다고 설명했습니다.

---

# 4교시. CREATE TABLE과 제약조건 — 60분

## 4-1. SQL 문장을 절별로 읽기 — 15분

```sql
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

### `CREATE TABLE members`

`members`라는 테이블 스키마를 만듭니다. 같은 이름의 테이블이 이미 있으면 오류가 납니다. 오늘은 파일을 매번 새로 만들기 때문에 `IF NOT EXISTS`가 필요하지 않습니다. 오류를 숨기지 않고 초기화 흐름이 잘못됐을 때 발견하기 위한 선택입니다.

### `id INTEGER PRIMARY KEY AUTOINCREMENT`

- 정수 식별자입니다.
- 모든 행에서 고유합니다.
- INSERT에서 생략하면 SQLite가 값을 만듭니다.
- AUTOINCREMENT는 이전에 사용한 큰 값보다 큰 값을 선택하도록 하는 SQLite 동작이 포함됩니다.

`AUTOINCREMENT`를 모든 테이블에 무조건 사용해야 한다는 뜻은 아닙니다. 오늘은 생성 ID 흐름을 명확히 보기 위한 선택입니다.

### `name TEXT NOT NULL`

NULL은 막지만 빈 문자열 `''`까지 자동으로 막지는 않습니다. 빈 문자열을 금지하려면 애플리케이션 검증이나 `CHECK (length(trim(name)) > 0)` 같은 추가 규칙을 검토합니다.

### `email TEXT NOT NULL UNIQUE`

email이 반드시 존재하고 다른 행과 중복되지 않아야 합니다. 대소문자를 같은 email로 볼지, 앞뒤 공백을 어떻게 처리할지는 추가 정책입니다.

### `joined_at ... DEFAULT CURRENT_TIMESTAMP`

INSERT에서 가입 시각을 생략하면 SQLite의 현재 시각 문자열이 들어갑니다. 출력 시각대가 로컬 기대와 다를 수 있으므로 저장 기준과 표시 기준을 구분합니다.

## 4-2. 스키마 예측표 — 10분

실행 전 표를 채웁니다.

| 열 | type | NULL 허용 | 고유 | 생략 시 값 |
| --- | --- | --- | --- | --- |
| id | INTEGER | 아니오 | PK | 자동 생성 |
| name | TEXT | 아니오 | 아니오 | 없음, 오류 |
| email | TEXT | 아니오 | 예 | 없음, 오류 |
| joined_at | TEXT | 아니오 | 아니오 | 현재 시각 |

## 4-3. 구조 확인 — 10분

```js
const columns = database
  .prepare("PRAGMA table_info(members)")
  .all()

console.table(columns)
```

주요 출력 필드:

- `cid`: 열 순서
- `name`: 열 이름
- `type`: 선언 타입
- `notnull`: NOT NULL 여부
- `dflt_value`: 기본값
- `pk`: 기본 키 구성 여부

`UNIQUE`는 `PRAGMA table_info`만으로 모두 보이지 않으므로 필요하면 `PRAGMA index_list(members)`도 확인합니다.

## 4-4. 의도된 실패 실험 — 15분

기준 코드를 직접 망가뜨린 상태로 남기지 않도록, INSERT 구간 뒤에 임시 코드를 넣고 오류를 `try/catch`로 관찰한 뒤 제거합니다.

### NULL name

```js
try {
  insertMember.run(null, "null-name@example.com")
} catch (error) {
  console.log("NOT NULL 확인:", error.message)
}
```

### 중복 email

```js
try {
  insertMember.run("다른 민지", "minji@example.com")
} catch (error) {
  console.log("UNIQUE 확인:", error.message)
}
```

### 빈 이름

```js
insertMember.run("", "blank-name@example.com")
```

빈 이름은 현재 스키마에서 저장됩니다. `NOT NULL`이 빈 문자열을 막는다고 오해하지 않습니다. 이 관찰을 바탕으로 다음 확장 제약을 토론합니다.

```sql
name TEXT NOT NULL CHECK (length(trim(name)) > 0)
```

## 4-5. 다른 도메인 스키마 — 10분

다음 요구사항을 SQL 열으로 바꿉니다.

> 상품은 자동 ID, 중복되지 않는 SKU, 필수 이름, 0 이상의 가격과 재고를 가진다. 등록 시각은 생략하면 현재 시각이다.

<details>
<summary>예시 답안</summary>

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

금액을 정수 최소 단위로 저장할지 실수/decimal을 사용할지는 제품과 통화 요구에 따라 별도로 판단합니다.

</details>

### 4교시 체크포인트

- [ ] 각 열 선언을 한 항목씩 설명했습니다.
- [ ] NOT NULL과 빈 문자열을 구분했습니다.
- [ ] UNIQUE 오류를 실제로 관찰했습니다.
- [ ] PRAGMA 출력과 SQL 선언을 연결했습니다.

---

# 5교시. INSERT와 prepared statement — 60분

## 5-1. SQL 구조와 값 분리 — 15분

```js
const insertMember = database.prepare(`
  INSERT INTO members (name, email)
  VALUES (?, ?)
`)
```

`?`는 나중에 전달할 값의 자리입니다.

```js
insertMember.run("김민지", "minji@example.com")
```

SQL 구조는 `INSERT INTO ... VALUES (?, ?)`로 고정되고 이름과 email은 데이터로 전달됩니다.

피해야 할 예:

```js
database.exec(
  `INSERT INTO members (name, email) VALUES ('${name}', '${email}')`,
)
```

이름에 작은따옴표가 들어가면 SQL이 깨질 수 있고, 신뢰할 수 없는 입력이 SQL 구조로 해석될 위험이 있습니다. 플레이스홀더는 데이터와 명령 구조를 분리합니다.

## 5-2. 배열 데이터 반복 생성 — 10분

```js
const members = [
  ["김민지", "minji@example.com"],
  ["이준호", "junho@example.com"],
  ["박서연", "seoyeon@example.com"],
]

for (const member of members) {
  const result = insertMember.run(...member)
  console.log(`member id=${result.lastInsertRowid} 생성`)
}
```

`member`는 `[name, email]`이고 `...member`는 두 인자로 펼쳐집니다. 배열 순서와 SQL 플레이스홀더 순서가 같아야 합니다.

## 5-3. 결과 객체 읽기 — 10분

`run()` 결과의 `lastInsertRowid`는 방금 생성된 행의 ID입니다. “성공” 문자열만 출력하지 않고 실제 생성 식별자를 기록합니다.

예상:

```text
member id=1 생성
member id=2 생성
member id=3 생성
```

파일을 매번 초기화하므로 기준 실행에서는 ID가 다시 1부터 시작합니다. 운영 시스템에서 ID가 항상 연속이라는 가정은 하지 않습니다. 실패, 삭제, 동시 실행 때문에 빈 번호가 생길 수 있습니다.

## 5-4. 안내 실습 A — 정상 데이터 추가 10분

배열에 다음 회원을 추가합니다.

```js
["최하늘", "haneul@example.com"]
```

실행 전 예상:

- 생성 로그: 4개
- 마지막 ID: 4
- SELECT 결과: 4행
- joined_at: 직접 전달하지 않아도 존재

```bash
npm start
```

예상과 실제를 기록합니다.

## 5-5. 안내 실습 B — 따옴표가 있는 값 5분

다음 회원 이름을 추가합니다.

```js
["O'Brian", "obrian@example.com"]
```

플레이스홀더를 사용하므로 작은따옴표가 SQL 종료 기호로 오해되지 않고 값으로 저장되는지 확인합니다.

## 5-6. 안내 실습 C — 중복과 원자성 관찰 10분

배열 마지막에 기존 email을 넣으면 앞의 행은 이미 생성된 뒤 마지막 INSERT에서 오류가 나고 프로그램은 종료될 수 있습니다.

```js
["중복 회원", "minji@example.com"]
```

질문:

1. 오류 전의 INSERT는 남아 있을까?
2. 이후 SELECT까지 실행될까?
3. 여러 INSERT를 모두 성공/취소하려면 무엇이 필요할까?

3일차의 트랜잭션으로 연결되는 질문입니다. 오늘 기준 코드는 실행마다 파일을 다시 만들기 때문에 다음 실행에서 상태가 초기화됩니다.

### 5교시 체크포인트

- [ ] 플레이스홀더와 실제 값의 순서를 설명했습니다.
- [ ] 문자열 연결 방식의 문제를 설명했습니다.
- [ ] `lastInsertRowid`를 확인했습니다.
- [ ] 정상, 특수문자, 중복 입력을 각각 관찰했습니다.

---

# 6교시. SELECT, 검증, 미니 실습 — 60분

## 6-1. 전체 조회 읽기 — 10분

```js
database
  .prepare(`
    SELECT id, name, email, joined_at
    FROM members
    ORDER BY id
  `)
  .all()
```

- `SELECT`: 반환할 열
- `FROM`: 읽을 테이블
- `ORDER BY id`: 결과 순서
- `all()`: 일치하는 모든 행을 배열로 반환

SQL 테이블 자체에는 화면 표시 순서가 보장되지 않습니다. 순서가 요구사항이면 `ORDER BY`를 명시합니다.

## 6-2. 조건 조회 안내 실습 — 10분

### ID로 한 행

```js
const member = database
  .prepare("SELECT id, name, email FROM members WHERE id = ?")
  .get(2)

console.log(member)
```

`get()`은 첫 행 하나 또는 `undefined`를 반환합니다.

### email 도메인으로 여러 행

```js
const rows = database
  .prepare(`
    SELECT id, name, email
    FROM members
    WHERE email LIKE ?
    ORDER BY name
  `)
  .all("%@example.com")
```

실행 전에 결과 행 수와 순서를 적습니다.

## 6-3. 스키마 확장 미니 실습 — 20분

다음 요구사항 중 하나를 선택합니다.

### 경로 A: 선택 전화번호

```sql
phone TEXT
```

- 기존 INSERT에서 phone을 생략할 수 있습니다.
- 한 회원에게만 phone을 저장합니다.
- `phone IS NULL`인 회원을 조회합니다.

### 경로 B: 회원 등급

```sql
membership_level TEXT NOT NULL DEFAULT 'basic'
  CHECK (membership_level IN ('basic', 'premium'))
```

- 기존 INSERT는 자동으로 `basic`이 됩니다.
- premium 회원 한 명을 추가합니다.
- `vip`를 넣어 CHECK 오류를 관찰합니다.

### 경로 C: 활성 상태

```sql
is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
```

- SQLite에서 boolean을 0/1 정수로 표현합니다.
- 비활성 회원만 조회합니다.

실습 후 다음 네 증거를 제출합니다.

1. 변경한 CREATE TABLE 일부
2. `PRAGMA table_info(members)` 결과
3. 정상 INSERT 또는 UPDATE 결과
4. 조건 SELECT 결과

## 6-4. 독립 변형 — 10분

도서가 아닌 다음 중 하나의 테이블을 종이에 설계합니다.

- `products`: SKU, 이름, 가격, 재고
- `students`: 학번, 이름, 입학 연도
- `rooms`: 방 코드, 수용 인원, 사용 가능 여부

최소 조건:

- 자동 ID 기본 키
- 업무상 UNIQUE 값 하나
- NOT NULL 값 두 개
- DEFAULT 하나
- CHECK 하나

짝과 스키마를 바꿔 읽고, 어떤 잘못된 값을 막는지 설명합니다.

## 6-5. 기준 코드 복원과 최종 실행 — 5분

수업 중 임시 실패 코드가 남아 있다면 제거합니다. 개인 확장은 별도 메모나 커밋으로 보관하고 기준 실행이 성공하는지 확인합니다.

```bash
npm run check
npm start
```

## 6-6. 출구 티켓 — 5분

1. `NOT NULL`인데도 빈 문자열이 들어가는 이유는?
2. `lastInsertRowid`와 `SELECT`가 각각 주는 검증 증거는?
3. 내일 여러 테이블로 나누면 어떤 중복을 줄일 수 있을까?

---

# 7. 코드 전체 흐름 상세 해설

수업 중 놓친 부분을 복습할 때 사용합니다.

## 7-1. 모듈

```js
const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
```

- `fs`: 디렉터리와 파일 존재 확인·삭제
- `path`: 안전한 경로 조합
- `DatabaseSync`: SQLite 연결과 SQL 실행

## 7-2. 데이터베이스 생명주기

```text
경로 결정
  → 디렉터리 생성
  → 현재 단계 파일 제거
  → 연결(새 파일 생성)
  → schema 생성
  → data 생성
  → schema 조회
  → data 조회
  → 연결 종료
```

실행을 반복하면 같은 생명주기를 처음부터 다시 시작합니다.

## 7-3. `exec`, `prepare`, `run`, `all`

| API | 오늘 사용 목적 | 반환 활용 |
| --- | --- | --- |
| `database.exec(sql)` | PRAGMA와 CREATE TABLE 실행 | 반환 행을 사용하지 않음 |
| `database.prepare(sql)` | 재사용하거나 값을 바인딩할 SQL 준비 | statement 반환 |
| `statement.run(values)` | INSERT 실행 | ID와 변경 건수 |
| `statement.all(values)` | 여러 행 조회 | 객체 배열 |
| `statement.get(values)` | 확장 실습의 한 행 조회 | 객체 하나/undefined |

SQL 종류만 보고 API를 기계적으로 고르지 말고 결과 행이 필요한지, 반복 값 바인딩이 필요한지 봅니다.

## 7-4. 연결 종료

```js
database.close()
```

모든 조회 뒤 연결을 닫습니다. 종료 뒤 같은 `database` 객체로 SQL을 실행할 수 없습니다. 실제 애플리케이션에서는 오류가 나도 자원이 정리되도록 `try/finally` 같은 구조를 검토합니다.

---

# 8. 추가 예제 모음

## 예제 A. email 일부 필드만 조회

```sql
SELECT name, email
FROM members
ORDER BY email ASC;
```

`SELECT *`가 편해도 화면에 필요하지 않은 필드를 항상 가져올 필요는 없습니다.

## 예제 B. 가입 순서 역순

```sql
SELECT id, name, joined_at
FROM members
ORDER BY id DESC;
```

동일한 시각이 있을 수 있어 오늘 데이터에서는 자동 ID를 가입 순서 대용으로 관찰하지만, 일반적으로 업무 순서를 정확히 표현하는 열을 사용합니다.

## 예제 C. 특정 이름

```sql
SELECT id, name, email
FROM members
WHERE name = ?;
```

name은 고유하지 않으므로 여러 행이 나올 수 있습니다. 한 사람 식별 조건으로 오해하지 않습니다.

## 예제 D. 빈 문자열 방지

```sql
name TEXT NOT NULL CHECK (length(trim(name)) > 0)
```

`trim()` 뒤 길이가 0보다 커야 하므로 `''`와 `'   '`을 막습니다.

## 예제 E. 대소문자 email 정책 토론

`Minji@example.com`과 `minji@example.com`을 같은 값으로 볼지 정책이 필요합니다. 입력을 소문자로 정규화하거나 collation/함수 기반 고유성 등 제품별 방법을 검토할 수 있습니다. 오늘은 원리를 벗어나지 않도록 “현재 UNIQUE가 실제로 어떤 값을 다르게 보는지 실험한다”까지만 수행합니다.

---

# 9. 연습 문제

## 기초

1. 네 번째 회원을 추가하고 ID와 전체 행 수를 기록합니다.
2. `id=2`인 회원만 조회합니다.
3. 이름 오름차순과 ID 내림차순 결과를 비교합니다.
4. 같은 email을 두 번 넣고 오류 메시지에서 테이블과 열 이름을 찾습니다.
5. `joined_at`을 직접 입력하지 않았는데 값이 생긴 이유를 설명합니다.

## 응용

6. `phone TEXT`를 추가하고 NULL 회원만 조회합니다.
7. 이름의 빈 문자열을 막는 CHECK를 추가합니다.
8. 회원 등급을 `basic`, `premium`으로 제한합니다.
9. `PRAGMA index_list(members)`로 UNIQUE email 인덱스를 관찰합니다.
10. prepared statement를 쓰지 않은 문자열 연결 예제가 작은따옴표 이름에서 실패하는 이유를 설명합니다.

## 도전

11. 여러 회원 INSERT를 트랜잭션으로 묶으면 중복 email이 마지막에 있을 때 어떤 상태를 만들고 싶은지 의사코드로 적습니다.
12. `created_at`과 `updated_at`이 모두 필요한 이유를 생각합니다.
13. 회원 삭제 기능을 만든다면 실행 전에 어떤 정보를 보여줄지 목록을 적습니다.
14. products 테이블을 실제로 추가하고 정상·CHECK 실패 INSERT를 각각 실행합니다.
15. 입력 email의 앞뒤 공백을 허용할지, 소문자를 강제할지 정책과 구현 위치를 제안합니다.

<details>
<summary>힌트</summary>

- 한 행은 `get()`, 여러 행은 `all()`을 사용할 수 있습니다.
- NULL 비교는 `= NULL`이 아니라 `IS NULL`입니다.
- CHECK는 `CHECK (length(trim(name)) > 0)` 모양을 참고합니다.
- 트랜잭션은 3일차에 `BEGIN → 여러 INSERT → COMMIT`, 오류 시 `ROLLBACK`으로 배웁니다.
- email 정규화는 입력 변환과 DB 고유성 규칙이 서로 일치해야 합니다.

</details>

---

# 10. 자주 만나는 문제와 진단 순서

## `node:sqlite`를 찾을 수 없습니다

```bash
node --version
which node
```

PowerShell에서는 다음 명령을 사용합니다.

```powershell
node --version
(Get-Command node).Source
```

Node.js 22.13 이상인지 확인합니다. IDE 터미널과 일반 터미널이 다른 Node.js를 사용할 수도 있습니다.

## `no such table: members`

- CREATE TABLE보다 SELECT가 먼저 실행되지 않았는지 확인합니다.
- 다른 데이터베이스 파일에 연결하지 않았는지 `databasePath`를 출력합니다.
- CREATE TABLE 오류를 위에서 놓치지 않았는지 첫 오류부터 읽습니다.

## `UNIQUE constraint failed`

오류 열이 `members.email`인지 읽습니다. 기준 배열에 같은 email이 두 번 있는지 확인합니다. 오류를 피하려고 UNIQUE를 제거하지 않습니다.

## `NOT NULL constraint failed`

플레이스홀더 순서와 전달한 값 개수를 확인합니다. `name`, `email` 중 어떤 필드가 NULL인지 오류 메시지를 읽습니다.

## 수정한 데이터가 다음 실행에서 사라집니다

오늘 코드는 반복 가능한 수업을 위해 매 실행마다 현재 단계 파일을 삭제합니다. 영속성 기능이 없다는 뜻이 아닙니다. 초기화 코드를 제거하면 파일 상태를 유지할 수 있지만, 오늘 핵심 실습은 동일한 기준 상태 재현입니다.

## ID가 예상과 다릅니다

현재 단계 파일이 정말 초기화됐는지, 임시 INSERT를 추가했는지 확인합니다. 일반 시스템에서 ID 연속성은 업무 규칙이 아니며 ID의 목적은 고유 식별입니다.

## console.테이블에서 시각이 예상과 다릅니다

`CURRENT_TIMESTAMP`의 기준 시간과 사용자 로컬 시간 표시가 다를 수 있습니다. 저장 기준(보통 UTC)과 화면 표시 시간대를 분리하는 주제입니다.

## `database is closed`

`database.close()`보다 뒤에서 statement를 실행하지 않았는지 확인합니다.

---

# 11. 형성평가 — 20점

## 문항

1. 데이터베이스와 DBMS의 차이를 오늘 파일과 제품 이름으로 설명하세요. (2점)
2. 스키마와 현재 state의 차이를 설명하세요. (2점)
3. 기본 키에 이름보다 자동 ID가 적합한 이유 두 가지를 적으세요. (2점)
4. `NOT NULL`과 `UNIQUE`가 각각 막는 오류를 적으세요. (2점)
5. 빈 문자열이 NOT NULL을 통과할 수 있는 이유를 적으세요. (2점)
6. 플레이스홀더 두 개와 `run()` 인자 순서가 다르면 어떤 문제가 생기나요? (2점)
7. `lastInsertRowid`를 확인하는 이유는 무엇인가요? (2점)
8. `PRAGMA table_info`와 `SELECT`가 각각 무엇을 검증하나요? (2점)
9. 현재 단계 파일만 삭제해야 하는 이유를 적으세요. (2점)
10. 새 회원 생성이 성공했음을 증명할 두 가지 결과를 적으세요. (2점)

<details>
<summary>평가 기준</summary>

1. SQLite는 DBMS, `library-step-1.sqlite`는 그 데이터가 저장된 파일이라는 구분이 있어야 합니다.
2. 구조·규칙과 특정 시점의 실제 행을 구분해야 합니다.
3. 동명이인, 이름 변경 가능성 등을 포함합니다.
4. NULL 필수값과 중복값을 각각 구분합니다.
5. 빈 문자열은 NULL이 아니라 TEXT 값입니다.
6. 이름이 email 열으로 가는 등 잘못된 위치에 저장되거나 제약 오류가 납니다.
7. 실제 생성된 행의 식별자를 확인합니다.
8. 스키마와 실제 행을 각각 검증합니다.
9. 다른 단계·실제 데이터를 손상하지 않는 안전 경계입니다.
10. 생성 결과 ID/건수와 같은 ID/email의 사후 SELECT를 제시합니다.

</details>

## 점수 해석

- 17~20점: 2일차 관계 모델링으로 진행
- 13~16점: 키·constraint·prepared statement 실습 한 번 반복
- 9~12점: 스키마 표와 실패 실험을 강사와 다시 수행
- 0~8점: `docs/basic/01-database-rdbms.md`를 읽고 기준 실행부터 재시작

---

# 12. 완료 기준

다음을 모두 수행하면 1일차 필수 경로를 완료한 것입니다.

- [ ] `step-1` 브랜치에서 기준 코드를 실행했습니다.
- [ ] 데이터베이스, DBMS, RDBMS, SQLite를 구분해 설명했습니다.
- [ ] 테이블, 행, 열, 스키마, 기본 키를 회원 데이터에 연결했습니다.
- [ ] 현재 단계 SQLite 파일의 생성과 초기화를 확인했습니다.
- [ ] CREATE TABLE의 각 열과 제약조건을 설명했습니다.
- [ ] prepared statement로 회원을 한 명 이상 추가했습니다.
- [ ] `lastInsertRowid`와 전체 조회로 생성을 검증했습니다.
- [ ] UNIQUE 또는 NOT NULL 실패를 관찰하고 이유를 설명했습니다.
- [ ] PRAGMA로 스키마를 확인했습니다.
- [ ] 조건 SELECT를 두 개 이상 실행했습니다.
- [ ] 확장 스키마 하나를 설계하거나 구현했습니다.
- [ ] 형성평가에서 13점 이상을 받았습니다.

## 회복 경로

시간이 부족하거나 환경 오류가 있었더라도 다음 네 가지는 반드시 완료합니다.

1. 기준 `npm start` 성공
2. `members` 스키마 표 작성
3. 새 회원 한 명 INSERT와 사후 SELECT
4. 중복 email 오류 관찰과 설명

## 확장 경로

진도가 빠르면 다음을 수행합니다.

1. 이름 빈 문자열 CHECK 추가
2. 회원 등급 CHECK 추가
3. `PRAGMA index_list`와 `PRAGMA index_info` 관찰
4. 여러 INSERT 전체를 원자적으로 처리할 트랜잭션 의사코드 작성
5. products 테이블 추가와 실패 입력 매트릭스 실행

## 다음 단계

오늘은 모든 회원 정보를 테이블 하나에 저장했습니다. 2일차에는 저자, 도서, 회원, 대출을 한 테이블에 모두 넣으면 생기는 중복과 이상을 관찰하고 네 테이블로 나눕니다. 다음 질문을 한 문장으로 적어옵니다.

> 회원 한 명이 도서 세 권을 빌릴 때 회원 이름과 email을 대출 행마다 반복 저장하지 않으려면 어떤 연결 정보가 필요할까?
