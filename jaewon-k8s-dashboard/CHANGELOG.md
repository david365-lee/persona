# Changelog

## 0.2.0

- Distinguish current Pod failures from historical container termination; account for init and restartable sidecar readiness and restarts.
- Show regular, init, and ephemeral container details and workload templates, including current state and previous termination.
- Preserve set-based label selectors for workload shells and restrict shell targets to running, non-terminating Pods.
- Restore dashboard tabs and saved navigation state; pause hidden dashboard polling and refresh when shown.
- Display the custom icon in the dashboard header and editor tab.
- Sort resource events by timestamp and separate healthy restart history in health reports.
- Record focused REA analysis, evidence, validation, and remaining limitations in `docs/rea-expansion-0.2.0.md`.

## 0.1.3

- Include the custom extension icon in the VSIX manifest and Marketplace icon asset.
