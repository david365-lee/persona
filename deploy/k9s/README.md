# Docker Desktop k9s 확장의 Kind 호환 수정

2026-10-24에 `spurin/k9s-dd-extension:latest`의 오류를 수정했다.

Kubernetes는 정상 실행 중이지만 Docker Desktop의 Kind 클러스터 kubeconfig는 `https://127.0.0.1:<동적 포트>`를 사용한다. 기존 확장은 호스트 kubeconfig를 컨테이너에 그대로 복사하여 컨테이너 자신의 loopback 주소에 접속했다. 연결 실패를 UI에서 Kubernetes 미활성화로 표시했다.

수정 내용:

- 확장에 전달하는 사본에서만 API 호스트를 `host.docker.internal`로 변경한다.
- `tls-server-name`은 원래 `127.0.0.1` 또는 `localhost`로 유지하여 인증서 검증을 정상 수행한다. TLS 검증을 끄지 않는다.
- 설치된 확장 UI에도 동일한 변환을 적용하여 탭 재진입 시 원래의 잘못된 주소로 덮어쓰지 않게 한다.
- 호스트의 원본 kubeconfig는 변경하지 않는다. Kubernetes나 앱을 재시작하지 않는다.
- UI 번들과 확장 kubeconfig는 수정 전에 각각 백업한다.

백엔드의 `kubectl cluster-info`, k9s 컨테이너의 전체 Pod 조회를 확인했다. Docker Desktop 화면만 새로고침한 후 k9s 화면에 `docker-desktop`, Kubernetes `v1.36.1`, 전체 Pod 25개가 정상 표시되는 것을 직접 확인했다.

확장을 업데이트/재설치하면 UI 수정이 덮어써질 수 있다. 같은 문제가 재발하면 다음 명령을 사용한다. 이 스크립트는 검증한 번들 패턴과 다르면 임의로 수정하지 않고 중단한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/k9s/Repair-KindExtension.ps1
```

실행 후 k9s 탭을 다시 열거나 Docker Desktop **화면만** 새로고침한다. Kubernetes 클러스터 초기화나 kubeadm 모드 전환은 필요하지 않다.
