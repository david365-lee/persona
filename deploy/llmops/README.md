# LLMOps sample platform integration

Source: `samples/llmops-support-assistant/` and the private GitLab project
https://gitlab.clush.cloud/root/llmops-support-assistant.

The sample integrates the existing Langflow, LiteLLM, Harbor, GitLab, Argo CD,
Prometheus and Grafana installations. LangChain and LangGraph are Python libraries
inside the sample image, not independent infrastructure services. There is no
model training or MLflow server in this sample.

`llmops-ci` has a project-locked, protected-ref-only Kubernetes Runner with
concurrency 1 and namespace-scoped RBAC. It does not mount Docker's socket or use
privileged containers. Rootless BuildKit needs the declared seccomp setting in
CI Pods. The deployed application keeps RuntimeDefault seccomp and runs as UID
10001 with a read-only root filesystem and no mounted service-account token.

Credentials are confined to Kubernetes Secrets and masked/protected GitLab CI
variables. The 90-day GitLab automation token belongs to a project bot with
Maintainer access only to this sample project. The Argo deploy token only reads
this repository. Harbor robots are restricted to the `llmops` project and
separate push/pull credentials. The LiteLLM virtual key permits only
`gemini-3.5-flash-lite`, expires in 90 days, and has a $1/30d budget.

Secrets:

| Namespace / Secret | Purpose |
| --- | --- |
| `gitlab/llmops-project-automation` | Scoped project API automation; project ID/URL |
| `llmops-ci/gitlab-runner-auth` | Project Runner authentication |
| `llmops-ci/harbor-robots` | Project push and pull robot credentials |
| `llmops-ci/harbor-pull` | CI job image pulling |
| `llmops-sample/harbor-pull` | Application image pulling |
| `llmops-sample/support-assistant-auth` | App token and LiteLLM virtual key |
| `argocd/llmops-gitlab-repository` | Read-only Git repository credential |
| `langflow/support-assistant-link` | Internal API URL and app token for the flow |

View the app token locally when using Swagger:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/llmops/Get-SampleCredentials.ps1
```

Check pipelines without displaying secrets:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/llmops/Get-SampleStatus.ps1
kubectl --context docker-desktop -n argocd get application llmops-support-assistant
kubectl --context docker-desktop -n llmops-sample get pods,svc,ingress,servicemonitor
```

`Configure-Integrations.ps1` preserves existing Secrets, creates missing integration
resources, and synchronizes protected CI variables. It is not a password-rotation
script. Rotate expired tokens in each owning service, update dependent Secrets/CI
variables, and restart workloads consuming changed environment values. Reapply
`deploy/langflow/langflow.yaml` when changing the Langflow environment references.

`Publish-Sample.ps1` publishes source files through the project-scoped GitLab API.
Use `-Paths` for subsequent edits so local copies of GitOps release manifests do
not overwrite a newer CI-promoted image tag. GitLab is the release source of truth.
For normal development, clone the sample GitLab repository and push changes there.

The sample uses the existing wildcard Cloudflare policy and shared F5 NGINX
Ingress. No Cloudflare setting or shared origin-port mapping is changed.

Harbor's `registry.relativeurls=true` is set in Helm and
`deploy/platform/harbor-values.yaml`. Without relative Location headers, the
existing forwarded-protocol chain produced `https, http://...` upload locations
that BuildKit rejected. Relative upload URLs preserve the public HTTPS registry
and require no Cloudflare changes.

GitOps promotion uses `GITLAB_INTERNAL_API_URL` inside the cluster. The public
Cloudflare route returned error 1010 for Python urllib's API request; an identical
read using the internal GitLab Service returned 200. No Cloudflare exception is
added. GitLab browser/clone URLs and Argo CD's read-only Git URL stay on HTTPS.
