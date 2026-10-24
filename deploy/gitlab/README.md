# GitLab — gitlab.clush.cloud

현재 웹 접속은 공통 F5 NGINX Ingress Controller와 `nginx` IngressClass가 처리한다. `gitlab` Service는 HTTP 80의 ClusterIP이며, 호스트의 공통 80/81/444는 NGINX Ingress Service가 수신한다. SSH 2222는 별도 `gitlab-ssh` LoadBalancer로 유지했다. 최신 공통 배포 구성은 `../platform/README.md`를 참고한다.

사용자 최종 확인(2026-10-24): Cloudflare와 GitLab은 정상 동작하며, 모든 `*.clush.cloud` 호스트는 공통 와일드카드 정책을 따른다. 추가 Cloudflare 작업은 필요하지 않다. 아래의 전용 규칙 설정은 설치 당시 작업 기록이며, 현재 공통 정책을 변경하거나 다른 서비스에 예외를 추가하라는 지침이 아니다. 향후 서버/애플리케이션 작업에서는 사용자의 별도 요청 없이 Cloudflare 설정을 변경하지 않는다.

## 접속 구조

사용자가 확정한 원본 서버 이름은 **david365.ddns.net**이다. david465가 아니다.

- 공개 주소: `https://gitlab.clush.cloud`
- DNS: `gitlab.clush.cloud` CNAME → `david365.ddns.net`
- Cloudflare: 사용자 HTTPS의 TLS를 종료하고 원본에는 HTTP로 연결한다(Flexible).
- Cloudflare의 **항상 HTTPS 사용(Always Use HTTPS)**을 활성화했다. 공개 HTTP는 경로와 쿼리를 유지한 HTTPS URL로 에지에서 301 리다이렉트된다. 원본 연결은 계속 HTTP 81을 사용한다.
- 사용자 지정 원본 포트 규칙: 외부 HTTP 80 → 81, 외부 HTTPS 443 → 444.
- **GitLab 전용 예외**: 마지막 Origin Rule `GitLab HTTP origin 81`은 `(http.host eq "gitlab.clush.cloud")`에 대해 원본 포트를 **81**로 재정의한다. 공개 HTTPS 요청도 Cloudflare → 서버 **HTTP 81** → GitLab HTTP 80으로 전달된다. 일반 HTTPS → 444 규칙은 남아 있지만 GitLab에는 마지막 전용 규칙이 우선한다.
- GitLab은 공개 URL을 HTTPS로 생성하지만 자체 NGINX는 HTTP 80으로 수신한다.
- 공통 NGINX Ingress Service는 서버의 80, 81, 444를 HTTP로 수신하고, 호스트 이름으로 GitLab HTTP 80에 연결한다. **444도 HTTP이며 TLS 포트가 아니다.**
- 공유기에서 해당 원본 포트를 실제 설치 서버로 전달해야 한다. 기존의 다른 서버를 가리키는 포워딩은 이 설치에 연결되지 않는다.
- 사용자는 공유기의 DMZ 대상이 이 PC `192.168.219.100`이라고 확인했다. 81/444가 같은 번호의 호스트 포트로 전달되는 구성이다. PC 주소가 바뀌면 DMZ 대상도 재확인한다.
- 같은 포트를 여러 서비스에서 공유하려면 공통 Ingress/리버스 프록시로 호스트별 라우팅을 구성해야 한다.

Cloudflare의 DNS 프록시가 켜져 있어야 Cloudflare TLS 종료와 Origin Rule이 적용된다. 설치 당시 레코드의 프록시는 켜져 있었으나 영역 자체가 Pending Nameserver Update 상태여서 원본 CNAME/IP가 그대로 반환됐다. Chrome의 로그인된 Cloudflare 화면에서 네임서버 재검사를 요청한 뒤 영역이 활성화됐다. 상위 `.cloud` 네임서버의 실제 위임은 `adam.ns.cloudflare.com`, `cass.ns.cloudflare.com`으로 확인됐다. DNSSEC DS 레코드는 없었다.

Cloudflare에 GitLab 전용 CNAME `gitlab` → `david365.ddns.net`을 프록시 사용으로 저장했다. SSL/TLS는 사용자가 지정한 Flexible을 유지했고, 범용 에지 인증서는 활성 상태였다. 활성화 후 HTTP → 원본 81은 정상 응답했지만 HTTPS → 원본 444는 Cloudflare 522를 반환했다. GitLab 전용 원본 81 규칙을 마지막에 배포한 뒤 공개 HTTPS 로그인 화면이 정상 응답했다. 공유기 설정은 변경하지 않았다. 설치 서버의 공인 IP는 DDNS의 `182.227.81.81`과 일치한다.

SSH는 별도 경로 `david365.ddns.net:2222`를 사용한다. 필요하면 공유기에 TCP 2222 포워딩을 추가한다. 일반 Cloudflare HTTP 프록시 경로와 다르다. HTTPS clone은 웹 접속 경로를 그대로 사용한다.

## 배포

Docker Desktop의 Linux Kubernetes에 단일 GitLab CE 인스턴스를 설치한다. GitLab, PostgreSQL, Redis, Gitaly가 한 Pod에서 실행되는 단일 서버 구성이다. 고가용성 구성은 아니며 Docker Desktop 종료 시 서비스도 정지한다. 공식 Kubernetes 운영 배포 지침은 GitLab Helm Chart/Operator를 권장한다: https://docs.gitlab.com/install/docker/installation/

이미지는 `19.5.1-ce.0` amd64 digest로 고정했다. 외부 TLS 종료 설정: https://docs.gitlab.com/omnibus/settings/ssl/

```powershell
kubectl --context docker-desktop apply -f deploy/gitlab/gitlab.yaml
kubectl --context docker-desktop -n gitlab rollout status statefulset/gitlab --timeout=30m
kubectl --context docker-desktop -n gitlab get pods,pvc,svc
```

ConfigMap의 `gitlab.rb` 변경 후에는 Pod를 재시작하여 설정을 적용한다.

```powershell
kubectl --context docker-desktop -n gitlab rollout restart statefulset/gitlab
```

## 데이터와 초기 로그인

50Gi PVC에 `/etc/gitlab`, `/var/log/gitlab`, `/var/opt/gitlab`을 저장한다. `gitlab-local-retain` SC는 PVC 삭제 시 PV를 Retain한다. 데이터는 Windows의 특정 HDD 폴더가 아니라 Docker Desktop Linux 노드의 로컬 저장소에 있다. 요청 용량 50Gi는 local-path 저장소에서 엄격한 디스크 사용량 제한을 보장하지 않는다. 클러스터 초기화나 Docker 데이터 삭제로부터 보호하지 않으므로 별도 백업이 필요하다. 설정/암호화 키도 백업해야 한다.

관리자 계정은 `root`다. 2026-10-24 사용자 요청으로 암호를 변경했으므로 `/etc/gitlab/initial_root_password`의 초기값은 현재 암호가 아니다. 현재 접속 정보는 `gitlab/gitlab-admin` Secret에 저장했으며 다음 명령으로 로컬에서 확인한다. 비밀번호를 저장소에 기록하지 않는다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/platform/Get-PlatformCredentials.ps1
```

SMTP와 GitLab Runner는 별도 설정이 필요하며 이 배포에 포함하지 않는다. 컨테이너 레지스트리와 내장 Prometheus 모니터링은 비활성화했다.

공개 회원가입은 비활성화했다. 관리자가 사용자 계정을 생성한다. 진단 URL은 GitLab 기본 접근 제한을 유지하고, Kubernetes는 컨테이너 내부 localhost에서 readiness를 검사한다.

## 설치 확인 결과 (2026-10-24)

- 실제 GitLab 버전 `19.5.1`, StatefulSet 배포 완료, Pod `1/1 Ready`, 50Gi PVC Bound.
- 호스트 `127.0.0.1:81` 및 LAN `192.168.219.100:444`의 HTTP 요청은 `https://gitlab.clush.cloud/users/sign_in`으로 302 응답한다.
- 원본 HTTP `/users/sign_in`은 200 응답한다. 회원가입 비활성화와 초기 root 비밀번호 파일 존재를 확인했다.
- Cloudflare 영역 활성화 및 GitLab 전용 원본 포트 규칙 적용 후 공개 `https://gitlab.clush.cloud`는 로그인 URL로 302, `https://gitlab.clush.cloud/users/sign_in`은 **200** 응답했다. 응답의 `Server: cloudflare`, `CF-RAY`, GitLab 헤더를 확인했다. 공개 DNS는 Cloudflare 프록시 IP를 반환한다.
