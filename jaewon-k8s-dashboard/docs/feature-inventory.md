# Reference extension feature inventory

Follow-up: [REA analysis and 0.2.0 implementation ledger (Korean)](rea-expansion-0.2.0.md). The original unchecked list below is a reference inventory, not a claim that every capability is missing or fully equivalent. Current improvements cover shared Pod health logic, container lifecycle details, workload shell selectors, dashboard restoration, and visibility-aware refresh. Sidebar webview parity and virtualized tables remain open.

Evidence: installed `utiltools.kubernetes-dashboard-utiltools` version **1.0.4**, `package.json` and `README.md` under `C:/Users/zosel/.vscode/extensions/utiltools.kubernetes-dashboard-utiltools-1.0.4`. This is a static manifest and advertised behavior inventory, not a report of executed or verified cluster operations. No implementation source was copied. Manifest keywords are search metadata and are not evidence of additional features.

## Feature parity checklist

- [ ] Editor dashboard and activity-bar sidebar dashboard; cluster tree and port-forward tree; open current dashboard or a separate tab for a context.
- [ ] Context selection and refresh; explicit context on operations without changing global kubectl context; separate intentional switch-current-context action; namespace selection and cross-namespace browsing.
- [ ] Pods, Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, Nodes, Namespaces, Events; virtualized sortable tables and text/status/namespace/negation filtering.
- [ ] kubectl-style pod health including CrashLoopBackOff, ImagePullBackOff, init progress, Terminating, OOMKilled; readiness, restarts, node, IP, age; refresh while visible and suspend background polling.
- [ ] Object detail: conditions, containers, image/state/restarts, requests/limits, ports, labels and annotations, newest object events, inline ConfigMap data, hidden Secret values with deliberate reveal/copy and decoding.
- [ ] Live CPU and memory plus pod sparklines against limits, using optional metrics-server.
- [ ] Logs from individual pods and merged controller pods (Deployment, StatefulSet, DaemonSet, Job); timestamp ordering and automatic discovery of new pods; container selection and previous-container logs.
- [ ] Log text/regex filter, case sensitivity, filter/highlight mode, per-pod toggles, timestamp display, wrap, pause/resume, copy/editor/save export; warning/error colors and ANSI stripping; bounded retention.
- [ ] Container shell in VS Code terminal; describe; editable YAML in normal editor with Apply to Cluster; delete confirmation; pod restart, workload rollout restart and scaling; CronJob run now/suspend/resume; node cordon/uncordon.
- [ ] Pod/Service/Deployment/StatefulSet port forwards; discover container ports, selectable local or automatic port; reconnect on restart/wake; save and auto-start; stop/restart/forget; browser launch and tree management.
- [ ] Helm releases across namespaces: status/chart/app version, values/manifest/notes, history, rollback, uninstall; optional local helm CLI.
- [ ] Markdown cluster health report, copied and opened in editor: failing/pending/restarting pods, Deployment/StatefulSet replica shortages, non-Ready nodes.
- [ ] Native VS Code colors supporting light/dark/high contrast; keyboard navigation and action shortcuts; missing-kubectl and empty-context onboarding.

Commercial trial, purchase, checkout, restore, licence server and telemetry are advertised reference-product behavior, not Kubernetes capability. A new independent extension should not copy its branding, licensing service or purchase flow.

## Commands contributed by manifest

All command identifiers below have prefix `kubernetesDashboard.` and category `Kubernetes`.

| Suffix | Title |
|---|---|
| open | Open Dashboard |
| openNewTab | Open Dashboard in New Tab |
| showPods | Show Pods |
| showHelm | Show Helm Releases |
| showPortForwards | Show Port Forwards |
| useContext | Switch kubectl Context |
| refreshContexts | Refresh Contexts |
| openContext | Open Dashboard for Context |
| openContextNewTab | Open Context in New Tab |
| applyFile | Apply to Cluster |
| forward.stop | Stop Port Forward |
| forward.start | Start Port Forward |
| forward.open | Open in Browser |
| forward.save | Save and Auto-start |
| forward.forget | Remove from Saved |
| openPaywall | Go Unlimited |
| restore | Restore Purchase |
| healthReport | Cluster Health Report (copy as Markdown) |

Open shortcut: Ctrl+Alt+K (macOS Cmd+Alt+K). README action keys: L logs, S shell, F forward, R restart, + scale, E YAML edit, D describe, T run CronJob, U suspend/resume CronJob, C cordon/uncordon, Delete delete, / filter, j/k or arrows navigation, Enter details, Esc close, [ and ] resource kind, ? help. The README arrow glyph has encoding damage in the installed file; exact arrow mapping is not established by this inventory.

## Settings

Manifest prefix: `kubernetesDashboard.`.

| Suffix | Type | Default | Constraints / purpose |
|---|---|---|---|
| kubectlPath | string | kubectl | Machine scope; executable path |
| helmPath | string | helm | Machine scope; executable path |
| kubeconfig | string | empty | Machine scope; KUBECONFIG or ~/.kube/config fallback; multiple files separated by platform path delimiter |
| refreshSeconds | number | 5 | 2–300 seconds |
| metrics | boolean | true | kubectl top / metrics-server |
| logTailLines | number | 300 | Minimum 0; initial lines per container |
| logMaxLines | number | 50000 | Minimum 1000; oldest lines dropped |
| autoStartPortForwards | boolean | true | Restore saved auto-start forwards when VS Code opens |

## VS Code integration and requirements

Manifest engine: VS Code ^1.90.0. Activates on startup finished, dashboard webview restoration, or sidebar view. Activity container has Dashboard webview, Clusters tree, Port Forwards tree. Context actions open same/new tab and intentionally switch kubectl context. Forward actions depend on active/inactive/saved state. YAML Apply appears in explorer context, YAML command palette, and tracked YAML editor title. Missing kubectl onboarding links install instructions/settings; empty-context onboarding links kubeconfig setting.

README claims Windows/macOS/Linux and any local kubectl-supported cluster, including SSO/exec authentication. Optional helm and metrics-server enable their related features. Advertised privacy: cluster commands run locally and cluster data stays local; reference product additionally contacts its licence service and may emit anonymous usage telemetry. These claims were not dynamically verified.
