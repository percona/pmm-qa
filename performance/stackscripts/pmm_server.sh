#!/bin/bash
# Linode StackScript: install Docker and run PMM Server for a perf run.
# Tuned for a box that stays up for days, not one CI job.
#
#<UDF name="hostname" label="The hostname for the new Linode.">
# HOSTNAME=
#<UDF name="password" label="The password for admin PMM user.">
# PASSWORD=
#<UDF name="docker" label="PMM Server image. For example: percona/pmm-server:3.0.0">
# DOCKER=

exec >  >(tee -a /root/stackscript.log)
exec 2> >(tee -a /root/stackscript.log >&2)

DOCKER=${DOCKER:-percona/pmm-server:3}
echo "SERVER_VERSION=$DOCKER"

echo "$HOSTNAME" > /etc/hostname
hostname -F /etc/hostname

# Swap sized to RAM -- PMM Server is tight on the smaller Linode plans -- but
# capped: dd'ing 32G+ of zeroes costs minutes of boot on the larger plans, which
# are the ones least likely to ever swap.
echo 1 > /proc/sys/vm/swappiness
SWAP_MB=$(( LINODE_RAM > 8192 ? 8192 : LINODE_RAM ))
dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MB"
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# A perf run measures this box for days; background apt work would land in the
# middle of a benchmark and can restart services under it.
systemctl disable --now unattended-upgrades apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true

curl -fsSL https://get.docker.com | sh

docker run -d \
  --name pmm-server \
  --hostname pmm-server \
  --restart always \
  -p 443:8443 \
  -v pmm-data:/srv \
  -e PMM_ENABLE_TELEMETRY=0 \
  "$DOCKER"

# The container accepts exec long before the server is ready, so retry instead
# of guessing a sleep.
for _ in $(seq 30); do
  docker exec pmm-server change-admin-password "$PASSWORD" && break
  sleep 5
done
