# 공통 NGINX Ingress와 서버 플랫폼

2026-10-24에 Docker Desktop Kubernetes에 설치했다. Cloudflare 설정은 변경하지 않았다. 모든 도메인 분기는 Kubernetes `Ingress`와 `nginx` IngressClass로 처리한다.

| 서비스 | 설치 버전 | UI / 엔드포인트 | 관리자 ID |
| --- | --- | --- | --- |
| NGINX Ingress Controller | F5 OSS 5.7.0 / chart 2.8.0 | 공통 진입점 | 해당 없음 |
| Harbor | 2.15.4 / chart 1.19.4 | https://harbor.clush.cloud | root |
| Nexus Community | 3.97.2-02 | https://nexus.clush.cloud | root |
| MinIO Community | 최신 공식 소스 commit `7aac2a2c5b7c882e68c1ce017d8256be2feea27f` | https://minio.clush.cloud | root |
| MinIO S3 API | 동일 서버 | https://s3.clush.cloud | S3 자격 증명 사용 |
| Milvus | 3.0.4 / chart 5.0.32 | 클러스터 내부 `milvus.milvus.svc.cluster.local:19530` | root |
| Attu | 3.0.1 | https://attu.clush.cloud/login | root |
| Pritunl | 1.34.4763.45 | https://pritunl.clush.cloud/login | root |
| 기존 GitLab | 19.5.1 | https://gitlab.clush.cloud | root |
| Headlamp | 0.46.0 | https://headlamp.clush.cloud | 영구 토큰 로그인 |
| LiteLLM Proxy | 1.106.3 | https://litellm.clush.cloud/ui, Swagger: https://llmapi.clush.cloud | root |
| Velero / OTWLD Velero UI | 1.18.2 / 0.11.0 | https://velero.clush.cloud | root |
| Grafana | 13.2.4 | https://grafana.clush.cloud | root |
| Prometheus | 3.15.0 | https://prometheus.clush.cloud | Prometheus 자체 인증 없음 |
| Langflow | 1.13.0 | https://langflow.clush.cloud | root |
| Argo CD | 3.5.6 / chart 10.11.1 | https://argocd.clush.cloud | root |
| Metrics Server | 0.8.0 / chart 3.13.0 | Kubernetes Metrics API (`kubectl top`) | 해당 없음 |

Attu는 `/login`으로 접속한다. 인증 없는 `/` 요청은 upstream 애플리케이션에서 401 JSON을 반환한다. Attu의 앱 관리자 계정과 Milvus의 데이터베이스 계정은 서로 다르다. Milvus는 인증을 활성화했고 Attu에 내부 연결 주소와 root 자격 증명을 설정했다. DB 자체의 gRPC 포트를 인터넷에 공개하지 않았다.

Headlamp 설치 및 영구 토큰 조회는 `../headlamp/README.md`를 참고한다. 현재 권한은 읽기 전용이며, 클러스터 전체 관리자 권한은 별도 사용자 승인 대기다.

LiteLLM, Velero, Grafana/Prometheus, Langflow, Argo CD, Metrics Server의 설치 파일과 운영 세부 사항은 각각 `../litellm/README.md`, `../velero/README.md`, `../monitoring/README.md`, `../langflow/README.md`, `../argocd/README.md`, `../metrics-server/README.md`에 있다. 초기 비밀번호는 코드/Helm values에 저장하지 않고 Kubernetes Secret으로 관리한다.

메모리 스케줄 요청은 GitLab 1.5Gi, LiteLLM 512Mi, Nexus 384Mi, Pritunl/MongoDB 각 128Mi, Langflow 384Mi로 낮췄다. 2026-10-25에 실사용량 기준으로 GitLab 컨테이너 제한을 2Gi로, Nexus JVM heap/direct memory와 제한을 추가로 낮췄다(위 섹션 참고). Langflow는 `--workers 1`과 지연 컴포넌트 로딩(`LANGFLOW_LAZY_LOAD_COMPONENTS`)을 적용해 실제 RSS를 줄였다.

## 트래픽 경로

`사용자 HTTPS → 기존 Cloudflare 정책 → 서버 HTTP 81 또는 444 → 공통 NGINX Ingress → 호스트별 Service → 앱`

NGINX Ingress Service가 호스트 80/81/444를 맡는다. 이 포트들은 모두 HTTP 수신이다. 원본 TLS 종료 방식은 바꾸지 않았고, 앱에 `X-Forwarded-Proto: https`, `X-Forwarded-Port: 443`을 전달한다. 원본에서 HTTPS 강제 리디렉션을 추가하지 않는다. 공개 HTTP→HTTPS는 기존 Cloudflare 설정이 담당한다.

기존 GitLab Service는 ClusterIP로 변경했다. 웹은 동일한 NGINX Ingress를 거치고, SSH는 별도의 `gitlab-ssh` LoadBalancer 2222를 사용한다. 변경 후 공개 로그인 응답 200을 확인했다.

F5 NGINX Ingress Controller를 사용한다. Kubernetes 커뮤니티의 `ingress-nginx`와는 다른, 유지보수 중인 프로젝트다. 주석은 `nginx.org/*`를 사용한다. 공식 문서: https://docs.nginx.com/nginx-ingress-controller/ . Kubernetes 커뮤니티 ingress-nginx 유지보수 종료 안내: https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/ .

## 관리자 접속 정보

암호를 매니페스트나 이 문서에 저장하지 않는다. 암호는 Kubernetes Secret에 보관했다. 다음 명령은 로컬 터미널에 저장된 관리자 접속 정보를 표시한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/platform/Get-PlatformCredentials.ps1
```

2026-10-24 사용자 요청에 따라 GitLab·Nexus·MinIO·Milvus·Attu·Pritunl의 관리자 ID를 `root`로 설정하고 지정된 암호를 적용했다. Nexus는 기본 `admin` 계정과 별도로 `nx-admin` 역할의 `root` 계정을 추가했다. Pritunl은 super-user 계정을 변경했고, Attu는 기존 사용자 ID와 저장된 연결을 보존했다. MinIO/Milvus 자격 증명 변경 시 Milvus Helm 설정과 Attu의 저장된 연결도 갱신했다. Attu의 일회성 암호 재설정 환경 변수는 적용 후 제거했다.

Harbor도 사용자 승인을 받은 별도 암호로 `root` 시스템 관리자를 생성하고 인증을 확인했다. Harbor는 대문자·소문자·숫자 각 1자 이상을 요구하여 나머지 서비스와 암호의 대소문자가 다르다. 정확한 현재 암호는 조회 스크립트로 확인한다. 기본 `admin` 계정은 별도로 유지하며, Harbor Helm의 초기 관리자 Secret은 그 기본 계정용이다. root 계정 정보는 `harbor/harbor-root` Secret에 있다.

UI에서 이후 암호를 변경하면 Secret의 저장값도 갱신해야 한다. Nexus의 초기 설정 마법사/공지 확인은 관리자가 UI에서 진행한다. `bootstrap-secrets.ps1`은 기존 Secret을 덮어쓰지 않는다. GitLab 접속 정보는 `gitlab/gitlab-admin`, Nexus root 정보는 `nexus/nexus-root` Secret에 있다. Harbor용 조회 스크립트는 `harbor-root` Secret이 생기면 그것을 사용하고, 그 전에는 기본 관리자 Secret을 사용한다.

자격 증명 변경 후 GitLab의 암호 검증, Harbor/Nexus 관리자 API 인증, Pritunl 로그인, Attu 로그인 쿠키 발급을 확인했다. 새 MinIO/Milvus root 암호로 객체 쓰기·읽기·삭제와 벡터 삽입·조회를 재검증했다. 변경용 일회성 Job과 임시 Secret은 완료 후 제거했다. `rotate-milvus-password.yaml`을 다시 사용할 때는 이전 암호 Secret과 새 암호 Secret을 먼저 준비해야 한다.

## 스토리지와 구성

모두 단일 인스턴스이며 Docker Desktop의 Linux 로컬 디스크를 사용한다. `platform-local-retain` StorageClass는 `rancher.io/local-path`, `WaitForFirstConsumer`, `Retain`이다. 요청 용량은 실제 공간 예약이나 사용량 강제 제한을 뜻하지 않는다. Docker Desktop/클러스터 데이터 초기화에 대비한 외부 백업은 별도다.

- Harbor: 레지스트리 100Gi, DB 10Gi, 작업 로그 5Gi, Redis 2Gi, Trivy DB 10Gi.
- Nexus: 100Gi. 사용량이 적어 JVM heap 768Mi, direct memory 512Mi로 낮추고 컨테이너 메모리 요청 384Mi/제한 2Gi로 축소했다 (2026-10-25).
- MinIO: 객체와 빌드된 실행 파일을 합쳐 100Gi PVC.
- Milvus: 로컬 데이터 50Gi, etcd 10Gi. 객체/WAL은 별도 MinIO의 `milvus` 버킷을 사용한다. Pulsar/Kafka 대신 embedded Woodpecker를 사용한다.
- Attu: 연결 정보/로그인/설정용 SQLite 2Gi.
- Pritunl: MongoDB, 설정, 최신 패키지 캐시를 합쳐 10Gi. MongoDB는 Pod의 localhost에만 바인딩한다.

MinIO CE는 공식 바이너리의 최신 배포가 중단돼 공식 최신 소스를 initContainer에서 Go로 빌드했다. 실행 파일과 소스 commit 표시는 PVC에 캐시하여 이후 재시작에서 재사용한다. 소스 tarball에는 Git 메타데이터가 없으므로 실행 시 버전 문자열은 `DEVELOPMENT.GOGET`이지만, 실제 빌드 소스 commit은 위 표와 같다. 공식 배포 정책: https://github.com/minio/minio .

Pritunl의 커뮤니티 `latest-minimal` 이미지에 들어 있던 패키지는 구버전이었다. 공식 apt의 `1.34.4763.45-0ubuntu1~focal` 패키지를 캐시하고 SHA256 `e36d8f5d68681ef6c677380eeeac5439ebec64bd7eb888de219537456433c929`로 검증한 뒤 컨테이너 시작 시 적용한다. 원래 `/bin/start-pritunl` 초기화 흐름과 MongoDB를 유지한다. DB 설정 `app.reverse_proxy=true`를 적용했다.

Pritunl의 관리자 UI와 VPN 터널은 별도다. VPN 조직·사용자·서버·주소 대역은 아직 생성하지 않았다. OpenVPN 서버를 만들 때 UDP 1194를 사용하도록 맞춘다. VPN 클라이언트의 원본 주소는 Cloudflare HTTP 프록시가 아닌 `david365.ddns.net:1194/UDP`다. `pritunl-vpn` LoadBalancer가 해당 UDP 포트를 제공한다. 설치만으로 VPN 연결 성공까지 검증한 것은 아니다.

## 재적용 및 운영

현재 체크아웃에는 Helm이 `.tools/helm/windows-amd64/helm.exe`에 있다. 공식 차트 저장소는 `nginx-stable=https://helm.nginx.com/stable`, `harbor=https://helm.goharbor.io`, `milvus=https://zilliztech.github.io/milvus-helm/`이다.

```powershell
node deploy/platform/generate-manifests.cjs
kubectl --context docker-desktop apply -f deploy/platform/manifests.json
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/platform/bootstrap-secrets.ps1
& ./.tools/helm/windows-amd64/helm.exe upgrade --install nginx-ingress nginx-stable/nginx-ingress --version 2.8.0 --kube-context docker-desktop --namespace nginx-ingress --create-namespace -f deploy/platform/nginx-values.yaml
& ./.tools/helm/windows-amd64/helm.exe upgrade --install harbor harbor/harbor --version 1.19.4 --kube-context docker-desktop --namespace harbor -f deploy/platform/harbor-values.yaml
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/platform/install-milvus.ps1
kubectl --context docker-desktop -n pritunl exec deployment/pritunl -c pritunl -- pritunl set app.reverse_proxy true
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/platform/save-generated-credentials.ps1
kubectl --context docker-desktop get pods,ingress,pvc -A
```

Milvus 설치 스크립트는 기존 Secret에서 자격 증명을 읽어 임시 Helm values를 생성하고 설치 후 임시 파일을 삭제한다. 최신판 업그레이드 시 차트·이미지·패키지 버전과 저장소 백업/마이그레이션 경로를 함께 검토한다.

## 확인한 결과

- GitLab, Harbor, Nexus, MinIO, Attu `/login`, Pritunl `/login`의 공개 HTTPS 응답 200.
- 공개 S3 `/minio/health/ready` 200.
- Harbor와 Nexus 관리자 API 인증 성공.
- Attu bootstrap 관리자 생성, Milvus 인증 활성화 및 지정한 root 암호 연결 성공.
- MinIO 인증 후 객체 쓰기·읽기·삭제 성공.
- Milvus 인증 후 컬렉션 생성·벡터 삽입·flush·조회 성공. 검증에 사용한 임시 컬렉션과 버킷은 제거했다.
- Pritunl 실제 패키지 버전 `1.34.4763.45`, 리버스 프록시 모드 true.

스토리지 검증 작업 정의는 `verify-storage.yaml`에 있다. 해당 Job은 `milvus` 네임스페이스의 임시 `verification-s3` Secret을 필요로 하며, MinIO 관리자 자격 증명을 복사해 사용한다. 초기 검증 후 Job과 임시 Secret은 정리했다.
