#!/usr/bin/env bash
# Start Docker on MicroVM environments where systemd is unavailable.
set -euo pipefail

DOCKERD_SESSION="dockerd"
TMUX_CONF="/exec-daemon/tmux.portal.conf"
TMUX=(tmux -f "$TMUX_CONF")

if ! command -v dockerd >/dev/null 2>&1; then
  echo "ERROR: dockerd not installed. Install docker-ce first." >&2
  exit 1
fi

if ! "${TMUX[@]}" has-session -t "=$DOCKERD_SESSION" 2>/dev/null; then
  echo "Starting dockerd in tmux session '$DOCKERD_SESSION'..."
  "${TMUX[@]}" new-session -d -s "$DOCKERD_SESSION" -c /tmp -- "sudo dockerd"
  for _ in $(seq 1 30); do
    if [ -S /var/run/docker.sock ]; then
      break
    fi
    sleep 1
  done
fi

if [ ! -S /var/run/docker.sock ]; then
  echo "ERROR: dockerd did not create /var/run/docker.sock within 30s." >&2
  echo "Check logs: ${TMUX[*]} attach -t $DOCKERD_SESSION" >&2
  exit 1
fi

# MicroVM shells often lack an active docker group; widen socket access for local QA.
if ! docker info >/dev/null 2>&1; then
  sudo chmod 666 /var/run/docker.sock
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: cannot talk to Docker API after starting dockerd." >&2
  exit 1
fi

echo "Docker is ready ($(docker info -f '{{.ServerVersion}}'), storage: $(docker info -f '{{.Driver}}'))"
