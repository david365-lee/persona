# Headlamp

- 주소: https://headlamp.clush.cloud
- 버전: Headlamp / Helm chart `0.46.0`, 이미지 `ghcr.io/headlamp-k8s/headlamp:v0.46.0`.
- 네임스페이스: `headlamp`.
- 기존 F5 NGINX Ingress, `nginx` IngressClass를 사용한다. Cloudflare는 변경하지 않았다.
- 로그인은 Kubernetes 서비스 계정 토큰 방식이다. 별도 root/비밀번호 로그인은 구성하지 않았다.

## 로그인 토큰

사용자 요청에 따라 `headlamp/root` ServiceAccount와 수동 `kubernetes.io/service-account-token` Secret `headlamp-root-token`을 생성했다. JWT에 `exp`가 없고 실제 TokenReview 인증 성공을 확인했다. 시간 만료는 없지만 Secret/ServiceAccount 삭제 또는 클러스터 재생성 등으로 폐기될 수 있다.

토큰을 클립보드에 복사한 뒤 웹 화면의 토큰 로그인에 붙여 넣는다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/headlamp/Get-HeadlampToken.ps1 -Copy
```

터미널에 토큰을 표시하려면 `-Copy`를 생략한다. 토큰을 저장소나 문서에 기록하지 않는다.

## 현재 권한

현재 토큰은 Kubernetes 기본 **view(읽기 전용)** 역할이다. Headlamp 서버 자체의 ServiceAccount에는 cluster-admin을 부여하지 않았으며 `unsafeUseServiceAccountToken=false`로 사용자 토큰 로그인을 유지한다.

자동 승인 검토가 별도 확인 없이 영구 토큰에 `cluster-admin`을 부여하는 작업을 차단했다. 따라서 전체 관리 권한은 적용하지 않았다. 승인 검토 사유는 영구 토큰으로 클러스터 전체 변경·삭제 및 Secret 접근까지 가능해지는 광범위한 지속 권한이다. 사용자의 명시적 승인 전에는 `cluster-admin.proposed.yaml.txt`를 적용하지 않는다. 이 파일은 검토용이며 일반 YAML 디렉터리 적용에 포함되지 않도록 `.txt` 확장자를 사용한다.

## 배포와 검증

```powershell
kubectl --context docker-desktop apply -f deploy/headlamp/access.yaml
& ./.tools/helm/windows-amd64/helm.exe repo add headlamp https://kubernetes-sigs.github.io/headlamp/
& ./.tools/helm/windows-amd64/helm.exe upgrade --install headlamp headlamp/headlamp --version 0.46.0 --namespace headlamp --kube-context docker-desktop -f deploy/headlamp/values.yaml
kubectl --context docker-desktop -n headlamp rollout status deployment/headlamp
```

2026-10-24 확인 결과:

- Headlamp Pod `1/1 Ready`, 공개 HTTPS UI 200.
- 영구 토큰의 `exp` 없음, TokenReview 인증 성공.
- 공개 `/clusters/docker-desktop/api/v1/namespaces`에서 토큰 인증 후 실제 `NamespaceList` 200 응답.
- 해당 계정의 전체 네임스페이스 Pod 조회 가능, Deployment 삭제 불가 확인.
