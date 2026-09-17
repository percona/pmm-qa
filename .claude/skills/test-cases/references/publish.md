# Publishing approved cases to Zephyr

Read this at step 9 to choose each case's Folder, and at step 10 to publish.

## Folder

Folder is the Zephyr folder the case will be created in, so the reviewer approves its placement with the case. The path is `PMM<major>.x Tests / <area>`, where the major is the first number of the fix version and the area names the feature under test in one or two words, reusing an existing subfolder when one matches (`HA`, `RTA`, `Dashboards`, `Inventory`, `QAN`, `Backup`, `Alerting`, `Settings`, `CLI`, `API`, `Upgrade`, …). Read the `zephyr` skill's `folders` before choosing: when the project already has a separate top-level home for that major and area, such as `PMM3.x HA Tests`, use it rather than creating a second one.

## Publish

Run only when a user invoked this skill directly and explicitly approves the reviewed draft — "approve", "publish", "create them", or a list of case numbers. A question, an edit request, or no reply is not approval. Publish only the cases the approval names, with any requested edits applied to the draft first.

Read the `zephyr` skill for the relay setup and the `Z` helper. The fix version is the ticket's; with several, use the earliest, and with none, ask before publishing. For each approved case, in order:

1. `Z folders '{}'` once, then resolve each case's Folder path to a `folderId` by walking `name` and `parentId` from the root. Create what is missing, level by level: `Z create-folder` with the version folder name at the project root, then the area with the version folder's `id` as `parentId`, using each returned `id`. Zephyr allows duplicate names, so re-check `folders` before each create. Never place a case in another major's folder or at the project root.
2. `Z create` with `name` (the title without its number), `objective` (the Catches/Evidence line), `precondition` when the draft has one, `priorityName`, `statusName` (`Needs Automation` for Needs automation, `Manual Only` for Manual), `customFields {"Version of the Product": <fix version>}`, and `folderId`. Capture the returned `key`.
3. `Z steps` on that key, one step per table row: `description` from Step, `testData` from Data (unset when the cell is empty), `expectedResult` from Expected, each with the leading `- ` stripped. Append the Cleanup line as the last step with no expected result.
4. `Z link-issue` from the key to the ticket. Skip for a coverage audit with no ticket.

Then print one line per case: `<N>` → `PMM-Txxxx`, status, folder path. If `create` succeeds and a later call fails, report the key with what is still missing and finish that key on the next attempt; do not create the case again — Zephyr has no delete, so a duplicate can only be marked `Deprecated`.
