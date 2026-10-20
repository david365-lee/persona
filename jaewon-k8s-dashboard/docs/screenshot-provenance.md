# Documentation screenshots

The images in `media/screenshots` show the actual dashboard renderer with
synthetic local fixtures, not customer cluster data. Recreate them with
`scripts/capture-docs.cjs`, Playwright Core, and a Chromium executable.
Set `JAEWON_PLAYWRIGHT_PATH` to the installed Playwright Core module when it
is outside normal Node module resolution. These screenshots illustrate the UI;
they do not establish successful live cluster connectivity.
