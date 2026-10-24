# Langflow — langflow.clush.cloud

Deploy a single Langflow instance with SQLite data stored on a 10Gi `platform-local-retain` PVC. The UI is routed through the shared NGINX Ingress; it does not create a per-application LoadBalancer. Authentication is required and the `root` superuser password is read from the `langflow-auth` Secret.

## Install

Enter the requested administrator password without echoing it, generate a persistent signing key, then create the Secret and apply the workload:

```powershell
$namespace = kubectl --context docker-desktop create namespace langflow --dry-run=client -o yaml
$namespace | kubectl --context docker-desktop apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Failed to prepare the Langflow namespace' }
$password = Read-Host 'Langflow root administrator password' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $password).Password
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secretKey = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
try {
    kubectl --context docker-desktop -n langflow create secret generic langflow-auth --from-literal="password=$plainPassword" --from-literal="secret-key=$secretKey"
    kubectl --context docker-desktop apply -f deploy/langflow/langflow.yaml
    kubectl --context docker-desktop -n langflow rollout status deployment/langflow --timeout=15m
}
finally {
    $plainPassword = $null
    $secretKey = $null
    [Array]::Clear($bytes, 0, $bytes.Length)
    $rng.Dispose()
    $password.Dispose()
}
```

Sign in to `https://langflow.clush.cloud` as `root`. Custom component authoring is restricted to the administrator because custom code runs on the server. This standalone deployment includes the LangChain integrations shipped in Langflow, but does not install LangChain as a separate application service. LangGraph requires a graph application image or source repository; there is no user application to run yet.
