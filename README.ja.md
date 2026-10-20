<p align="center">
  <img src="jaewon-k8s-dashboard/media/jaewon-icon-128.png" width="128" height="128" alt="Jaewon K8s Dashboard アイコン">
</p>

# Jaewon K8s Dashboard

[한국어](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

VS Code 内で Kubernetes クラスターを探索し、ログ、Helm リリース、ポートフォワードを管理できる拡張機能です。韓国の開発者 **jaewon** が制作し、MIT ライセンスで無料公開しています。

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jaewon-lee.jaewon-k8s-dashboard) · [リリース・VSIX ダウンロード](https://github.com/david365-lee/persona/releases/latest) · [拡張機能ガイド（韓国語）](jaewon-k8s-dashboard/README.md)

## 主な機能

| 機能 | 説明 |
| --- | --- |
| クラスター探索 | コンテキストごとのダッシュボードタブ、名前空間の選択、リソースの検索・並べ替え・ページ切り替え |
| リソース詳細 | コンテナー、条件、イベント、ラベル、アノテーション、Secret の個別キーの確認 |
| ログ | 複数の Pod・コンテナーのリアルタイムログと前回のログ、フィルター、正規表現、強調表示、コピー、保存 |
| リソース操作 | コンテナーのシェル、YAML の編集・適用、再起動、スケーリング、削除、CronJob の実行・一時停止、ノードの cordon/uncordon |
| ポートフォワード | ローカル接続、自動再接続、設定の保存、自動起動 |
| Helm | リリース一覧、values、manifest、notes、history、rollback、uninstall |
| 状態確認 | CPU・メモリのメトリクスと履歴、Markdown 形式のクラスター状態レポート |

Pods、Deployments、StatefulSets、DaemonSets、ReplicaSets、Jobs、CronJobs、Services、Ingresses、ConfigMaps、Secrets、PVCs、Nodes、Namespaces、Events、CRDs を探索できます。

## インストール

### VS Code Marketplace

1. VS Code の拡張機能ビューで **Jaewon K8s Dashboard** を検索します。
2. 拡張機能 ID が `jaewon-lee.jaewon-k8s-dashboard` であることを確認してインストールします。

ターミナルからもインストールできます。

```sh
code --install-extension jaewon-lee.jaewon-k8s-dashboard
```

### VSIX ファイルからインストール

1. [GitHub Releases](https://github.com/david365-lee/persona/releases/latest) から `.vsix` ファイルをダウンロードします。
2. VS Code のコマンドパレットで **Extensions: Install from VSIX...** を実行し、ファイルを選択します。
3. 必要に応じて **Developer: Reload Window** を実行します。

## 使い始める

VS Code **1.90.0 以降**、ローカルの `kubectl`、接続先クラスターの kubeconfig が必要です。Helm 機能を使う場合は `helm` もインストールしてください。メトリクスは、クラスターが Metrics API を提供している場合に利用できます。

まずターミナルで接続を確認します。

```sh
kubectl config get-contexts
kubectl get namespaces
```

コマンドパレットで **Jaewon K8s: Open Dashboard** を実行するか、**Ctrl+Alt+J**（macOS では **Cmd+Alt+J**）を押します。ダッシュボード上部でコンテキストと名前空間を選択して、リソースを探索してください。

アクティビティバーの **Jaewon K8s** から、クラスターと保存済みポートフォワードを確認できます。表示されない場合は **Jaewon K8s: Show Sidebar** を実行してください。

## 設定

VS Code の設定で `jaewonK8s` を検索するか、`settings.json` に以下の値を指定します。

| 設定 | 既定値 | 説明 |
| --- | --- | --- |
| `jaewonK8s.kubectlPath` | `kubectl` | kubectl 実行ファイルのパス |
| `jaewonK8s.helmPath` | `helm` | Helm 実行ファイルのパス |
| `jaewonK8s.kubeconfig` | 空文字列 | kubeconfig のパス。空の場合は環境変数と既定の場所を使用 |
| `jaewonK8s.refreshSeconds` | `5` | 自動更新の間隔（秒） |
| `jaewonK8s.metrics` | `true` | メトリクスの有効化 |
| `jaewonK8s.logTailLines` | `300` | 最初に取得するログの行数 |
| `jaewonK8s.logMaxLines` | `50000` | 保持するログの最大行数 |
| `jaewonK8s.autoStartPortForwards` | `true` | 保存済みポートフォワードの自動起動 |
| `jaewonK8s.commandTimeout` | `30000` | 通常コマンドのタイムアウト（ミリ秒） |

すべてのクラスター操作には、選択したコンテキストと既存の kubeconfig の RBAC 権限が適用されます。kubectl の既定コンテキストの変更は別のコマンドで行います。ポートフォワードは `127.0.0.1` にバインドされます。

## 開発とパッケージ作成

ソースは [jaewon-k8s-dashboard](jaewon-k8s-dashboard) にあります。Node.js が必要です。テストと VSIX の生成には Node.js の組み込み機能を使用するため、追加の npm パッケージのインストールは不要です。

```sh
git clone https://github.com/david365-lee/persona.git
cd persona/jaewon-k8s-dashboard
npm test
npm run package
```

拡張機能のフォルダーに `jaewon-k8s-dashboard-<version>.vsix` が生成されます。PowerShell の実行ポリシーで `npm` がブロックされる場合は、`npm.cmd test` と `npm.cmd run package` を使用してください。

| パス | 内容 |
| --- | --- |
| [src](jaewon-k8s-dashboard/src) | 拡張機能のコマンド、kubectl・Helm 連携、ログ、ポートフォワード |
| [media](jaewon-k8s-dashboard/media) | ダッシュボード UI、スタイル、アイコン |
| [scripts/package.cjs](jaewon-k8s-dashboard/scripts/package.cjs) | VSIX パッケージ作成 |
| [docs](jaewon-k8s-dashboard/docs) | 分析根拠、機能一覧、検証記録 |

## 実装範囲

インストール済みの utiltools Kubernetes Dashboard 1.0.4 の manifest、README、静的解析をもとに独立して実装しました。元のコードやアセットは含まれていません。元の実行結果との完全な同等性は検証していません。リソース表は 1 ページあたり 150 行で表示し、メトリクス履歴は詳細画面を開いている間に収集します。

## お問い合わせとライセンス

不具合や機能の提案は [GitHub Issues](https://github.com/david365-lee/persona/issues) にお寄せください。エラーメッセージ、再現手順、VS Code と拡張機能のバージョンを記載してください。

韓国の開発者 **jaewon** が制作し、無料で公開しています。[MIT License](jaewon-k8s-dashboard/LICENSE)。
