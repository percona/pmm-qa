# Publishing approved cases to Zephyr

Read this at step 9 to choose each case's Folder, and at step 10 to publish.

## Folder

Folder is the Zephyr folder the case will be created in, so the reviewer approves its placement with the case. The path is `PMM<major>.x Tests / <area>`, where the major is the first number of the fix version and the area names the feature under test in one or two words, reusing an existing subfolder of that major's folder when one matches (`HA`, `RTA`, `Dashboards`, `Inventory`, `QAN`, `Backup`, `Alerting`, `Settings`, `CLI`, `API`, `Upgrade`, …). Run `scripts/relay.sh zephyr folders '{}'` before choosing: when the project already has a separate top-level home for that major and area, such as `PMM3.x HA Tests`, use it rather than creating a second one. A same-named subfolder under another major is never a match.

## Publish

Run only when a user invoked this skill directly and explicitly approves the reviewed draft — "approve", "publish", "create them", or a list of case numbers. A question, an edit request, or no reply is not approval. Publish only the cases the approval names, with any requested edits applied to the draft first.

Zephyr has no delete, so plan, validate, then write. Every Zephyr call below goes through `scripts/relay.sh zephyr <action>`. The fix version is the ticket's; with several, use the earliest, and with none, ask before publishing.

1. `scripts/relay.sh zephyr folders '{}'` once, then resolve each case's Folder path to a `folderId` by walking `name` and `parentId` from the root. Note the levels that are missing; nothing is created yet.
2. Write `<scratchpad>/<ticket>-publish-plan.json`:

   ```json
   {"ticket": "PMM-XXXX", "fixVersion": "3.10.0", "cases": [
     {"n": 1, "name": "…", "objective": "…", "precondition": "…", "priorityName": "Normal",
      "statusName": "Needs Automation", "labels": [], "folderPath": "PMM3.x Tests / QAN", "folderId": 123,
      "openFinding": false, "steps": [{"description": "…", "testData": "…", "expectedResult": "…"}]}]}
   ```

   - `name` is the title without its number; `objective` is the Catches/Evidence line followed by `Lane: <workflow · job>`, `Blocked: <missing lane or helper>`, or `Manual: <reason>`, so the reason survives in Zephyr.
   - `statusName`: `Needs Automation` for Needs automation; `Needs Automation` with `labels: ["infra-gap"]` for Automation candidate — infra gap; `Manual Only` for Manual; `Draft`, with `openFinding: true` and the Finding in the objective, for any case whose expected result depends on an open Finding.
   - One step per table row, each cell with its leading `- ` stripped; `testData` omitted when the cell is empty. When the case has a Cleanup line, append it as the last step with no `expectedResult`.
   - `folderId` is `null` for a folder that does not exist yet.
3. Run `python3 scripts/check_publish_plan.py <plan>` and fix every error it reports before any Zephyr write.
4. Create missing folders level by level: `scripts/relay.sh zephyr create-folder` with the version folder name at the project root, then the area with the version folder's `id` as `parentId`. Zephyr allows duplicate names, so re-check `folders` before each create, and put the returned ids into the plan.
5. For each case, in order: `zephyr create` with the plan's fields and `customFields {"Version of the Product": <fix version>}`; capture the returned `key`; `zephyr steps` on that key with the plan's steps; `zephyr link-issue` from the key to the ticket, skipped for a coverage audit with no ticket.

Then print one line per case: `<N>` → `PMM-Txxxx`, status, folder path. If `create` succeeds and a later call fails, report the key with what is still missing and finish that key on the next attempt; do not create the case again — a duplicate can only be marked `Deprecated`.
