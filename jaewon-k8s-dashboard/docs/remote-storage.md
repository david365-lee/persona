# 로컬·원격 Kubernetes 연결과 StorageClass (0.3.0)

대시보드 상단 **Connect Local / Remote** 또는 명령 팔레트의 **Jaewon K8s: Connect Local / Remote Cluster**에서 연결합니다.

## 연결 선택

1. **Local / existing kubeconfig**: 기존 kubeconfig의 컨텍스트를 선택합니다. 원격 클러스터와 클라우드 인증 플러그인이 이미 등록된 kubeconfig도 계속 사용할 수 있습니다.
2. **Remote: API address + credentials**: 연결 이름, HTTPS API 주소(예: `https://cluster.example.com:6443`), 인증 방식과 CA를 입력합니다. Bearer Token 또는 PEM 클라이언트 인증서·개인 키 파일을 지원합니다. SSH 로그인 키는 Kubernetes API 인증 키와 다릅니다.
3. 사설 CA는 클러스터 CA 인증서 파일을 선택하고, 공인 인증서라면 **System trusted certificate authorities**를 선택합니다. TLS 검증은 유지됩니다.
4. 저장 후 API 연결을 시험하고 컨텍스트 목록의 **Remote: 이름**으로 전환합니다. 접속 시험이 실패해도 연결 정보는 유지됩니다. 주소·VPN·방화벽·인증서·Token 유효기간을 확인한 뒤 Refresh로 재시도합니다.
5. **Remove saved remote connection**으로 원격 연결과 저장된 인증 정보를 제거합니다. 해당 연결의 로그·셸·포트 포워드를 먼저 종료하세요. 인증 정보를 교체할 때는 새 연결을 등록한 뒤 이전 연결을 제거합니다.

원격 API는 VS Code 확장이 실행되는 PC, Remote SSH 또는 WSL 환경에서 접근 가능해야 합니다. SSH 터널을 자동으로 만들지는 않습니다. `kubectl`이 필요하고 Helm 작업에는 `helm`이 필요합니다. 조작 범위는 인증 계정의 Kubernetes RBAC 권한을 따릅니다.

Token과 클라이언트 개인 키를 포함한 원격 kubeconfig는 VS Code SecretStorage에 보관합니다. 기본 `~/.kube/config`와 프로젝트 설정은 변경하지 않습니다. CLI 실행에는 사용자 전용 권한의 임시 kubeconfig를 사용하고 정상 종료 시 삭제합니다. 비정상 종료 시 임시 파일이 남을 수 있습니다.

## StorageClass 관리

- **StorageClasses**: 기본 클래스 여부, CSI Provisioner, Reclaim Policy, Volume Binding Mode, 확장 허용 여부, 생성 시점을 조회·필터·정렬합니다.
- 행을 선택하면 Parameters, Allowed Topologies, Mount Options, 주석과 이벤트를 확인합니다.
- **Create StorageClass**로 YAML 초안을 열고 실제 CSI 드라이버·이름·파라미터를 입력합니다. 저장 후 **Jaewon K8s: Apply YAML to Cluster**로 검토·적용합니다. 자리표시자가 남은 초안은 적용하지 않습니다. 기본 초안은 `Retain`, `WaitForFirstConsumer`이며 드라이버가 해당 옵션을 지원하는지 확인합니다.
- **Edit YAML / Describe / Delete**, **Set default / Unset default**를 지원합니다. 기본 클래스를 지정하면 확인 후 기존 기본 클래스의 stable/beta 주석을 정리합니다. 일부 변경이 거부되면 부분 적용 상태를 알려주므로 새로고침 후 확인하세요.
- **PersistentVolumes**와 **PVCs** 상세에서 StorageClass, 용량·요청량·접근 모드 등 연결 정보를 확인합니다.
- StorageClass와 PV는 네임스페이스 선택과 무관하게 조회합니다. StorageClass 생성은 CSI 드라이버 설치를 대신하지 않습니다.

기본 StorageClass를 변경하면 `storageClassName`을 지정하지 않은 PVC의 프로비저닝에 영향을 줄 수 있습니다. Reclaim Policy와 지원 가능한 파라미터는 스토리지 드라이버에 맞게 설정합니다. [Kubernetes StorageClass 공식 문서](https://kubernetes.io/docs/concepts/storage/storage-classes/)

원격 접속은 kubeconfig의 `token`, `client-certificate-data`, `client-key-data`, `certificate-authority-data`를 사용합니다. [kubeconfig 공식 형식](https://kubernetes.io/docs/reference/config-api/kubeconfig.v1/)
