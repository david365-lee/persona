<p align="center">
  <img src="jaewon-k8s-dashboard/media/jaewon-icon-128.png" width="128" height="128" alt="Jaewon K8s Dashboard 图标">
</p>

# Jaewon K8s Dashboard

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

在 VS Code 中浏览 Kubernetes 集群，管理日志、Helm 发布和端口转发的扩展。由韩国开发者 **jaewon** 制作，基于 MIT 许可证免费提供。

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jaewon-lee.jaewon-k8s-dashboard) · [版本发布与 VSIX 下载](https://github.com/david365-lee/persona/releases/latest) · [扩展使用指南（韩语）](jaewon-k8s-dashboard/README.md)

## 主要功能

| 功能 | 说明 |
| --- | --- |
| 集群浏览 | 为各上下文打开独立仪表板标签页，选择命名空间，搜索、排序和分页查看资源 |
| 资源详情 | 查看容器、状况、事件、标签、注解以及 Secret 中的单个键 |
| 日志 | 查看多个 Pod 和容器的实时日志及上一次运行的日志，支持筛选、正则表达式、高亮、复制和保存 |
| 资源操作 | 容器 Shell、YAML 编辑与应用、重启、扩缩容、删除、CronJob 执行与暂停，以及节点 cordon/uncordon |
| 端口转发 | 本地连接、自动重连、保存配置和自动启动 |
| Helm | 发布列表、values、manifest、notes、history、rollback 和 uninstall |
| 状态与指标 | CPU、内存指标及历史记录，Markdown 格式的集群健康报告 |

可浏览 Pods、Deployments、StatefulSets、DaemonSets、ReplicaSets、Jobs、CronJobs、Services、Ingresses、ConfigMaps、Secrets、PVCs、Nodes、Namespaces、Events 和 CRDs。

## 安装

### VS Code Marketplace

1. 在 VS Code 扩展视图中搜索 **Jaewon K8s Dashboard**。
2. 确认扩展 ID 为 `jaewon-lee.jaewon-k8s-dashboard` 后安装。

也可以通过终端安装：

```sh
code --install-extension jaewon-lee.jaewon-k8s-dashboard
```

### 使用 VSIX 文件安装

1. 从 [GitHub Releases](https://github.com/david365-lee/persona/releases/latest) 下载 `.vsix` 文件。
2. 在 VS Code 命令面板中执行 **Extensions: Install from VSIX...**，然后选择文件。
3. 如有需要，执行 **Developer: Reload Window**。

## 快速开始

需要 VS Code **1.90.0 或更高版本**、本地 `kubectl` 和目标集群的 kubeconfig。使用 Helm 功能还需要安装 `helm`。集群提供 Metrics API 时，才能使用指标功能。

请先在终端中检查连接：

```sh
kubectl config get-contexts
kubectl get namespaces
```

在命令面板中执行 **Jaewon K8s: Open Dashboard**，或按 **Ctrl+Alt+J**（macOS 使用 **Cmd+Alt+J**）。在仪表板顶部选择上下文和命名空间，即可开始浏览资源。

活动栏中的 **Jaewon K8s** 可显示集群和已保存的端口转发。如果没有显示，请执行 **Jaewon K8s: Show Sidebar**。

## 设置

在 VS Code 设置中搜索 `jaewonK8s`，或在 `settings.json` 中配置以下选项：

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `jaewonK8s.kubectlPath` | `kubectl` | kubectl 可执行文件路径 |
| `jaewonK8s.helmPath` | `helm` | Helm 可执行文件路径 |
| `jaewonK8s.kubeconfig` | 空字符串 | kubeconfig 路径；留空时使用环境变量和默认位置 |
| `jaewonK8s.refreshSeconds` | `5` | 自动刷新间隔（秒） |
| `jaewonK8s.metrics` | `true` | 启用指标 |
| `jaewonK8s.logTailLines` | `300` | 初次获取的日志行数 |
| `jaewonK8s.logMaxLines` | `50000` | 保留的最大日志行数 |
| `jaewonK8s.autoStartPortForwards` | `true` | 自动启动已保存的端口转发 |
| `jaewonK8s.commandTimeout` | `30000` | 常规命令超时时间（毫秒） |

所有集群操作均使用所选上下文，并遵循现有 kubeconfig 的 RBAC 权限。修改 kubectl 默认上下文需要执行单独的命令。端口转发绑定到 `127.0.0.1`。

## 开发与打包

源代码位于 [jaewon-k8s-dashboard](jaewon-k8s-dashboard)。需要安装 Node.js。测试和 VSIX 打包均使用 Node.js 内置功能，无需安装额外的 npm 包。

```sh
git clone https://github.com/david365-lee/persona.git
cd persona/jaewon-k8s-dashboard
npm test
npm run package
```

生成的 `jaewon-k8s-dashboard-<version>.vsix` 位于扩展目录中。如果 PowerShell 执行策略阻止运行 `npm`，请使用 `npm.cmd test` 和 `npm.cmd run package`。

| 路径 | 内容 |
| --- | --- |
| [src](jaewon-k8s-dashboard/src) | 扩展命令、kubectl 与 Helm 集成、日志及端口转发 |
| [media](jaewon-k8s-dashboard/media) | 仪表板界面、样式及图标 |
| [scripts/package.cjs](jaewon-k8s-dashboard/scripts/package.cjs) | VSIX 打包 |
| [docs](jaewon-k8s-dashboard/docs) | 分析依据、功能清单和验证记录 |

## 实现范围

本项目基于已安装的 utiltools Kubernetes Dashboard 1.0.4 的 manifest、README 和静态分析进行独立实现，不包含原始代码或资源。尚未验证与原版运行结果完全一致。资源表每页显示 150 行，指标历史记录仅在详情视图打开时收集。

## 反馈与许可证

请通过 [GitHub Issues](https://github.com/david365-lee/persona/issues) 报告问题或提出功能建议，并附上错误消息、复现步骤以及 VS Code 和扩展版本。

由韩国开发者 **jaewon** 制作并免费提供。[MIT License](jaewon-k8s-dashboard/LICENSE)。
