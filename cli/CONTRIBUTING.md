# Contributing To PMM CLI Tests

Use this guide when adding or changing CLI tests under `cli/`.

## Adding A Test

1. Create the test under `tests/` with the `*.spec.ts` suffix.
2. Use `test` and `expect` from `@helpers/test`, which applies the pmm-client version gates.
3. Reuse helpers from `helpers/` before adding command execution logic directly to a test.
4. Put reusable command flows in `helpers/pmm-admin.ts` or `helpers/cli-helper.ts`.
5. Keep assertions close to the behavior being verified.
6. Add a meaningful `test.describe` tag when the area already uses tags.
7. Run the changed test directly before running a broader suite.

## Gating On The pmm-client Version

The nightly compatibility job runs this suite against the latest PMM Server with each of the 5 previous GA pmm-client versions. A test that needs newer client behaviour gets an entry in `helpers/versionGates.ts`, keyed by its `PMM-Txxxx`:

```ts
export const minPmmClientVersion: Record<string, string> = {
  'PMM-TXXXX': '3.10.0',
};
```

The `versionGate` fixture skips the test on older clients. It reads the version from the host's `pmm-admin`, or from a container when the spec sets `test.use({ pmmClientContainer: "<container>" })`.

Test template:

```ts
import { expect, test } from "@helpers/test";
import * as cli from "@helpers/cli-helper";

test.describe("Feature CLI tests", { tag: "@tag" }, async () => {
  test("PMM-TXXXX - Verify feature behavior", async ({}) => {
    const output = await cli.exec("pmm-admin <command>");

    await output.assertSuccess();
    expect(output.stdout).toContain("<expected-output>");
  });
});
```

Run the test directly:

```bash
npx playwright test tests/<filename>.spec.ts
```
