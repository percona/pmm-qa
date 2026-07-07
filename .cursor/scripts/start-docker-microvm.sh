#!/usr/bin/env bash
# Start Docker in Cursor MicroVM environments where systemd may be unavailable.
set -euo pipefail

DOCKERD_SESSION="dockerd"
TMUX_CONF="/exec-daemon/tmux.portal.conf"

if ! command -v dockerd >/dev/null 2>&1; then
  echo "ERROR: dockerd not installed. Install docker-ce first." >&2
  exit 1
fi

if docker info >/dev/null 2>&1; then
  echo "Docker is ready ($(docker info -f '{{.ServerVersion}}'), storage: $(docker info -f '{{.Driver}}'))"
  exit 0
fi

sudo service docker start >/dev/null 2>&1 || true
if docker info >/dev/null 2>&1; then
  echo "Docker is ready ($(docker info -f '{{.ServerVersion}}'), storage: $(docker info -f '{{.Driver}}'))"
  exit 0
fi

if command -v tmux >/dev/null 2>&1 && [ -f "$TMUX_CONF" ]; then
  TMUX=(tmux -f "$TMUX_CONF")
else
  TMUX=(tmux)
fi

if command -v tmux >/dev/null 2>&1; then
  if ! "${TMUX[@]}" has-session -t "=$DOCKERD_SESSION" 2>/dev/null; then
    echo "Starting dockerd in tmux session '$DOCKERD_SESSION'..."
    "${TMUX[@]}" new-session -d -s "$DOCKERD_SESSION" -c /tmp -- "sudo dockerd"
  fi
else
  echo "Starting dockerd in background..."
  sudo dockerd >/tmp/dockerd.log 2>&1 &
fi

for _ in $(seq 1 30); do
  if [ -S /var/run/docker.sock ]; then
    break
  fi
  sleep 1
done

if [ ! -S /var/run/docker.sock ]; then
  echo "ERROR: dockerd did not create /var/run/docker.sock within 30s." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  sudo chmod 666 /var/run/docker.sock || true
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: cannot talk to Docker API after starting dockerd." >&2
  exit 1
fi

echo "Docker is ready ($(docker info -f '{{.ServerVersion}}'), storage: $(docker info -f '{{.Driver}}'))"