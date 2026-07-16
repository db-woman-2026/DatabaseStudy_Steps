# Windows 11 환경 준비

Windows 11에서는 Windows Terminal의 PowerShell로 실습합니다. 명령은 저장소 루트에서 실행합니다.

## 1. 프로그램 설치

다음 프로그램을 설치합니다.

- [Node.js](https://nodejs.org/en/download): 이 저장소는 `22.13.0` 이상을 사용합니다. Windows용 LTS 설치 프로그램을 선택합니다.
- [Git for Windows](https://git-scm.com/install/windows.html)
- [Visual Studio Code](https://code.visualstudio.com/docs/setup/windows)
- [MongoDB Community Server](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/): `step-4`부터 필요합니다. Atlas를 사용한다면 로컬 서버를 설치하지 않아도 됩니다.

Git과 VS Code는 `winget`으로 설치할 수도 있습니다.

```powershell
winget install --id Git.Git -e --source winget
winget install --id Microsoft.VisualStudioCode -e --source winget
```

설치 후 터미널을 새로 열고 버전을 확인합니다.

```powershell
node --version
npm.cmd --version
git --version
code --version
```

`node`가 `v22.13.0` 이상이면 됩니다. `code`를 찾지 못하면 VS Code 설치 후 터미널을 다시 엽니다.

## 2. 저장소 실행

OneDrive 동기화 폴더보다 `C:\workspace`처럼 짧은 작업 경로를 권장합니다.

```powershell
Set-Location C:\workspace\DatabaseStudy_Steps
git status
npm.cmd ci
npm.cmd start
```

서버나 감시 명령은 `Ctrl+C`로 종료합니다. Windows 방화벽 창이 뜨면 개인 네트워크에서만 Node.js 접근을 허용합니다.

## 3. MongoDB 준비

로컬 MongoDB를 쓴다면 공식 MSI 설치 프로그램에서 Windows 서비스로 등록합니다. MongoDB Community Server를 WSL 안에 설치하지 않습니다.

```powershell
Get-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
Copy-Item .env.example .env
Get-Content .env -Encoding utf8
```

서비스가 멈춰 있다면 관리자 PowerShell에서 `Start-Service MongoDB`를 실행합니다. Atlas를 쓸 때는 Atlas 연결 문자열을 `.env`에 입력하고 비밀번호와 데이터베이스 이름을 다시 확인합니다.

## 4. PowerShell 명령 대응

| macOS·Linux 예제 | PowerShell |
| --- | --- |
| `pwd` | `Get-Location` |
| `ls` | `Get-ChildItem` |
| `cp A B` | `Copy-Item A B` |
| `rm FILE` | `Remove-Item FILE` |
| `cat FILE` | `Get-Content FILE -Encoding utf8` |
| `which node` | `(Get-Command node).Source` |
| `curl ...` | `Invoke-RestMethod ...` |

`git`, `node`, `npm` 명령은 PowerShell에서도 같은 형식으로 실행합니다. PowerShell이 `npm.ps1`을 차단하면 실행 정책을 바꾸기 전에 `npm.cmd`를 사용합니다.

## 5. 경로와 줄바꿈

JavaScript에서 경로를 조합할 때는 문자열에 `\`를 직접 넣지 않고 `node:path`의 `join`을 사용합니다. 저장소의 `.gitattributes`는 소스와 문서의 줄바꿈을 LF로 맞춥니다. VS Code 오른쪽 아래에서 파일 인코딩이 UTF-8인지 확인합니다.
