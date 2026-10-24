# Velero and Velero UI

Velero runs in the `velero` namespace and stores backups under the `velero/` prefix of the existing `milvus` bucket on MinIO. The Velero UI runs in `velero-ui`, is routed through the existing F5 NGINX Ingress at `https://velero.clush.cloud`, and uses the local account configured in the `velero-ui-auth` Secret.

Velero uses the AWS S3-compatible plugin and Kopia node-agent filesystem backups for Pod volumes. Volume snapshots are disabled because this cluster's local-path PVCs do not have a cloud snapshot provider. Backups are stored on the same Docker Desktop cluster disk as MinIO; they protect against accidental Kubernetes object deletion, but not loss of the host or its local disk. Copy important backups off-host for disaster recovery.

The existing MinIO root storage Secret is copied to the Velero namespace because the available MinIO deployment does not provide the `mc` admin client. This grants the Velero storage plugin broader MinIO access than a dedicated bucket-scoped user; use a restricted MinIO service account before using the cluster for untrusted workloads. The UI Helm chart's cluster-admin binding is disabled.

## Install

Run from the repository root in PowerShell. The script copies the existing MinIO storage credentials into a Velero-only Secret and generates a random UI signing key. The UI password is prompted without echo and is not saved in the repository.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/velero/Install-Velero.ps1
```

When prompted, enter `root` for the Velero UI administrator name and the requested password. Retrieve or rotate credentials using Kubernetes Secrets; do not put passwords in values files or source control.

## Back up

The default storage location is configured for file-system volume backups. To create an on-demand backup of all namespaces:

```powershell
kubectl --context docker-desktop -n velero create backup cluster-backup-$(Get-Date -Format yyyyMMdd-HHmmss)
```

The UI can also create and inspect backups at `https://velero.clush.cloud`. To submit an on-demand cluster backup, save this manifest as `backup.yaml`, using a new name for each backup:

```yaml
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: cluster-backup-YYYYMMDD-HHMMSS
  namespace: velero
spec:
  includedNamespaces:
    - "*"
  defaultVolumesToFsBackup: true
  ttl: 720h
```

Apply it with `kubectl --context docker-desktop apply -f backup.yaml`. A backup is not considered protected until its status is `Completed`; PVC content is included through node-agent filesystem backup.
