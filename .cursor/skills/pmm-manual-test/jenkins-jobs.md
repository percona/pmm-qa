# PMM Jenkins Jobs — Full Parameter Reference

Source of truth: `$ReposRoot/jenkins-pipelines/pmm/v3/pmm3-aws-staging-start.groovy` and `pmm3-deploy-services.groovy`.

**Goal for manual tests:** build a **complete** `parambuild` URL with every relevant param pre-filled so the user only clicks **Build**. Do not stop at `DOCKER_VERSION` + `CLIENT_VERSION` alone when other params matter for the ticket.

URL format: `https://pmm.cd.percona.com/job/<job-name>/parambuild/?PARAM=value&PARAM2=value2`

- URL-encode values (` ` → `%20`, `:` in env vars → `%3A`, `=` → `%3D`, `&` inside values → `%26`)
- `text` params (`CLIENTS`, `DOCKER_ENV_VARIABLE`) may need encoding
- Omit params only when the Jenkins default is correct for the test

---

## pmm3-aws-staging-start

**Purpose:** Single EC2 instance — PMM server docker + optional **local** clients on the same VM via `pmm-framework.py`.

**Activity:** https://pmm.cd.percona.com/blue/organizations/jenkins/pmm3-aws-staging-start/activity

### All parameters

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `DOCKER_VERSION` | string | `perconalab/pmm-server:3-dev-latest` | FB: `perconalab/pmm-server-fb:PR-XXXX-<sha>` |
| `WATCHTOWER_VERSION` | string | `perconalab/watchtower:dev-latest` | FB: `perconalab/pmm-watchtower-fb:PR-XXXX-<sha>` from JNKPercona comment |
| `CLIENT_VERSION` | string | `3-dev-latest` | FB: **tarball URL** only — never client docker image |
| `SSH_KEY` | string | *(empty)* | OpenSSH public key for `ec2-user` SSH access |
| `ADMIN_PASSWORD` | string | `pmm3admin!` | Grafana/PMM admin password |
| `PMM_CLIENT_REPO` | choice | `experimental` | `experimental` \| `testing` \| `release` |
| `ENABLE_PULL_MODE` | choice | `no` | `no` \| `yes` |
| `DAYS` | choice | `1` | Auto-stop VM after N days; `0` = never |
| `DOCKER_ENV_VARIABLE` | text | `-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0` | Space-separated `-e KEY=VAL` passed to server container |
| `PXC_VERSION` | choice | `8.4` | `8.4` \| `8.0` \| `5.7` |
| `PS_VERSION` | choice | `8.0` | `8.0` \| `8.4` \| `5.7` \| `5.7.30` \| `5.6` |
| `MS_VERSION` | choice | `8.0` | `8.0` \| `8.4` \| `5.7` \| `5.6` |
| `PGSQL_VERSION` | choice | `16` | `16` \| `17` \| `18` \| `15` \| `14` \| `13` |
| `PDPGSQL_VERSION` | choice | `16` | `16` \| `17` \| `18` \| `15` \| `14` \| `13` |
| `PSMDB_VERSION` | choice | `8.0` | `8.0` \| `7.0` \| `6.0` \| `5.0` \| `4.4` |
| `MODB_VERSION` | choice | `8.0` | `8.0` \| `7.0` \| `6.0` \| `5.0` \| `4.4` |
| `CLIENTS` | text | `--database ps=5.7,QUERY_SOURCE=perfschema` | Flags for `pmm-framework.py`; empty = server only |
| `NOTIFY` | choice | `false` | Slack notifications |
| `CLIENT_INSTANCE` | choice | `no` | `yes` = this VM is client-only (needs `SERVER_IP`) |
| `SERVER_IP` | string | `0.0.0.0` | PMM server IP when `CLIENT_INSTANCE=yes` |
| `PMM_QA_GIT_BRANCH` | string | `main` | Branch cloned for `pmm-framework.py` provisioning |

### Local clients via `CLIENTS` / `pmm-framework.py`

Provisioner script in this repo: `qa-integration/pmm_qa/pmm-framework.py`.

When the test needs **one or a few databases on the same VM**, use **staging-start** with `CLIENTS` instead of **deploy-services**.

**Limitations** (prefer **deploy-services** when any apply):

- Single VM — no separate client hosts, no multi-VM topologies
- Heavy/complex setups unreliable on one `t3.xlarge`
- `deploy-services` spawns dedicated client VMs via nested `staging-start` with `CLIENT_INSTANCE=yes`

**CLIENTS examples:**

```
--database ps=5.7,QUERY_SOURCE=perfschema
--database psmdb,SETUP_TYPE=pss
--database pgsql=16
```

Leave `CLIENTS` empty for **server-only** tests (UI, API, settings).

### Common `DOCKER_ENV_VARIABLE` values

Read `$ReposRoot/pmm/managed/CONTRIBUTING.md` and `$ReposRoot/pmm/documentation/docs/install-pmm/install-pmm-server/deployment-options/docker/env_var.md` when PR/ticket touches server config.

| Variable | Typical test use |
|----------|------------------|
| `PMM_DEBUG=1` | Verbose logs (default in job) |
| `PMM_ENABLE_TELEMETRY=0\|1` | Job default is `0`; set `1` when ticket tests server telemetry |
| `PMM_DEV_TELEMETRY_DISABLE_START_DELAY=1` | Run telemetry immediately |
| `PMM_DEV_TELEMETRY_DISABLE_SEND=1` | Gather telemetry but don't send to SaaS |
| `PMM_DEV_TELEMETRY_INTERVAL=30s` | Short interval for telemetry debugging |

**Important:** job default sets `PMM_ENABLE_TELEMETRY=0`. Override when the ticket requires telemetry enabled.

---

## pmm3-deploy-services

**Purpose:** Orchestrator — provisions PMM server + **separate client VMs**.

**Activity:** https://pmm.cd.percona.com/blue/organizations/jenkins/pmm3-deploy-services/activity

### All parameters

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `SERVER_TYPE` | choice | `docker` | `docker` \| `ovf` \| `ami` \| `helm` \| `ha` |
| `DOCKER_VERSION` | string | `perconalab/pmm-server:3-dev-latest` | Used for docker/helm/ha server types |
| `OVA_VERSION` | string | `PMM3-Server-OVF-3.0.0-latest.ova` | OVF only |
| `AMI_ID` | string | `ami-0669b163befffb6c3` | AMI only |
| `CLIENT_VERSION` | string | `3-dev-latest` | Tarball URL for client VMs |
| `ENABLE_PULL_MODE` | choice | `no` | `no` \| `yes` |
| `ADMIN_PASSWORD` | string | `pmm3admin!` | Applied after provisioning |
| `SSH_KEY` | string | *(empty)* | SSH key for AWS instances |
| `DEPLOY_EXTERNAL` | boolean | `false` | External node + HAProxy VM |
| `DEPLOY_MYSQL_GROUP` | boolean | `false` | GR, PXC, async repl, standalone VMs |
| `DEPLOY_MONGO_GROUP` | boolean | `false` | Sharded + PSS replica set VMs |
| `DEPLOY_POSTGRES_GROUP` | boolean | `false` | PG, PDPGSQL, Patroni VMs |
| `DEPLOY_VALKEY` | boolean | `false` | Valkey VM |
| `GENERATE_DASHBOARD_SCREENSHOTS` | boolean | `false` | Skip 24h hold; run Playwright screenshots |
| `SCREENSHOTS_SLACK_TARGET` | string | `@catalina.adam` | Slack target for screenshots |
| `PXC_VERSION` | choice | `8.0` | Passed to nested client jobs |
| `PS_VERSION` | choice | `8.4` | |
| `MS_VERSION` | choice | `8.4` | |
| `PGSQL_VERSION` | choice | `17` | |
| `PDPGSQL_VERSION` | choice | `17` | |
| `PSMDB_VERSION` | choice | `8.0` | |
| `MODB_VERSION` | choice | `8.0` | |
| `HELM_CHART_BRANCH` | string | `pmmha-v3` | HA only |
| `OPENSHIFT_VERSION` | choice | `latest` | Helm only |
| `K8S_VERSION` | choice | `1.34` | HA only |
| `WATCHTOWER_VERSION` | string | `perconalab/watchtower:dev-latest` | Passed to nested staging-start |
| `PMM_QA_GIT_BRANCH` | string | `main` | Provisioner scripts branch |

### Client groups when flags are `true`

| Flag | CLIENTS provisioned |
|------|---------------------|
| `DEPLOY_EXTERNAL` | `--database external --database haproxy` |
| `DEPLOY_MYSQL_GROUP` | GR+mysql, repl+pxc, ps-single+psmdb-pss, pxc-extra |
| `DEPLOY_POSTGRES_GROUP` | pdpgsql, pgsql, patroni |
| `DEPLOY_MONGO_GROUP` | psmdb sharding, valkey+psmdb inmemory |
| `DEPLOY_VALKEY` | valkey |

---

## Job selection

| Scenario | Job |
|----------|-----|
| Server/UI/API only; optional 1-VM local DB via `CLIENTS` | **pmm3-aws-staging-start** |
| Multi-VM client topologies, external nodes, full DB matrix | **pmm3-deploy-services** |

---

## JNKPercona build comment

Use the **latest** JNKPercona comment containing `Staging instance:`. `pmm-submodules` PR number often differs from `percona/pmm` PR number.
