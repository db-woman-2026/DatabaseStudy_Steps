# Windows 11 x64 실습 환경 준비

아래 명령은 Windows 11 x64와 Windows Terminal의 `Windows PowerShell` 프로필에서 실행합니다. 프로그램이 이미 설치되어 있어도 설치 명령으로 현재 상태와 최신 안정판 여부를 확인합니다.

## 1. Windows Terminal 설치

시작 메뉴에서 `Windows PowerShell`을 한 번 열고 다음 명령을 실행합니다.

```powershell
winget --version
winget install --id Microsoft.WindowsTerminal -e --source winget --accept-source-agreements --accept-package-agreements
```

`winget`을 찾지 못하면 [App Installer 공식 안내](https://learn.microsoft.com/windows/msix/app-installer/install-update-app-installer)에 따라 App Installer를 설치하거나 업데이트합니다. 설치 후 처음 열었던 창을 닫고 시작 메뉴에서 `Windows Terminal`을 엽니다.

탭 오른쪽의 화살표에서 `Windows PowerShell` 프로필을 선택합니다. 이후 모든 명령은 이 탭에서 실행합니다.

```powershell
$PSVersionTable.PSVersion
(Get-CimInstance Win32_OperatingSystem) | Select-Object Caption, BuildNumber, OSArchitecture
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
```

대상 PC에서는 Windows 11과 `X64`가 표시되어야 합니다.

## 2. 개발 프로그램 새로 설치

다음 명령을 위에서부터 한 줄씩 실행합니다.

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget --architecture x64 --accept-source-agreements --accept-package-agreements
winget install --id Git.Git -e --source winget --architecture x64 --accept-source-agreements --accept-package-agreements
winget install --id Microsoft.VisualStudioCode -e --source winget --architecture x64 --accept-source-agreements --accept-package-agreements
winget install --id GitHub.cli -e --source winget --architecture x64 --accept-source-agreements --accept-package-agreements
winget install --id MongoDB.Server -e --source winget --architecture x64 --accept-source-agreements --accept-package-agreements
winget install --id MongoDB.Shell -e --source winget --architecture x64 --accept-source-agreements --accept-package-agreements
```

MongoDB 설치 중 권한 확인 창이 나오면 설치 파일의 게시자가 MongoDB인지 확인한 뒤 승인합니다. 설치가 끝나면 Windows Terminal 창을 모두 닫고 새 창을 엽니다.

```powershell
node --version
npm.cmd --version
git --version
code --version
gh --version
mongosh --version
```

이 저장소는 Node.js `22.13.0` 이상을 사용합니다. 명령을 찾지 못하면 새 Windows Terminal 창인지 확인한 뒤 실행 파일 경로를 확인합니다.

```powershell
(Get-Command node).Source
(Get-Command git).Source
(Get-Command code).Source
(Get-Command mongosh).Source
```

> !@#windows11 test: [Windows 11 x64 초기화 PC에서 Windows Terminal, Node.js LTS x64, Git for Windows x64, VS Code x64, MongoDB Community Server x64, mongosh x64를 위 winget 명령으로 신규 설치하고 전체 단계 검증을 반복합니다.]@#

## 3. Git과 GitHub 계정 연결

예시 이름과 이메일을 자신의 값으로 바꿉니다.

```powershell
git config --global user.name "Student Name"
git config --global user.email "student@example.com"
git config --global --get user.name
git config --global --get user.email
gh auth login --hostname github.com --web
gh auth status --hostname github.com
```

## 4. 개인 Node.js 프로젝트 만들기

이 저장소를 clone하지 않고 빈 `database-study` 폴더를 만듭니다.

```powershell
New-Item -ItemType Directory -Path "$HOME\dongbu\database-study" -Force | Out-Null
Set-Location "$HOME\dongbu\database-study"
git init -b main
npm.cmd init -y
npm.cmd pkg set "name=database-study" "description=SQLite and MongoDB beginner practice" "main=index.js" "engines.node=>=22.13.0" "scripts.start=node index.js" "scripts.check=node --check index.js"
npm.cmd install
New-Item -ItemType File -Path index.js, .gitignore, .gitattributes, .env.example -Force | Out-Null
code .
```

VS Code에서 아래 파일 전체를 입력합니다. `package.json`과 `package-lock.json`은 npm 명령이 만들었으므로 직접 입력하지 않습니다.

### `index.js`

```js
console.log("Database study project is ready.");
```

### `.gitignore`

```text
node_modules/
.env
data/*.sqlite
data/*.sqlite-shm
data/*.sqlite-wal
npm-debug.log*
.DS_Store
```

### `.gitattributes`

```text
* text=auto

*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.sql text eol=lf
*.env.example text eol=lf

*.db binary
*.sqlite binary
*.sqlite3 binary
*.png binary
*.jpg binary
*.jpeg binary
```

### `.env.example`

```text
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=database_study_course
```

검사와 첫 실행을 확인합니다.

```powershell
npm.cmd run check
npm.cmd start
```

두 명령이 오류 없이 끝나고 `Database study project is ready.`가 출력되어야 합니다.

## 5. 첫 commit과 GitHub 저장소 만들기

```powershell
Set-Location "$HOME\dongbu\database-study"
git add .
git commit -m "Create database study project"
gh repo create database-study --private --source . --remote origin --push
git branch --show-current
git status --short --branch
git remote -v
```

현재 branch는 `main`이어야 합니다. 작업 파일 목록은 비어 있어야 하며 `origin`에는 본인 GitHub 계정의 저장소 주소가 표시되어야 합니다.

같은 저장소 이름이 이미 있으면 `gh repo create`의 이름을 `database-study-이름`처럼 바꿉니다. 로컬 폴더 이름은 그대로 사용해도 됩니다. OneDrive가 관리하는 폴더는 사용하지 않습니다.

## 6. MongoDB Windows 서비스 확인

MongoDB Community Server는 `MongoDB`라는 Windows 서비스로 설치됩니다.

```powershell
Get-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
mongosh "mongodb://127.0.0.1:27017" --eval 'db.runCommand({ ping: 1 })'
```

서비스 상태가 `Running`이고 포트 검사에서 `TcpTestSucceeded : True`가 나오면 준비됐습니다. 서비스가 멈춰 있으면 Windows Terminal을 관리자 권한으로 한 번 열어 `Start-Service MongoDB`를 실행한 뒤 관리자 창을 닫습니다. 프로젝트 실습은 일반 권한 창에서 진행합니다.

MongoDB 실습은 `MONGODB_DB` 값이 `database_study_`로 시작하는 전용 데이터베이스만 사용합니다. 개인 또는 업무용 데이터베이스 연결 문자열을 넣지 않습니다.

## 7. SQLite 단계 실행

저장소 루트에서 `main`과 변경 상태를 먼저 확인합니다.

```powershell
Set-Location "$HOME\dongbu\database-study"
git branch --show-current
git status --short
npm.cmd run check
npm.cmd start
```

`git status --short`는 실행 전 아무것도 출력하지 않아야 합니다. 문서의 `index.js`를 입력한 뒤 실행합니다. SQLite 예제는 각각의 전용 파일을 다시 만듭니다.

## 8. MongoDB 단계 실행

Step 4부터 환경 파일과 로컬 MongoDB가 필요합니다.

```powershell
Set-Location "$HOME\dongbu\database-study"
git branch --show-current
git status --short
Copy-Item -LiteralPath .env.example -Destination .env
Get-Content -LiteralPath .env -Encoding utf8
npm.cmd install
npm.cmd run check
npm.cmd start
```

`.env`의 기본값은 로컬 MongoDB와 `database_study_course`를 가리킵니다. 비밀번호가 포함된 연결 문자열은 화면 공유, 문서, commit에 넣지 않습니다.

Step 6부터는 도움말에 표시된 CRUD 명령을 실행합니다.

```powershell
npm.cmd start -- seed
npm.cmd start -- list
npm.cmd start -- get 978-00-0001
npm.cmd start -- add 978-00-0099 "새 도서" "학생 저자" 3 "database,mongodb"
```

`--` 뒤의 값은 Node.js 프로그램으로 전달됩니다. PowerShell에서 공백이 포함된 인자는 큰따옴표로 묶습니다.

## 9. 테스트와 VS Code

```powershell
Set-Location "$HOME\dongbu\database-study"
npm.cmd run check
npm.cmd test
code .
```

현재 `package.json`에 `test` script가 없으면 `npm.cmd run check`와 `npm.cmd start`를 실행합니다. `test` script가 있으면 `npm.cmd test`도 실행합니다.

VS Code 오른쪽 아래에서 인코딩이 `UTF-8`인지 확인합니다. 저장소의 `.gitattributes`가 소스와 문서의 줄바꿈을 관리하므로 전체 파일의 줄바꿈을 한꺼번에 바꾸지 않습니다.

## 10. PowerShell 경로와 파일 명령

```powershell
Get-Location
Get-ChildItem
Get-Content -LiteralPath .env.example -Encoding utf8
Copy-Item -LiteralPath .env.example -Destination .env
Test-Path -LiteralPath .env
(Get-Command node).Source
```

PowerShell에서 `npm.ps1` 실행 정책 오류가 나오면 정책을 바꾸지 말고 `npm.cmd`와 `npx.cmd`를 사용합니다. Windows 방화벽이 Node.js 연결을 물으면 공용 네트워크는 선택하지 않고 신뢰하는 개인 네트워크에서만 허용합니다.

## 공식 안내

- [Windows Terminal 설치](https://learn.microsoft.com/windows/terminal/install)
- [winget install 명령](https://learn.microsoft.com/windows/package-manager/winget/install)
- [Node.js 다운로드](https://nodejs.org/en/download)
- [Git for Windows](https://git-scm.com/install/windows)
- [GitHub CLI 설치](https://github.com/cli/cli/blob/trunk/docs/install_windows.md)
- [VS Code Windows 설치](https://code.visualstudio.com/docs/setup/windows)
- [MongoDB Community Server Windows 설치](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/)
