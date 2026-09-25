# PMM QA Integration

This workspace contains environment setup assets for PMM. It is used to provision databases, PMM Client, PMM Server connections, TLS/SSL scenarios, backup-related services, object storage, and external service exporters so other QA suites can run against realistic PMM environments.

## Main Framework

[`pmm_qa/pmm-framework/pmm-framework`](pmm_qa/pmm-framework/) is the setup runner used by QA jobs before tests start. GitHub Actions workflows pass setup arguments such as `--database ps`, `--database psmdb,SETUP_TYPE=pss`, or `--database pdpgsql` to this bash CLI. It starts each database on a prebaked image, installs and registers PMM Client, and leaves the containers and services that CLI, E2E, and CodeceptJS tests expect to find. This keeps CI setup consistent: workflows choose what environment they need, and `pmm-framework` knows how to build it. See [pmm_qa/pmm-framework/README.md](pmm_qa/pmm-framework/README.md) and [ARCHITECTURE.md](pmm_qa/pmm-framework/ARCHITECTURE.md) for the CLI reference and internals.

## Available Setups

The setups below are the QA integration environments registered in [`pmm_qa/pmm-framework/lib/config.sh`](pmm_qa/pmm-framework/lib/config.sh). They do not represent every PMM-supported monitoring target; they are the local provisioning flows this workspace can create for test coverage.

<!-- DB-SETUPS-START -->

```json
{
  "MYSQL": {
    "versions": ["5.7", "8.0", "8.4", "9.7"],
    "default_topology": "single node",
    "setup_type": {
      "replication": "async replication",
      "gr": "group replication"
    }
  },
  "PS": {
    "versions": ["5.7", "8.0", "8.4", "9.7"],
    "default_topology": "single node",
    "setup_type": {
      "replication": "async replication",
      "gr": "group replication"
    }
  },
  "PXC": {
    "versions": ["5.7", "8.0", "8.4", "9.7"],
    "default_topology": "fixed 3-node PXC with ProxySQL",
    "setup_type": {}
  },
  "PGSQL": {
    "versions": ["14", "15", "16", "17", "18"],
    "default_topology": "single pg_stat_statements setup",
    "setup_type": {
      "replication": "primary/replica"
    }
  },
  "PDPGSQL": {
    "versions": ["14", "15", "16", "17", "18"],
    "default_topology": "single node",
    "setup_type": {
      "replication": "primary/replica",
      "patroni": "Patroni setup"
    }
  },
  "PSMDB": {
    "versions": ["4.4", "5.0", "6.0", "7.0", "8.0", "latest"],
    "default_topology": "pss replica set",
    "setup_type": {
      "psa": "PSA replica set",
      "shards": "sharded setup",
      "sharding": "sharded setup"
    }
  },
  "VALKEY": {
    "versions": ["7", "8"],
    "default_topology": "cluster",
    "setup_type": {
      "sentinel": "sentinel setup",
      "sentinels": "sentinel setup"
    }
  },
  "HAPROXY": {
    "versions": ["default"],
    "default_topology": "fixed HAProxy setup",
    "setup_type": {}
  },
  "EXTERNAL": {
    "versions": ["default"],
    "default_topology": "Redis with redis_exporter and process-exporter",
    "setup_type": {}
  }
}
```

<!-- DB-SETUPS-END -->

## Supporting Variants

<!-- DB-VARIANTS-START -->

| Setup key       | Purpose                                                          | Versions                                    |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| `SSL_MYSQL`     | TLS/SSL MySQL setup.                                             | `5.7`, `8.0`, `8.4`, `9.7`                  |
| `SSL_PDPGSQL`   | TLS/SSL PostgreSQL or Percona Distribution for PostgreSQL setup. | `14`, `15`, `16`, `17`                      |
| `SSL_PSMDB`     | TLS/SSL PSMDB setup.                                             | `4.4`, `5.0`, `6.0`, `7.0`, `8.0`, `latest` |

<!-- DB-VARIANTS-END -->

## Related Workspaces

- [CLI Tests](../cli/README.md) - Playwright-based `pmm-admin` CLI tests.
- [Playwright E2E Tests](../e2e_tests/README.md) - Playwright web UI and API-assisted E2E tests.
- [CodeceptJS E2E Tests](../codeceptjs-e2e/README.md) - existing CodeceptJS tests.
