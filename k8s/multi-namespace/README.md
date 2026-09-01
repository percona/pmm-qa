# PMM-HA multi-namespace test bed (PMM-15149 + PMM-15151)

Reproduces the two-namespace PMM-HA deployment used to verify:

- **PMM-15149** — `pmm-ha` installable into more than one namespace
  ([percona-helm-charts#865](https://github.com/percona/percona-helm-charts/pull/865))
- **PMM-15151** — `pmm-ha-dependencies` PG/ClickHouse operators watch all namespaces
  ([percona-helm-charts#868](https://github.com/percona/percona-helm-charts/pull/868))

Both changes have to be present together: without #868 the second instance's
`PerconaPGCluster`/`ClickHouseInstallation` are never reconciled, and without #865 the
second instance's bundled `prometheus-node-exporter` collides on host port 9100.

`build-test-branch.sh` merges both PR heads onto `PMM-HA-GA` into a local branch.
`install.sh` installs the operators once, then one instance per namespace.

Results of the run these scripts came from: [test-report.md](test-report.md).
