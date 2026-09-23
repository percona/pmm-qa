# Test-level selection

Read this at step 5, before writing candidates, and again when a candidate's layer is in doubt.

Put each assertion at the lowest layer that can observe its named defect. A higher layer costs more to run and maintain, and flakes more, so going up needs a reason.

## Layers

| Layer | Where it lives | What this skill does with it |
|---|---|---|
| Product unit and integration tests | the product repository (`*_test.go`, UI unit tests, chart unit tests) | Subtract when they run and would fail on the defect; recommend when they are the right home and missing |
| Product API tests | percona/pmm `api-tests/` | Subtract once their run is confirmed (see coverage.md) |
| pmm-qa API or CLI | `e2e_tests/tests/` API specs, `cli/tests/` | Zephyr case, usually `Needs automation` |
| pmm-qa UI or dashboard | `e2e_tests/tests/`, legacy `codeceptjs-e2e/` | Zephyr case when the rendered result is the contract |
| System, upgrade, or HA estate | `ha-e2e-tests.yml`, package and upgrade jobs, manual estates | Zephyr case; often `Manual` or `Automation candidate — infra gap` |

## Choosing

1. Name the defect and where it first becomes observable.
2. Start at the lowest layer that can observe it deterministically. A dashboard mapping defect is visible in the dashboard model before it is visible on a live panel whose data happens to be zero; a value the exporter emits wrongly is visible in the exporter's own test.
3. Go up a layer only for one of these reasons, and write it in the notes beside the candidate:
   - the defect exists only when components compose — the stored value reaches the exporter, the proxy forwards the header;
   - the higher layer is the contract — a user-visible message, a rendered panel, a CLI's exit code and output;
   - the lower layer exists but does not run in CI, or holds fixed the very condition the defect needs.
4. When the right layer is a product-repository test that is missing or too weak, do not write a Zephyr case for it. Add a Finding: `Recommend: <assertion> in <repository>/<test>`, with the reason the defect belongs there — a partition shape the unit test never seeds, a lint over every docs link, a CI guard the ticket's refinement asked for.

Step wording does not change with the layer: each Step still says what a person does in product words, with the command or request in Data.
