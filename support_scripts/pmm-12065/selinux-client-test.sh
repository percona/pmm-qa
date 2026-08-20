#!/usr/bin/env bash
# PMM-12065: install pmm-client inside the SELinux-enforcing Rocky 9 guest
# (see selinux-guest-boot.sh), register it against the PMM Server running on
# the QEMU host, and report every SELinux denial the client produced.
#
# Usage: selinux-client-test.sh <pmm-admin-password> [server host:port as seen from the guest]
set -u
PW="${1:?usage: selinux-client-test.sh <password> [server]}"
SRV="${2:-10.0.2.2:8443}"
KEY=/root/.ssh/qemu_guest
G="ssh -i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -p 2222 rocky@127.0.0.1"

$G 'sudo dnf install -y -q audit policycoreutils policycoreutils-python-utils setroubleshoot-server >/dev/null 2>&1; sudo systemctl enable --now auditd >/dev/null 2>&1; echo -n "SELinux mode: "; getenforce'

echo "### baseline: clear the audit trail marker"
$G 'sudo auditctl -D >/dev/null 2>&1; date -u +%m/%d/%Y-%H:%M:%S | sudo tee /tmp/avc-mark >/dev/null; cat /tmp/avc-mark'

echo
echo "### install pmm-client from the Percona repo (RPM, root install, systemd)"
$G 'sudo dnf install -y -q https://repo.percona.com/yum/percona-release-latest.noarch.rpm >/dev/null 2>&1 || true
    sudo percona-release enable pmm3-client >/dev/null 2>&1
    sudo dnf install -y -q pmm-client 2>&1 | tail -3
    rpm -q pmm-client'

echo
echo "### SELinux labels the package produced"
$G 'ls -Z /usr/sbin/pmm-agent /usr/local/percona/pmm/exporters/node_exporter /usr/local/percona/pmm/exporters/vmagent 2>&1
    ls -Zd /usr/local/percona/pmm /usr/local/percona/pmm/config /usr/local/percona/pmm/tmp 2>&1'

echo
echo "### register the node and start the agent under systemd"
$G "ENCPW=\$(python3 -c \"import urllib.parse;print(urllib.parse.quote('''$PW''',safe=''))\")
    sudo pmm-admin config --server-insecure-tls --force \
      --server-url=\"https://admin:\${ENCPW}@$SRV\" \$(hostname -I | awk '{print \$1}') generic selinux-enforcing-node 2>&1 | tail -4
    sudo systemctl enable --now pmm-agent >/dev/null 2>&1
    sleep 25
    systemctl is-active pmm-agent
    ps -eZ | grep -E 'pmm-agent|node_exporter|vmagent' | head"

echo
echo "### pmm-admin status / list"
$G 'sudo pmm-admin status 2>&1 | tail -12; echo; sudo pmm-admin list 2>&1'

echo
echo "### SELinux denials since the marker (this is the answer to the ticket)"
$G 'MARK=$(cat /tmp/avc-mark); sudo ausearch -m AVC,USER_AVC,SELINUX_ERR,AVC_PATH -ts $(echo $MARK | cut -d- -f1) $(echo $MARK | cut -d- -f2) 2>&1 | tail -60'
echo
echo "### denial count + summary"
$G 'echo -n "raw AVC lines in audit.log: "; sudo grep -c "avc:  denied" /var/log/audit/audit.log 2>/dev/null || echo 0
    sudo ausearch -m AVC -i 2>/dev/null | grep -oE "comm=\"[^\"]+\"" | sort | uniq -c | sort -rn | head -20'
echo
echo "### does the agent actually work? (agent log errors)"
$G 'sudo journalctl -u pmm-agent --no-pager | grep -iE "error|denied|panic|fatal" | tail -15; echo "(empty = clean)"'
