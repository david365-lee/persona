# Kubernetes Metrics Server

Metrics Server is installed in `kube-system` from the official Helm chart
3.13.0. It supplies the Kubernetes Metrics API used by `kubectl top` and CPU/
memory-based autoscaling. It is not a replacement for Prometheus and does not
provide long-term metric history.

Install or update from the repository root in PowerShell:

```powershell
.\deploy\metrics-server\Install-MetricsServer.ps1
```

The Docker Desktop Kind node uses a kubelet certificate that Metrics Server
cannot validate by default, so the chart enables `--kubelet-insecure-tls`.
Metrics Server remains internal to the cluster and has no public Ingress.

The installer applies `../nexus/resources-patch.yaml` first. Nexus currently
uses about 1.3 GiB; its memory request is reduced from 2 GiB to 1536 MiB while
the existing 4 GiB memory limit is preserved. This frees scheduling capacity
without lowering Nexus's runtime limit.
