# Jaewon K8s Dashboard

<img src="https://raw.githubusercontent.com/david365-lee/persona/main/jaewon-k8s-dashboard/media/jaewon-icon-128.png" width="128" height="128" alt="Jaewon K8s Dashboard 아이콘">

VS Code에서 실행하는 독립 Kubernetes 대시보드입니다.

한국인 개발자 **jaewon**이 만들어 무료로 배포하는 확장 프로그램입니다. MIT 라이선스로 제공합니다.

Created and distributed for free by **jaewon**, a developer from South Korea. Available under the MIT License.

[Marketplace에서 설치](https://marketplace.visualstudio.com/items?itemName=jaewon-lee.jaewon-k8s-dashboard) · [VSIX 다운로드](https://github.com/david365-lee/persona/releases/latest) · [프로젝트 안내](https://github.com/david365-lee/persona#readme)

## 빠른 시작

1. VS Code 1.90.0 이상과 `kubectl`, 접근할 클러스터의 kubeconfig를 준비합니다. Helm 기능에는 `helm`도 필요합니다.
2. VS Code 확장 화면에서 **Jaewon K8s Dashboard**를 검색하고, 확장 ID `jaewon-lee.jaewon-k8s-dashboard`를 확인하여 설치합니다.
3. 터미널에서 `kubectl config get-contexts`와 `kubectl get namespaces`로 연결을 확인합니다.

명령 팔레트에서 **Jaewon K8s: Open Dashboard**를 실행하거나 **Ctrl+Alt+J**를 누르세요. 왼쪽 활동 표시줄의 Jaewon K8s에서도 클러스터와 포트 포워드를 관리할 수 있습니다.

macOS 단축키는 **Cmd+Alt+J**입니다. 활동 표시줄이 보이지 않으면 **Jaewon K8s: Show Sidebar** 명령을 실행하세요.

## 기능

- 컨텍스트별 독립 탭, 네임스페이스 선택, 리소스 검색·정렬·페이지 이동
- Pods, Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, Nodes, Namespaces, Events, CRDs
- 컨테이너·조건·이벤트·레이블·주석·Secret 개별 키 확인, CPU/메모리 이력과 제한값
- 여러 Pod/컨테이너의 실시간 로그, 이전 로그, 필터·정규식·강조·복사·저장
- 컨테이너 셸, YAML 편집/적용, 재시작·확장·삭제, CronJob 실행·중지, 노드 cordon/uncordon
- 자동 재연결·저장·자동 시작 포트 포워드 (127.0.0.1 바인딩)
- Helm 릴리스·values·manifest·notes·history·rollback·uninstall
- 장애 Pod·재시작 횟수·준비되지 않은 워크로드/노드의 Markdown 상태 보고서

## 설정

로컬 `kubectl`과 kubeconfig를 사용합니다. Helm 기능에는 `helm` 실행 파일이 필요합니다. VS Code 설정에서 `jaewonK8s.kubectlPath`, `jaewonK8s.helmPath`, `jaewonK8s.kubeconfig`를 지정할 수 있습니다. 나머지 설정은 `jaewonK8s.refreshSeconds`, `metrics`, `logTailLines`, `logMaxLines`, `autoStartPortForwards`입니다.

모든 클러스터 작업은 선택된 컨텍스트를 명시합니다. 기본 kubectl 컨텍스트 변경은 별도 명령입니다. 삭제·YAML 적용·Helm rollback/uninstall은 실행 전 확인합니다. 각 작업에는 기존 kubeconfig의 RBAC가 적용됩니다.

## 설치 및 개발

`npm run package`로 생성한 VSIX를 VS Code의 **Extensions: Install from VSIX...**로 설치합니다. 설치 후 **Developer: Reload Window**를 실행하면 새 확장을 로드합니다.

외부 런타임 의존성이나 빌드 과정 없이 Node.js CommonJS와 VS Code webview를 사용합니다. `npm test`로 명령 인수·선택자·작업 검증 테스트를 실행합니다.

## 분석 범위

설치된 utiltools Kubernetes Dashboard 1.0.4를 REA로 정적 분석하고 manifest/README의 기능을 독립 구현했습니다. 원본 코드와 자산을 포함하지 않습니다. 원본의 실행 결과와 완전한 동등성은 검증되지 않았습니다. 테이블은 150행 단위 페이지 방식이며 메트릭 이력은 상세 화면이 열린 동안 수집합니다. 분석 근거·제한은 `docs/`를 참고하세요.
