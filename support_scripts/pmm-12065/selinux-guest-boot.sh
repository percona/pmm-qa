#!/usr/bin/env bash
# PMM-12065: boot a RHEL-family guest with SELinux in ENFORCING mode under QEMU
# (software emulation - the Linode host has no /dev/kvm) so pmm-client can be
# tested against a real SELinux kernel instead of Ubuntu's AppArmor.
set -u
IMG=/root/rocky9.qcow2
SEED=/root/seed.iso
KEY=/root/.ssh/qemu_guest
SERIAL=/root/rocky-serial.log
URL=https://dl.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud-Base.latest.x86_64.qcow2

[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N '' -f "$KEY"
if [ ! -f /root/rocky-base.qcow2 ]; then
  echo "downloading Rocky 9 cloud image..."
  curl -fsSL -o /root/rocky-base.qcow2 "$URL" || exit 1
fi
rm -f "$IMG"
qemu-img create -f qcow2 -F qcow2 -b /root/rocky-base.qcow2 "$IMG" 30G >/dev/null

cat >/root/user-data <<CLOUD
#cloud-config
hostname: selinux-test
users:
  - name: rocky
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - $(cat "$KEY".pub)
CLOUD
echo "instance-id: selinux-test" >/root/meta-data
cloud-localds "$SEED" /root/user-data /root/meta-data

pkill -f "[q]emu-system-x86_64" 2>/dev/null; sleep 2
rm -f "$SERIAL"
nohup qemu-system-x86_64 \
  -machine q35 -accel tcg -cpu max -smp 4 -m 6144 \
  -drive file="$IMG",if=virtio,format=qcow2 \
  -drive file="$SEED",if=virtio,format=raw \
  -netdev user,id=n0,hostfwd=tcp:127.0.0.1:2222-:22 \
  -device virtio-net-pci,netdev=n0 \
  -display none -serial "file:$SERIAL" -monitor none \
  >/root/qemu.out 2>&1 &
echo "qemu started pid $!"

echo "waiting for guest ssh (software emulation, this is slow)..."
for i in $(seq 1 120); do
  sleep 15
  if ssh -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 -p 2222 rocky@127.0.0.1 true 2>/dev/null; then
    echo "guest up after $((i*15))s"
    ssh -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 \
      rocky@127.0.0.1 'cat /etc/redhat-release; echo -n "SELinux: "; getenforce; sestatus | head -6'
    exit 0
  fi
done
echo "guest did not come up; last serial output:"; tail -30 "$SERIAL"
exit 1
