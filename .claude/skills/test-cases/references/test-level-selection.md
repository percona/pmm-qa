# Test-level selection

Read this at step 5, before writing candidates, and again when a candidate's layer is in doubt.

Put each assertion at the lowest pmm-qa layer that can observe its named defect. A higher layer costs more to run and maintain, and flakes more, so going up needs a reason. Product-repository tests are not a layer this skill uses.

## Layers

| Layer | Where it lives | What this skill does with it |
|---|---|---|
| pmm-qa API or CLI | `e2e_tests/tests/` API specs, `cli/tests/` | Zephyr case, usually `Needs automation` |
| pmm-qa UI or dashboard | `e2e_tests/tests/`, legacy `codeceptjs-e2e/` | Zephyr case when the rendered result is the contract |
| System, upgrade, or HA estate | `ha-e2e-tests.yml`, package and upgrade jobs, manual estates | Zephyr case; often `Manual` or `Automation candidate — infra gap` |

## Choosing

1. Name the defect and where it first becomes observable.
2. Start at the lowest layer that can observe it deterministically. A dashboard mapping defect is visible in the dashboard model through the API before it is visible on a live panel whose data happens to be zero.
3. Go up a layer only for one of these reasons, and write it in the notes beside the candidate:
   - the higher layer is the contract — a user-visible message, a rendered panel, a CLI's exit code and output;
   - the defect only shows where the user works — a redirect, a page that fails to load, a menu entry.
4. When no pmm-qa layer can observe the defect — it lives entirely inside one component, with nothing visible through the API, CLI or UI — record it as a Finding instead of a case.

Step wording does not change with the layer: each Step still says what a person does in product words, with the command or request in Data.
