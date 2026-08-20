# PMM-12065 — reproduction scripts

Investigation of [PMM-12065](https://perconadev.atlassian.net/browse/PMM-12065)
("PMM requires SELinux in permissive, client not OK with this") and of the
`pmm-client` failures reported on the ticket while retesting it.

Everything here provisions throwaway state only; nothing is meant to run in CI.

| Script | What it does |
|--------|--------------|
| `repro-nonroot-driver.sh` | Creates an unprivileged user and runs the non-root binary install as documented. |
| `repro-client-nonroot.sh` | Follows `install-pmm-client/binary_package.md` "Without root permissions" + "Register the node" literally. |
| `repro-paths-clobber.sh` | Isolates the `pmm-admin config` step overwriting `paths_base` with the compiled-in default. |
| `repro-workaround.sh` | Confirms `pmm-admin config --paths-base=$PMM_DIR` keeps the install working. |
| `selinux-guest-boot.sh` | Boots a Rocky 9 guest with SELinux **enforcing** under QEMU (software emulation), for testing pmm-client against a real SELinux kernel. |
| `selinux-client-test.sh` | Installs pmm-client in that guest, registers it, and collects AVC denials. |

Usage (from a host with Docker and a running PMM Server):

```sh
bash repro-nonroot-driver.sh <pmm-admin-password> [version] [server:port]
bash selinux-guest-boot.sh && bash selinux-client-test.sh <password> <server:port>
```
