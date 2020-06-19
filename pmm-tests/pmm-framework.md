# PMM Framework
[pmm-framework.sh](https://github.com/percona/pmm-qa/blob/master/pmm-tests/pmm-framework.sh) enables one to: 
  - Quickly setup a Percona Monitoring and Management environment. 
  - One can setup a PMM server and quickly add multiple clients.
  - Add DB instances of...
    - Percona Server (ps)
    - MongoDB (mo)
    - MySQL (ms)
    - MariaDB (md)
    - Percona XtraDB Cluster (pxc)
    - PostgreSQL

This script supports installations of:
Instance|Platform|Repositories
---|---|---
pmm-server|docker|dev, dev-fb, release
pmm-client|tarball|dev

### Using pmm-framework.sh:
*****
1. Install PMM-Server and PMM-Client; connect them
  - `./pmm-framework.sh --setup --pmm2 --pmm-server-version 2.7.0`
  - Omit `--pmm2` flag if you want to setup PMM1.x environment
  - Use `--link-client LINK` flag to provide specific tarball installation URL for pmm-client

2. development-build/feature-build
  - `--dev` : To install PMM from development build
  - `--def-fb TAG` :  To install specified PMM feature build (TAG is the Docker image tag of perconalab/pmm-server-fb image on DockerHub.)

3. 