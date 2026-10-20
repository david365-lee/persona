<p align="center">
  <img src="jaewon-k8s-dashboard/media/jaewon-icon-128.png" width="128" height="128" alt="Jaewon K8s Dashboard 아이콘">
</p>

# Jaewon K8s Dashboard

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

VS Code 안에서 Kubernetes 클러스터를 탐색하고 로그, Helm 릴리스, 포트 포워드를 관리하는 확장 프로그램입니다. 한국인 개발자 **jaewon**이 제작했으며, MIT 라이선스로 무료 제공합니다.

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jaewon-lee.jaewon-k8s-dashboard) · [릴리스 및 VSIX 다운로드](https://github.com/david365-lee/persona/releases/latest) · [확장 프로그램 상세 안내](jaewon-k8s-dashboard/README.md)

## 주요 기능

### 0.2.2 업데이트

- 첫 연결 실패 후 새로고침·자동 갱신으로 연결 설정과 네임스페이스 조회를 다시 시도합니다.
- 확장 프로그램·대시보드·탭 아이콘을 새 파란 클러스터 이미지로 교체하고 활동 표시줄 아이콘을 맞췄습니다.
- 연결 실패 원인을 상태 표시줄에 표시합니다. API 서버 또는 SSH 터널이 중단된 경우 해당 연결 복구가 필요합니다.

### 0.2.0 개선 사항

- Pod의 현재 장애와 과거 재시작 이력을 구분하고, init 컨테이너·사이드카의 상태와 준비 여부를 반영합니다.
- 상세 화면에서 일반·init·임시 컨테이너, 워크로드 템플릿, 이전 종료 사유를 확인할 수 있습니다.
- VS Code 창을 다시 열면 대시보드 탭의 컨텍스트·네임스페이스·필터를 복원합니다. 숨겨진 대시보드는 자동 갱신을 중지합니다.
- 워크로드 셸 연결에 집합 기반 라벨 조건을 적용하고, 실행 중이며 삭제되지 않는 Pod만 선택합니다.
- 대시보드 헤더와 탭에도 생성한 아이콘을 표시합니다.

[REA 심층 분석과 검증 기록](jaewon-k8s-dashboard/docs/rea-expansion-0.2.0.md)

| 기능 | 설명 |
| --- | --- |
| 클러스터 탐색 | 컨텍스트별 대시보드 탭, 네임스페이스 선택, 리소스 검색·정렬·페이지 이동 |
| 리소스 상세 | 컨테이너, 조건, 이벤트, 레이블, 주석, Secret 개별 키 확인 |
| 로그 | 여러 Pod와 컨테이너의 실시간·이전 로그, 필터, 정규식, 강조, 복사 및 저장 |
| 리소스 작업 | 컨테이너 셸, YAML 편집·적용, 재시작, 확장, 삭제, CronJob 실행·중지, 노드 cordon/uncordon |
| 포트 포워드 | 로컬 연결, 자동 재연결, 설정 저장 및 자동 시작 |
| Helm | 릴리스 목록, values, manifest, notes, history, rollback 및 uninstall |
| 상태 확인 | CPU·메모리 메트릭과 이력, 클러스터 상태 Markdown 보고서 |

Pods, Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, Nodes, Namespaces, Events, CRDs를 탐색할 수 있습니다.

## 설치

### VS Code Marketplace

1. VS Code의 확장 화면에서 **Jaewon K8s Dashboard**를 검색합니다.
2. 확장 ID가 `jaewon-lee.jaewon-k8s-dashboard`인지 확인하고 설치합니다.

터미널에서도 설치할 수 있습니다.

```sh
code --install-extension jaewon-lee.jaewon-k8s-dashboard
```

### VSIX 파일로 설치

1. [GitHub Releases](https://github.com/david365-lee/persona/releases/latest)에서 `.vsix` 파일을 다운로드합니다.
2. VS Code 명령 팔레트에서 **Extensions: Install from VSIX...**를 실행하고 파일을 선택합니다.
3. 필요한 경우 **Developer: Reload Window**를 실행합니다.

## 시작하기

VS Code **1.90.0 이상**, 로컬 `kubectl`, 접근할 클러스터의 kubeconfig가 필요합니다. Helm 기능을 사용하려면 `helm`도 설치되어 있어야 합니다. 메트릭은 클러스터에서 Metrics API를 제공할 때 사용할 수 있습니다.

먼저 터미널에서 연결 상태를 확인합니다.

```sh
kubectl config get-contexts
kubectl get namespaces
```

명령 팔레트에서 **Jaewon K8s: Open Dashboard**를 실행하거나 **Ctrl+Alt+J**를 누릅니다. macOS에서는 **Cmd+Alt+J**를 사용합니다. 대시보드 상단에서 컨텍스트와 네임스페이스를 선택한 뒤 리소스를 탐색하세요.

왼쪽 활동 표시줄의 **Jaewon K8s**에서 클러스터와 저장된 포트 포워드를 확인할 수 있습니다. 표시되지 않으면 **Jaewon K8s: Show Sidebar** 명령을 실행하세요.

## 설정

VS Code 설정에서 `jaewonK8s`를 검색하거나 `settings.json`에 다음 값을 지정할 수 있습니다.

| 설정 | 기본값 | 설명 |
| --- | --- | --- |
| `jaewonK8s.kubectlPath` | `kubectl` | kubectl 실행 파일 경로 |
| `jaewonK8s.helmPath` | `helm` | Helm 실행 파일 경로 |
| `jaewonK8s.kubeconfig` | 빈 문자열 | kubeconfig 경로. 비워 두면 환경 변수와 기본 경로 사용 |
| `jaewonK8s.refreshSeconds` | `5` | 자동 새로고침 간격(초) |
| `jaewonK8s.metrics` | `true` | 메트릭 사용 |
| `jaewonK8s.logTailLines` | `300` | 처음 가져올 로그 줄 수 |
| `jaewonK8s.logMaxLines` | `50000` | 유지할 최대 로그 줄 수 |
| `jaewonK8s.autoStartPortForwards` | `true` | 저장한 포트 포워드 자동 시작 |
| `jaewonK8s.commandTimeout` | `30000` | 일반 명령 제한 시간(밀리초) |

모든 클러스터 작업에는 선택한 컨텍스트와 기존 kubeconfig의 RBAC 권한이 적용됩니다. 기본 kubectl 컨텍스트 변경은 별도 명령으로 수행합니다. 포트 포워드는 `127.0.0.1`에 바인딩됩니다.

## 개발 및 패키징

소스는 [jaewon-k8s-dashboard](jaewon-k8s-dashboard)에 있습니다. Node.js가 설치된 환경에서 실행하세요. 별도 npm 패키지 설치 없이 Node.js 내장 기능으로 테스트와 VSIX 생성을 수행합니다.

```sh
git clone https://github.com/david365-lee/persona.git
cd persona/jaewon-k8s-dashboard
npm test
npm run package
```

패키지는 확장 프로그램 폴더에 `jaewon-k8s-dashboard-<버전>.vsix`로 생성됩니다. PowerShell 실행 정책으로 `npm` 실행이 차단되면 `npm.cmd test`, `npm.cmd run package`를 사용하세요.

| 경로 | 내용 |
| --- | --- |
| [src](jaewon-k8s-dashboard/src) | 확장 명령, kubectl·Helm 연동, 로그 및 포트 포워드 |
| [media](jaewon-k8s-dashboard/media) | 대시보드 화면, 스타일 및 아이콘 |
| [scripts/package.cjs](jaewon-k8s-dashboard/scripts/package.cjs) | VSIX 패키징 |
| [docs](jaewon-k8s-dashboard/docs) | 분석 근거, 기능 목록 및 검증 기록 |

## 구현 범위

설치된 utiltools Kubernetes Dashboard 1.0.4의 manifest와 README 및 정적 분석을 바탕으로 독립 구현했습니다. 원본 코드와 자산은 포함하지 않으며, 원본 실행 결과와의 완전한 동등성은 검증되지 않았습니다. 리소스 표는 150행 단위로 표시하고, 메트릭 이력은 상세 화면이 열려 있는 동안 수집합니다.

## 문의 및 라이선스

문제나 기능 제안은 [GitHub Issues](https://github.com/david365-lee/persona/issues)에 남겨 주세요. 오류 메시지와 재현 절차, VS Code 및 확장 버전을 함께 적어 주시면 도움이 됩니다.

Created and distributed for free by **jaewon**, a developer from South Korea. [MIT License](jaewon-k8s-dashboard/LICENSE).
