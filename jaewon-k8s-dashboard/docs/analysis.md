# REA 분석 및 구현 경계

대상: 설치된 VS Code 확장 `utiltools.kubernetes-dashboard-utiltools` 1.0.4.

아티팩트 SHA-256: `76b3776152a498bb6e716d7a6ae8e46936e830c26f5b1bc8cd6925a27e8bc9e0`.

## 관찰 및 근거

- `ev_f90807158b3651b053a2eb5fa84f602e19ed713d5001074b026ba1f35c2f8b71`: 설치된 전체 JavaScript 트리를 REA `analyze_javascript_application`으로 정적 분석. 공용 `bridge.js` 분석 중 worker 메모리 한도로 일부 분석이 미완료되었다.
- `ev_078b2f8589ee286b6245f268e8c4a14accdd656e2e216991180386d33b9e8920`: manifest와 `dist/extension.js`를 선택한 집중 분석. 두 파일 합계 121,468바이트를 읽고 JavaScript 1개를 파싱했다. 파싱 실패는 없었고 104개 finding이 기록되었다. 의미 그래프는 노드 한도로 일부 잘렸으며 선택하지 않은 8개 파일의 관계는 미확인이다.
- `ev_1f1c1bbfd2c401a837040635dc02cacb8b3e765b1fdc9a089c39bb7c3f43b854`: 위 집중 분석의 요약 receipt. `rea-summary.json`에 보관했다.
- `ev_f00019855ff1ba5f0c92e5e24c30ad589b80009b787d4ab658094ba4761eaea5`: 실행부에서 `node:child_process` 참조 등 정적 후보를 확인한 projection. 이는 실행 증거가 아니다.
- 추가 endpoint projection에서 설정 키 `kubectlPath`, `helmPath`, `kubeconfig`, `refreshSeconds`, `metrics`, `logTailLines`, `logMaxLines`, `autoStartPortForwards`의 source-range가 확인되었다. REA는 `.get()` 설정 접근도 network candidate로 분류하므로 이를 실제 네트워크 호출로 해석하지 않았다.
- 별도로 manifest의 명령·메뉴·설정과 README의 기능을 읽어 `feature-inventory.md`로 정리했다. README 설명은 광고된 동작이며 실행 확인과 구분한다.

## 구현

원본 코드·번들·스타일·아이콘·폰트를 복사하거나 실행하지 않고 Node.js/VS Code API와 Kubernetes CLI로 독립 구현했다. 새 확장의 이름은 `jaewon-k8s-dashboard`, ID는 `jaewon.jaewon-k8s-dashboard`이다.

원본의 상업용 라이선스/구독/결제 화면은 Kubernetes 관리 기능에 해당하지 않아 새 확장에는 포함하지 않았다. 기존 확장의 라이선스 검사나 결제 상태는 수정하지 않는다.

## 동등성의 한계

원본 확장의 모든 UI/실행 경로를 재현·비교한 것은 아니다. 따라서 완전한 동등성을 입증하지 않는다. 테이블은 가상 스크롤 대신 150행 단위 페이지를 사용한다. 메트릭 이력은 선택한 Pod/Node의 상세가 열려 있을 때 축적하며 과거 이력은 저장하지 않는다. Kubernetes RBAC, 실행 파일, metrics-server, 컨테이너 셸 유무에 따라 기능이 제한될 수 있다.

실제 클러스터 읽기/로그/포워딩 검증 결과는 `smoke-result.json`으로 기록한다. 삭제·재시작·확장·YAML 적용·Helm 변경은 원래 리소스에 실행하지 않았으며 명령 구성과 확인 취소 경로를 테스트한다.
