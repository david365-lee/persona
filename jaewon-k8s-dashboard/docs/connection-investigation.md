# Connection investigation

REA inspected the installed k9s v0.51.0 Windows executable (SHA-256
`285a2b2b66eb3294bbd5ceb3a936e6cd8084401a70ecf45e5a04be0ea59fe34b`).
Evidence ID: `ev_e4de9c22eb7d543f5f92963542e625259892310c705d0ff6c65fb0748984c8f7`.
Embedded build metadata includes `k8s.io/client-go v0.35.3`,
`k8s.io/cli-runtime v0.35.1`, and `k8s.io/kubectl v0.35.1`.
Metadata establishes dependencies, not executed connection behavior.

The configured VS Code k9s terminal explicitly selects the home `.kube/config`
and `local-rke2` context. The dashboard's kubectl context inventory also selects
`local-rke2`. A read-only namespace query using that exact config and context
failed with TCP connection refused at `127.0.0.1:16443`. Existing k9s logs from
2026-10-20 23:54 through 2026-10-21 00:00 Korea time report the same address and
refusal. No listener was returned for that port. This is evidence of a common
unavailable API endpoint, not a dashboard-only authentication failure.

The dashboard had a separate recovery defect: after settings/context discovery
failed, Refresh called only resource loading; it never retried discovery. After
namespace discovery failed, subsequent polling could load resources but leave
the namespace picker empty. The fix retries initialization and retries namespace
discovery until it succeeds for the selected context. Context changes invalidate
the previous namespace inventory. Startup failures now update the status text.

Validation: 36 Node tests passed, including renderer execution with initial
settings, context, and namespace failures followed by successful Refresh.
Live successful API validation remains pending restoration of the local API
listener/tunnel. Cluster credentials, TLS settings, global context, and endpoint
were not modified.
