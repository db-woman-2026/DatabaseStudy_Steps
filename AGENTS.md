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
