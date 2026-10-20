# Documentation screenshots

The `live-pods.png`, `live-deployment.png`, and `live-helm.png` images are
unchanged screenshots provided by the user on 2026-10-21 for publication.
They show the user's local RKE2 cluster at capture time, including historical
unhealthy Pod states; they do not assert current cluster health.
Source captures: 00:25:31 (Pods), 00:39:11 (Deployment), 00:38:33 (Helm).

The other images in `media/screenshots` show the actual dashboard renderer with
synthetic local fixtures, not customer cluster data. Recreate them with
`scripts/capture-docs.cjs`, Playwright Core, and a Chromium executable.
Set `JAEWON_PLAYWRIGHT_PATH` to the installed Playwright Core module when it
is outside normal Node module resolution. These screenshots illustrate the UI;
they do not establish successful live cluster connectivity.
