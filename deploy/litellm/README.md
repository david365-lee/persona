# LiteLLM — litellm.clush.cloud

LiteLLM Proxy is deployed as a single Kubernetes Pod in the `litellm` namespace. The `litellm.clush.cloud` host uses the existing F5 NGINX Ingress Controller and shared Cloudflare wildcard routing. `llmapi.clush.cloud` maps to the same proxy's Swagger/API root. No Cloudflare or per-application LoadBalancer changes are needed.

The pinned image is `ghcr.io/berriai/litellm:v1.106.3`. The proxy master key and Admin UI bootstrap credentials are stored in the `litellm-auth` Kubernetes Secret and are not included in this repository.

## Deploy

Create the namespace, a unique proxy master key, and the requested UI bootstrap credentials, then apply the workload:

```powershell
kubectl --context docker-desktop create namespace litellm
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$random.GetBytes($bytes)
$key = 'sk-' + [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$uiPassword = Read-Host 'LiteLLM Admin UI password'
kubectl --context docker-desktop -n litellm create secret generic litellm-auth --from-literal="LITELLM_MASTER_KEY=$key" --from-literal=UI_USERNAME=root --from-literal="UI_PASSWORD=$uiPassword"
$key = $null
$uiPassword = $null
$bytes = $null
$random.Dispose()
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/litellm/Initialize-DatabaseSecret.ps1
kubectl --context docker-desktop apply -f deploy/litellm/postgres.yaml
kubectl --context docker-desktop -n litellm rollout status deployment/litellm-postgres --timeout=5m
kubectl --context docker-desktop apply -f deploy/litellm/litellm.yaml
kubectl --context docker-desktop -n litellm rollout status deployment/litellm --timeout=10m
```

The manifest also declares the namespace, so it can be reapplied after initial setup. The Secret is deliberately created separately and must exist before the Pod can start.

The Admin UI login is `root` and the password supplied during Secret creation. Open `https://litellm.clush.cloud/` to redirect to `/ui/` while staying on HTTPS port 443. Swagger and the API are available at `https://llmapi.clush.cloud/`.

```powershell
kubectl --context docker-desktop -n litellm get secret litellm-auth -o jsonpath='{.data.LITELLM_MASTER_KEY}' | ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

## Configuration scope

The initial `model_list` is empty because no provider or model credentials were supplied. The proxy is protected by the generated master key, but it cannot serve model requests until a provider/model is configured. PostgreSQL 16 runs as the internal `litellm-postgres` ClusterIP service, with a 10Gi PVC using `platform-local-retain`. LiteLLM connects through `DATABASE_URL` in the `litellm-db` Secret and applies its schema migrations on startup. The database supports Admin UI login and persists users, keys, and usage data. Models can also be added through the Admin UI because `STORE_MODEL_IN_DB=True`; provider credentials are encrypted using the existing `LITELLM_SALT_KEY`. Do not commit provider credentials; store them in Kubernetes Secrets and reference them with LiteLLM's `os.environ/VARIABLE_NAME` syntax.

`Initialize-DatabaseSecret.ps1` generates random database credentials and an encryption salt only when the Secret does not exist. Preserve and back up both the database and `litellm-db`: never regenerate `LITELLM_SALT_KEY` after encrypted credentials are stored, and never replace the database password without also changing the PostgreSQL role password. The PVC survives Pod replacement; the local retained volume is not an independent backup. PostgreSQL is not exposed through a public Ingress or LoadBalancer.

## Verify

```powershell
kubectl --context docker-desktop -n litellm get pods,svc,ingress
Invoke-WebRequest -Uri https://litellm.clush.cloud/health/liveliness
Invoke-WebRequest -Uri https://llmapi.clush.cloud/openapi.json
```
