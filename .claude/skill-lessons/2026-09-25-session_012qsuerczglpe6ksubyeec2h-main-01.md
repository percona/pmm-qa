# AGENTS.md — Pull Docker Hub images via mirror.gcr.io when anonymous pulls hit 429

- Added: 2026-09-25
- Applies to: all skills that run `docker pull` in a cloud session (linode-docker-provisioning, local Docker repros)
- Evidence: Parallel and then sequential retried `docker pull` of postgres, haproxy, clickhouse and victoria-metrics images failed with `429 Too Many Requests` from registry-1.docker.io; `docker pull mirror.gcr.io/<repo>:<tag>` (library images as `mirror.gcr.io/library/<name>`) plus `docker tag` back to the original name succeeded on the first try.
- Proposed change: Document the mirror.gcr.io fallback (pull, then retag to the original reference) for Docker Hub 429s and advise pulling sequentially rather than in parallel.
