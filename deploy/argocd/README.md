# Argo CD

Argo CD is installed in the `argocd` namespace using the Argo Helm chart
10.11.1 (Argo CD 3.5.6). Its UI and API are available at
https://argocd.clush.cloud through the shared F5 NGINX Ingress Controller.
The Argo CD server uses HTTP behind the existing ingress; public TLS and
origin routing remain managed by the existing Cloudflare and ingress setup.

Install or update from the repository root in PowerShell:

```powershell
.\deploy\argocd\Install-ArgoCD.ps1
```

The script prompts securely for the `root` administrator password, stores only
its bcrypt hash in the `argocd-secret` Kubernetes Secret, and validates login
through the public API. Do not put the password in Helm values or repository
files. The built-in `admin` account is disabled; `root` has the administrator
role.

The single-node cluster has limited unallocated memory request capacity. Dex
and Notifications are disabled; ApplicationSet remains enabled with one
replica. The Argo CD components use bounded requests and limits in
`values.yaml`. Increase cluster memory before enabling additional components
or managing many applications.
