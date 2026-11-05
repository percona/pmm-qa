# PMM Extensions + Operations for MongoDB

`setup.sh` starts a local PMM Server with the
[PMM Extensions](https://hub.docker.com/r/percona/pmm-extensions) side-car, turns on
**Operations for MongoDB**, and adds a monitored PSMDB replica set whose nodes the
Operations scans can log in to.

```bash
qa-integration/pmm_extensions/setup.sh                 # percona/pmm-server:3 + percona/pmm-extensions:3, PSMDB 8.0
qa-integration/pmm_extensions/setup.sh --tag 3.10.0    # pin both images
qa-integration/pmm_extensions/setup.sh --psmdb none    # PMM + Extensions only
qa-integration/pmm_extensions/setup.sh --teardown      # remove everything, volumes included
```

Requirements: an amd64 Docker host (PMM Extensions is not published for arm64) with
the Compose v2 plugin, `openssl`, `curl`, ports 443 and 4647 free, and internet access
(the MongoDB nodes install `python3` and the scans download `pymongo` from PyPI).

What it does:

1. Starts `pmm-server` (`PMM_ENABLE_EXTENSIONS`, `PMM_ENABLE_NOMAD`, `PMM_PUBLIC_ADDRESS`,
   and the `PMM_EXTENSIONS_URL`/`PMM_EXTENSIONS_TOKEN` pair 3.10.0 needs, PMM-15772) and
   `pmm-extensions` from [`docker-compose.yml`](docker-compose.yml), on the `pmm-qa` network.
2. Waits for PMM readiness and for `/extensions/health`.
3. Enables Operations for MongoDB through `PUT /v1/server/settings`, so the switch stays
   editable in **Configuration > Settings > Advanced Settings**.
4. Runs `pmm-framework --database psmdb=<version>,SETUP_TYPE=pss` (rs101-rs103, PMM Client
   from the RPM, as the scans require), installs `python3` and `iproute` on each node,
   writes `/root/.mongodb_uri` with the `pmm` user, which has `clusterMonitor`, and maps
   each node's PMM node name (`rs101._<suffix>`) in its `/etc/hosts`, because the scans
   dial mongod by that name.
5. Syncs PMM's inventory into PMM Extensions, so the new nodes appear in Operations
   without waiting for its own schedule, and runs a first scan.

`--public-address` defaults to this host's primary IP; the MongoDB nodes reach Nomad
on port 4647 there, and browsers open `https://<address>`. Set `ADMIN_PASSWORD`,
`PMM_SERVER_IMAGE`, `PMM_EXTENSIONS_IMAGE` or `CLIENT_VERSION` to override the defaults;
`setup.sh --help` lists them.

The replica set is already running MongoDB, so it covers the Fleet, Nodes, scans and
Automations pages. Trying **Install MongoDB** needs separate empty Ubuntu or Rocky Linux
nodes with PMM Client; see the
[Operations for MongoDB docs](https://github.com/percona/pmm/blob/main/documentation/docs/use/mongodb-operations.md).
