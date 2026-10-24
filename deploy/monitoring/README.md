# Grafana and Prometheus

The `monitoring` Helm release installs Grafana and Prometheus with Kubernetes exporters and dashboards. It uses the shared F5 NGINX Ingress Controller:

- Grafana: `https://grafana.clush.cloud`
- Prometheus: `https://prometheus.clush.cloud`

Both services have persistent `platform-local-retain` PVCs. Grafana uses 5Gi and Prometheus uses 10Gi with five days of retention. Alertmanager is disabled to keep the single-node installation within available resources.

Grafana's administrator is `root`. Create the `grafana-admin` Secret before installing; the password is not stored in Helm values:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$password = ConvertTo-SecureString 'your-admin-password' -AsPlainText -Force
try {
    & .\deploy\monitoring\Install-Monitoring.ps1 -GrafanaPassword $password
}
finally {
    $password.Dispose()
}
```

After installation, use the following to confirm Grafana's readiness:

```powershell
kubectl --context docker-desktop -n monitoring get pods,svc,ingress,pvc
```

Prometheus is exposed through its UI/API Ingress without application-level authentication. Limit access at the network/Cloudflare layer before storing sensitive metrics.
