# AGENTS.md — Docker inside the cloud session: start dockerd, pull from the ECR mirror, run with host networking

- Added: 2026-09-23
- Applies to: any skill or agent that runs Docker locally in a cloud session (Dockerfile checks, pmm-framework dry runs)
- Evidence: `docker` had no daemon until `dockerd` was started in the background; `docker pull oraclelinux:8` then failed with Docker Hub `429 Too Many Requests`, while `public.ecr.aws/docker/library/oraclelinux:8` pulled at once; a container's curl got `Connection refused` from the loopback agent proxy on the default bridge and downloaded fine with `--network host -e HTTPS_PROXY -v /root/.ccr/ca-bundle.crt:/ca.crt:ro` plus `--cacert /ca.crt`.
- Proposed change: Add a short "Docker in a cloud session" note beside "Running locally": start `dockerd` if `docker info` fails, pull Docker Hub library images as `public.ecr.aws/docker/library/<image>` (retag locally if a Dockerfile's FROM needs the short name), and give containers `--network host`, the proxy env and the mounted CA bundle.
