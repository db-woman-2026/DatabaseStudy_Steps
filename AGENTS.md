# AGENTS.md

- Preserve the cumulative branch chain: `main -> step-1 -> ... -> step-8`.
- Project-wide changes start on `main` and merge forward one branch at a time.
- Step-specific changes start on the earliest affected `step-N` branch and merge forward sequentially.
- Do not copy the same change into multiple branches as unrelated commits.
- After propagation, verify every adjacent pair with `git merge-base --is-ancestor`.
- Keep this course independent from `NodeStudy_Steps`; Node.js is only the execution runtime.
- Use only the dedicated SQLite files and the MongoDB database named by `MONGODB_DB`.

## 강의 문서 문체

`docs/**/*.md`를 작성하거나 수정할 때 아래 기준을 적용합니다.

### 기본 원칙

- 강사가 학생에게 설명하듯 짧고 분명한 `합니다`체를 사용합니다.
- 한 문장에는 한 가지 내용만 담고, 한 문단은 2~3문장을 넘기지 않습니다.
- 먼저 할 일과 확인할 결과를 적고, 필요한 이유는 그다음에 설명합니다.
- 본문은 한국어를 기본으로 합니다. 제품명, API, 명령, 코드 식별자만 원문을 쓰고 리터럴은 백틱으로 표시합니다.
- 같은 개념은 문서 전체에서 같은 용어로 부릅니다.
- 코드 블록, diff, 명령, 파일명, 링크 대상은 문체 수정 대상으로 삼지 않습니다.
- 수강생이 읽는 문서에는 회차, 권장·예상·소요 시간, 교시, 시간표, 수업 운영안, 강사용 진행 지시를 넣지 않습니다.
- 다른 Markdown 문서를 링크하면 링크 뒤에 인쇄본용 과목명, 대상 장의 H1, 시작 또는 지정 절의 H2를 함께 적습니다.

### 피할 패턴

- `Overview`, `Course`, `Detailed Lecture`처럼 한국어와 영어를 겹쳐 쓴 제목
- `이 문서는 ... 구성합니다`, `이 폴더에는 ... 누적됩니다`처럼 문서 자체를 설명하는 도입부
- 모든 문단에서 반복되는 `이번 단계에서는`, `이 단계가 끝나면`, `직접 경험합니다`
- `단순히 A가 아니라 B`, `핵심은`, `~를 넘어`, `여정`, `완주`, `튼튼한 기반`, `자연스럽게` 같은 상투적 대비와 수사
- 구체적인 동작 없이 쓰는 `할 수 있게 합니다`, `도와줍니다`, `중요합니다`, `살펴봅니다`
- `목표`, `핵심`, `흐름`, `포인트`가 여러 절에서 같은 뜻으로 반복되는 구성
- 필요 이상으로 나눈 `지식/기능/태도`, 산출물, 체크포인트, 회고 목록
- `강력한`, `견고한`, `풍부한`, `원활한`, `효율적인` 같은 근거 없는 평가 표현
- 도구가 사람처럼 판단하거나 기억한다고 쓰는 의인화

### 표현 기준

| 피할 표현 | 권장 표현 |
| --- | --- |
| 이번 스텝 주요 기능 Overview | 이번 단계에서 할 일 |
| 이 문서는 1일차 수업을 그대로 진행할 수 있게 구성합니다. | 1일차에는 테이블을 만들고 저장 결과를 확인합니다. |
| 이번 단계에서는 입력 검증을 추가합니다. | 입력값의 공백과 길이를 검사합니다. |
| 이 단계가 끝나면 화면이 완성되어 있어야 합니다. | 완료 후 화면과 오류 메시지를 확인합니다. |
| 직접 수정할 파일 / 직접 타이핑할 내용 | 수정할 파일 / 입력할 내용 |
| 이전 단계와 달라지는 코드 | 코드 변경 |

### 수정 전후 확인

- 제목과 첫 두 문단을 소리 내어 읽었을 때 수업 안내처럼 들리는지 확인합니다.
- 위의 상투 표현이 새로 들어오지 않았는지 `/docs` 전체에서 검색합니다.
- 설명을 줄인 뒤에도 실행 순서, 예상 결과, 오류 조건이 남아 있는지 확인합니다.
- 코드 블록과 diff가 원본 코드와 같은지 확인합니다.

## Windows 11 전용 문서

- 모든 설치와 실습은 Windows 11 x64, Windows Terminal의 PowerShell을 기준으로 설명합니다.
- 다른 운영체제나 다른 셸의 설치법과 명령 비교표를 넣지 않습니다.
- 명령은 `git`, `node`, 표준 `npm`, `npx`와 PowerShell cmdlet 형식으로 적습니다.
- 신규 PC를 기준으로 Windows Terminal, Node.js LTS, Git for Windows, VS Code, MongoDB Community Server와 mongosh 설치 명령을 빠뜨리지 않습니다.
- 수강생 프로젝트 경로 예시는 `$HOME\dongbu\database-study`를 사용하고 공백 경로, `.env` 복사, UTF-8, 줄바꿈, 방화벽 안내를 확인합니다.
- 운영체제별 npm 실행 래퍼 이름을 교안의 기본 명령으로 사용하지 않습니다.
- MongoDB는 Windows 서비스와 `database_study_` 접두사의 전용 실습 DB만 사용합니다.
- 새 명령 블록은 `powershell`로 표시하고 `/docs` 전체에서 Windows와 맞지 않는 명령을 다시 검색합니다.

## 강의 품질 기준

- 각 단계 문서는 시작 상태, 관찰 가능한 목표, 실행 절차, 완료 결과, 독립 확인을 유지합니다.
- 데이터 변경 실습은 `실행 전 예측 → 변경 → 처리 건수 확인 → 재조회` 순서로 작성합니다.
- SQL과 MongoDB 예제는 현재 `step-N` 코드와 실제 필드명, 데이터 수, 반환 객체가 일치해야 합니다.
- 초기화, seed, update, delete 예제에는 대상 데이터베이스와 파일을 제한하는 guard를 둡니다.
- 정답은 질문 바로 아래에 노출하지 않고, 먼저 예상과 근거를 기록한 뒤 확인할 수 있게 둡니다.
- 오류 안내는 연결, 구문, 제약조건, 조회 조건, 데이터 상태를 구분하고 복구 후 검증까지 적습니다.
- 새 명령이나 쿼리를 추가하면 정상값, 경계값, 존재하지 않는 값, 중복값 중 관련 사례를 함께 확인합니다.
- 실습 구성과 각 단계 문서의 주제, 시작 조건, 완료 기준이 어긋나지 않는지 확인합니다.
- 수강생은 `npm init`으로 빈 `database-study` 프로젝트를 직접 만들고 개인 저장소의 `main`에 누적합니다.
- 교안 저장소를 clone하거나 강사용 `step-N` 브랜치로 이동하도록 안내하지 않습니다.
- 각 단계에서 수정하는 소스 파일은 diff가 아니라 해당 단계의 전체 내용으로 제시합니다.
