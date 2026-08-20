#!/usr/bin/env bash
# PMM-12065: the PMM Server podman deployment documented at
# install-pmm-server/deployment-options/podman/index.md bind-mounts
# ~/.config/systemd/user/ into the container with no :z/:Z relabel.
# Under SELinux enforcing that mount is the part most likely to be denied,
# so exercise exactly that with a throwaway container instead of the full
# (far too slow to emulate) PMM Server image.
set -u
mkdir -p ~/.config/systemd/user
echo "pmm-server.env probe" > ~/.config/systemd/user/pmm-server.env
echo "### label of the host dir the unit mounts:"
ls -Zd ~/.config/systemd/user; ls -Z ~/.config/systemd/user/pmm-server.env

IMG=registry.access.redhat.com/ubi9/ubi-minimal
podman pull -q "$IMG" >/dev/null 2>&1 || { echo "pull failed"; exit 1; }

echo
echo "### A. exactly as documented (no :z/:Z), rootless, --userns=keep-id"
podman run --rm --userns=keep-id:uid=1000,gid=1000 \
  --volume "$HOME/.config/systemd/user/:/home/pmm/update/" \
  "$IMG" cat /home/pmm/update/pmm-server.env 2>&1 | tail -3

echo
echo "### B. same mount with :z (SELinux relabel)"
podman run --rm --userns=keep-id:uid=1000,gid=1000 \
  --volume "$HOME/.config/systemd/user/:/home/pmm/update/:z" \
  "$IMG" cat /home/pmm/update/pmm-server.env 2>&1 | tail -3

echo
echo "### label of the host dir after the :z run (relabelled in place):"
ls -Zd ~/.config/systemd/user

echo
echo "### SELinux denials raised by the two runs:"
sudo ausearch -m AVC -ts recent 2>&1 | grep -E "denied" | tail -10
echo -n "total avc denied lines: "; sudo grep -c "avc:  denied" /var/log/audit/audit.log 2>/dev/null || echo 0
