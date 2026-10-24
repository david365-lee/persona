# Pritunl

관리 주소: https://pritunl.pc.david365.shop

`local-rke2` 클러스터의 `pritunl` 네임스페이스에 설치합니다.
Pritunl과 MongoDB 8.0은 같은 파드에서 실행하며, MongoDB는 파드의
127.0.0.1에만 바인딩합니다. 두 컨테이너의 데이터는 10Gi CephFS PVC의
별도 디렉터리에 저장합니다. 동시에 두 인스턴스가 DB를 열지 않도록
Deployment는 단일 복제본과 Recreate 전략을 사용합니다.

Pritunl 이미지는 커뮤니티 프로젝트
[jippi/docker-pritunl](https://github.com/jippi/docker-pritunl)의 이미지를
사용하며 두 이미지 모두 배포 시점의 digest로 고정했습니다.
VPN 터널 및 라우팅을 위해 Pritunl 컨테이너는 privileged로 실행합니다.

## 적용 및 상태 확인

```powershell
kubectl --context local-rke2 apply -f deploy/pritunl/pritunl.yaml
kubectl --context local-rke2 -n pritunl rollout status deployment/pritunl
kubectl --context local-rke2 -n pritunl get pods,pvc,ingress,certificate
```

현재 `docker-desktop`에서 Pritunl/MongoDB의 메모리 요청을 각각 128Mi로
낮춘 패치는 `resources-patch.yaml`에 있다. 적용 시 Deployment가 재시작된다.
메모리 제한은 기존 값을 유지해 실제 사용량보다 낮은 상한으로 인한 OOM을
피한다.

Traefik 프록시 설정은 DB에 저장됩니다. 새 DB로 설치할 때는 실행합니다.

```powershell
kubectl --context local-rke2 -n pritunl exec deployment/pritunl -c pritunl -- pritunl set app.reverse_proxy true
```

## DNS와 외부 네트워크

Cloudflare DNS에 다음 레코드를 설정합니다.

| 항목 | 값 |
| --- | --- |
| 유형 | CNAME |
| 이름 | pritunl.pc |
| 대상 | david365.ddns.net |
| 프록시 | 프록시 사용 (Origin Rule 적용) |

Cloudflare Origin Rule은 HTTP 요청의 원본 포트를 81, HTTPS 요청의 원본
포트를 444로 지정한 규칙이 있습니다. 현재 SSL/TLS 모드는 `Flexible`이므로
공개 HTTPS 요청도 원본에는 HTTP로 연결됩니다. 따라서 이 요청에 적용되는
Origin Rule의 원본 포트는 HTTP 수신 포트인 **81**이어야 합니다.
공유기에서는 다음과 같이 전달합니다.

| 외부 포트 | 내부 대상 예시 | 용도 |
| --- | --- | --- |
| TCP 81 | 192.168.77.11:80 | Flexible 모드의 원본 HTTP |
| TCP 444 | 192.168.77.11:443 | Traefik HTTPS |

Traefik은 현재 각 노드의 80/443에서 수신하므로 원본 포트 81/444를
Pritunl 컨테이너 포트로 직접 지정하지 않습니다. Cloudflare에서 해당
호스트의 엣지 TLS 인증서가 Active인지 확인해야 합니다.
Cloudflare SSL/TLS 암호화 모드는 사용자가 정정한 `Flexible`을 사용합니다.
HTTP Ingress는 HTTPS 리다이렉트 대신 `X-Forwarded-Proto: https`를
Pritunl로 전달하여 로그인 리다이렉트 반복을 방지합니다. 이 경로는
Cloudflare의 공개 HTTPS 요청을 위한 경로이며, 원본 HTTP 직접 접근을
HTTPS로 간주하므로 원본 접근은 Cloudflare로 제한하는 구성이 적합합니다.

브라우저에 제공하는 인증서는 Cloudflare가 처리합니다. 원본 Traefik에는
cert-manager의 `origin-selfsigned` Issuer가 자체 서명 인증서를 발급하고
갱신합니다. 따라서 원본 인증서 발급에 HTTP-01 검증은 필요하지 않습니다.
원본 자체 서명 인증서는 HTTPS 수신 경로에 유지하지만 `Flexible` 연결에는
사용되지 않습니다. `Full (strict)`의 신뢰 검증에는 사용할 수 없습니다.

```powershell
kubectl --context local-rke2 -n pritunl describe certificate pritunl-tls
```

인증서가 준비되기 전에는 Traefik 기본 인증서가 표시될 수 있습니다.
백엔드의 Pritunl 자체 서명 인증서는 전용 ServersTransport에서만 검증을
생략하며 브라우저용 인증서는 Cloudflare에서 관리합니다.

## 초기 로그인과 VPN 설정

초기 관리자 계정은 다음 명령으로 확인하고 첫 로그인 후 비밀번호를 변경합니다.

```powershell
kubectl --context local-rke2 -n pritunl exec deployment/pritunl -c pritunl -- pritunl default-password
```

조직, 사용자, VPN 서버와 네트워크 경로는 관리 화면에서 설정합니다.
OpenVPN UDP 1194용 서비스는 각 노드의 UDP 31194로 노출되어 있습니다.
이 포트로 VPN 서버를 구성한다면 공유기의 외부 UDP 1194를
클러스터 노드의 UDP 31194로 전달하고 서버의 공개 주소를
`david365.ddns.net`으로 설정합니다. 관리용 Cloudflare 프록시 도메인과
VPN 접속 주소는 구분합니다. 다른 VPN 포트나 WireGuard를
사용한다면 서비스와 공유기 포트 전달도 맞춰 변경해야 합니다.

이 배포 구성은 관리 화면과 영구 데이터 볼륨을 제공하며, 실제 VPN 연결은
조직/사용자/서버 및 외부 UDP 전달을 설정한 후 별도로 검증해야 합니다.
