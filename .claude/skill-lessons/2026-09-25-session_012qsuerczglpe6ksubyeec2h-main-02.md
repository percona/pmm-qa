# candidate: pmm-ha-docker-provisioning — Docker-based PMM HA from the docs guide needs three fixes to work

- Added: 2026-09-25
- Applies to: candidate skill (Docker/HAProxy PMM HA reproduction; complements linode-ha-provisioning which is Helm-only)
- Evidence: Following the PMM 3.6.0 docs "Manual setup (advanced)" Docker HA guide verbatim, qan-api2 crash-looped (ClickHouse 25.3 rejects passwordless `default`; PMM defaults to password `clickhouse`), and pmm-agent could register but not open its gRPC stream through HAProxy until `alpn h2,http/1.1` was added to the 443 bind and servers plus `check-alpn http/1.1` on servers so leaderHealthCheck kept passing; the guide's `GF_DATABASE_NAME=grafana \` line also carries trailing spaces that break the copied command.
- Proposed change: Capture a Docker HA recipe (3 PMM nodes, shared PG/CH/VM, HAProxy) with CLICKHOUSE_PASSWORD=clickhouse, the ALPN/check-alpn HAProxy lines, and the trailing-space fix, for bugs needing the non-Helm HA path.
