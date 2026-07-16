#!/usr/bin/env bash
# Start Docker in Cursor MicroVM environments where systemd may be unavailable.
set -eu

if docker info >/dev/null 2>&1; then
  echo "Docker is ready ($(docker info -f '{{.ServerVersion}}'), storage: $(docker info -f '{{.Driver}}'))"
  exit 0
fi

if ! command -v dockerd >/dev/null 2>&1; then
  echo "ERROR: dockerd not installed. Install docker-ce first." >&2
  exit 1
fi

sudo service docker start >/dev/null 2>&1 || sudo dockerd >/tmp/dockerd.log 2>&1 &

for _ in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    echo "Docker is ready ($(docker info -f '{{.ServerVersion}}'), storage: $(docker info -f '{{.Driver}}'))"
    exit 0
  fi

  if [ -S /var/run/docker.sock ]; then
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  fi

  sleep 1
done

echo "ERROR: cannot talk to Docker API after starting dockerd." >&2
exit 1