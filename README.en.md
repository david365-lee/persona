<p align="center">
  <img src="jaewon-k8s-dashboard/media/jaewon-icon-128.png" width="128" height="128" alt="Jaewon K8s Dashboard icon">
</p>

# Jaewon K8s Dashboard

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

A VS Code extension for exploring Kubernetes clusters and managing logs, Helm releases, and port forwards. Created by **jaewon**, a developer from South Korea, and distributed for free under the MIT License.

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jaewon-lee.jaewon-k8s-dashboard) · [Releases and VSIX downloads](https://github.com/david365-lee/persona/releases/latest) · [Extension guide (Korean)](jaewon-k8s-dashboard/README.md)

## Features

### Improvements in 0.2.0

- Distinguish current Pod failures from restart history, including init container and sidecar status and readiness.
- Inspect regular, init, and ephemeral containers, workload templates, and previous termination reasons.
- Restore dashboard context, namespace, and filters when reopening VS Code. Automatic refresh pauses while the dashboard is hidden.
- Preserve set-based label selectors for workload shells and offer only running Pods that are not being deleted.
- Display the custom icon in the dashboard header and editor tab.

[REA analysis and validation record (Korean)](jaewon-k8s-dashboard/docs/rea-expansion-0.2.0.md)

| Feature | Description |
| --- | --- |
| Cluster explorer | Dashboard tabs for each context, namespace selection, resource filtering, sorting, and pagination |
| Resource details | Inspect containers, conditions, events, labels, annotations, and individual Secret keys |
| Logs | Live and previous logs from multiple Pods and containers; filtering, regular expressions, highlighting, copying, and saving |
| Resource operations | Container shells, YAML editing and applying, restarts, scaling, deletion, CronJob runs and suspension, and node cordon/uncordon |
| Port forwarding | Local connections, automatic reconnection, saved configurations, and automatic startup |
| Helm | Releases, values, manifests, notes, history, rollback, and uninstall |
| Health and metrics | CPU and memory metrics and history, plus Markdown cluster health reports |

Browse Pods, Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, Nodes, Namespaces, Events, and CRDs.

## Installation

### VS Code Marketplace

1. Search for **Jaewon K8s Dashboard** in the VS Code Extensions view.
2. Verify the extension ID is `jaewon-lee.jaewon-k8s-dashboard`, then install it.

You can also install it from a terminal:

```sh
code --install-extension jaewon-lee.jaewon-k8s-dashboard
```

### Install from VSIX

1. Download the `.vsix` file from [GitHub Releases](https://github.com/david365-lee/persona/releases/latest).
2. Run **Extensions: Install from VSIX...** from the VS Code Command Palette and select the file.
3. Run **Developer: Reload Window** if needed.

## Getting started

You need VS Code **1.90.0 or later**, a local `kubectl` executable, and a kubeconfig for the cluster you want to access. Install `helm` to use Helm features. Metrics are available when the cluster provides the Metrics API.

Check your connection in a terminal first:

```sh
kubectl config get-contexts
kubectl get namespaces
```

Run **Jaewon K8s: Open Dashboard** from the Command Palette, or press **Ctrl+Alt+J** (**Cmd+Alt+J** on macOS). Select a context and namespace at the top of the dashboard to start exploring resources.

The **Jaewon K8s** entry in the Activity Bar lists clusters and saved port forwards. If it is hidden, run **Jaewon K8s: Show Sidebar**.

## Settings

Search for `jaewonK8s` in VS Code Settings, or set these values in `settings.json`:

| Setting | Default | Description |
| --- | --- | --- |
| `jaewonK8s.kubectlPath` | `kubectl` | Path to the kubectl executable |
| `jaewonK8s.helmPath` | `helm` | Path to the Helm executable |
| `jaewonK8s.kubeconfig` | Empty string | kubeconfig path; leave empty to use environment variables and the default location |
| `jaewonK8s.refreshSeconds` | `5` | Automatic refresh interval in seconds |
| `jaewonK8s.metrics` | `true` | Enable metrics |
| `jaewonK8s.logTailLines` | `300` | Number of log lines fetched initially |
| `jaewonK8s.logMaxLines` | `50000` | Maximum number of retained log lines |
| `jaewonK8s.autoStartPortForwards` | `true` | Automatically start saved port forwards |
| `jaewonK8s.commandTimeout` | `30000` | Timeout for regular commands in milliseconds |

All cluster operations use the selected context and the RBAC permissions of your existing kubeconfig. Changing the default kubectl context is a separate command. Port forwards bind to `127.0.0.1`.

## Development and packaging

The source is in [jaewon-k8s-dashboard](jaewon-k8s-dashboard). Node.js is required. Tests and VSIX packaging use Node.js built-ins, with no additional npm packages to install.

```sh
git clone https://github.com/david365-lee/persona.git
cd persona/jaewon-k8s-dashboard
npm test
npm run package
```

The package is created in the extension directory as `jaewon-k8s-dashboard-<version>.vsix`. If PowerShell execution policy blocks `npm`, use `npm.cmd test` and `npm.cmd run package`.

| Path | Contents |
| --- | --- |
| [src](jaewon-k8s-dashboard/src) | Extension commands, kubectl and Helm integration, logs, and port forwarding |
| [media](jaewon-k8s-dashboard/media) | Dashboard UI, styles, and icons |
| [scripts/package.cjs](jaewon-k8s-dashboard/scripts/package.cjs) | VSIX packaging |
| [docs](jaewon-k8s-dashboard/docs) | Analysis evidence, feature inventory, and validation records |

## Implementation scope

This is an independent implementation based on the manifest, README, and static analysis of an installed copy of utiltools Kubernetes Dashboard 1.0.4. It includes no original code or assets. Full behavioral equivalence with the original has not been verified. Resource tables display 150 rows per page, and metrics history is collected while the details view is open.

## Support and license

Report bugs or suggest features through [GitHub Issues](https://github.com/david365-lee/persona/issues). Include the error message, reproduction steps, and your VS Code and extension versions.

Created and distributed for free by **jaewon**, a developer from South Korea. [MIT License](jaewon-k8s-dashboard/LICENSE).
