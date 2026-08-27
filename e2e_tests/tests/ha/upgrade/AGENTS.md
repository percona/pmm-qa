# PMM HA Helm upgrade tests

`helmUpgrade.test.ts` holds tests tags, one per phase of a Helm upgrade of a PMM
HA cluster. They are not standalone: each one asserts against the phase before it,
so they only mean anything run in order, against the same cluster.

The pipeline finishes by running the `@pmm-ha` suite from `../` against the upgraded
cluster, which is the only place that asks whether failover still works after an
in-place upgrade.

The upgrade itself is **not** done by these tests. Every helm step is
[`k8s/install_pmm_ha.sh`](../../../../k8s/install_pmm_ha.sh), sequenced in CI by
`pmm3-ha-helm-upgrade-tests.groovy` in Percona-Lab/jenkins-pipelines (`pmm/v3/`).

| # | Phase | Tag | What the test proves |
|---|---|---|---|
| 1 | `install_pmm_ha.sh` installs the **released** image from the **published** chart | — | — |
| 2 | | `@pmm-helm-pre-upgrade` | HA is enabled, every pod runs the released image, one leader, UI renders. **Records the baseline.** |
| 3 | `--charts deps --chart-branch <branch>` upgrades the operators | — | — |
| 4 | | `@pmm-helm-mid-upgrade` | the dependencies release moved and the `pmm-ha` release did **not**: same revision, same pods, same version, still serving |
| 5 | `--charts pmm-ha --chart-branch <branch> --image <target>` upgrades the server | — | — |
| 6 | | `@pmm-helm-post-upgrade` | revision advanced, every pod runs the target image and serves a version no older than the baseline, one leader, UI renders |
| 7 | | `@pmm-ha` | the ordinary HA suite - failover, leader metrics, node inventory - run last on the upgraded cluster. A failure here is an HA regression, not a broken upgrade |

## The baseline file

The three tests are three separate Playwright processes with an upgrade in between,
so nothing survives in memory. Phase 2 writes what phases 4 and 6 compare against:

```json
{
  "images": ["reg-19jf01na.percona.com/dockerhub-cache/percona/pmm-server:3.9.1"],
  "podNames": ["pmm-ha-0", "pmm-ha-1", "pmm-ha-2"],
  "revision": 1,
  "version": "3.9.1"
}
```

| Field | Source | Read by |
|---|---|---|
| `revision` | `helm list` revision of the `pmm-ha` release | mid: must be **unchanged** - the deps upgrade must not touch the server release. post: must have **advanced** - proof the upgrade ran |
| `podNames` | pod names, sorted | mid and post: **unchanged** - a StatefulSet rolling upgrade reuses names, and both compare this against `/v1/ha/nodes` to prove every pod rejoined |
| `version` | `/v1/version` from the cluster API | mid: **identical**. post: **not older** (`serverVersionBelow`) - a dev build can report the same version as the release it was cut from, so equality is not required |
| `images` | deduped `spec.containers[].image` | evidence only; the image assertions compare against the env vars below |

Path: `$HA_UPGRADE_BASELINE`, defaulting to `output/ha-upgrade-baseline.json`
relative to `e2e_tests/`. Only the pre-upgrade test writes it; mid and post read it
and **fail** when it is missing rather than skipping their comparisons.

## Environment

| Variable | Meaning |
|---|---|
| `KUBECONFIG` | the HA cluster; helm and kubectl run against whatever this points at |
| `PMM_UI_URL` | `baseURL` for the UI steps |
| `ADMIN_PASSWORD` | UI login, and the basic auth `versionFromPod` needs |
| `DOCKER_VERSION` | the image the upgrade **goes to** - what pre asserts is *not* installed yet, and post asserts *is* |
| `RELEASE_DOCKER_VERSION` | the image the upgrade **starts from**; optional, and only pre asserts it |
| `HA_UPGRADE_BASELINE` | where the baseline is written and read |

## Rules that have already cost a run

- **Never tag these `@pmm-ha`.** `--grep "@pmm-ha"` matches a nested tag by
  substring, and these mutate the cluster they run on - the whole HA suite would
  drag them in.
- **Compare images by `repo:tag` suffix**, never by equality (`runsImage`). ROSA
  rewrites `docker.io` through a pull-through cache, so a pod's image carries a
  registry prefix the chart never asked for.
- **Never pass `--reporter`** on the command line: it replaces the whole config
  reporter list, including the `junit` reporter CI consumes, and the HTML report.
- `/v1/version` needs credentials **even from inside the pod**, which is why
  `versionFromPod` sends basic auth.
- The pre-upgrade test **fails**, by design, on a cluster already running the
  target image. The released install is a premise of the scenario, not a reason to
  skip.

## Running them by hand

```bash
cd e2e_tests
export KUBECONFIG=...            PMM_UI_URL=https://<pmm>/
export ADMIN_PASSWORD=...        DOCKER_VERSION=perconalab/pmm-server:3-dev-latest
export HA_UPGRADE_BASELINE="$PWD/output/ha-upgrade-baseline.json"

npx playwright test --grep "@pmm-helm-pre-upgrade"
../k8s/install_pmm_ha.sh --platform openshift --charts deps --chart-branch PMM-HA-GA
npx playwright test --grep "@pmm-helm-mid-upgrade"
../k8s/install_pmm_ha.sh --platform openshift --charts pmm-ha --chart-branch PMM-HA-GA \
    --image "$DOCKER_VERSION" --external-access
npx playwright test --grep "@pmm-helm-post-upgrade"
```
