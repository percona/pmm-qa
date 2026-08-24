---
name: zephyr
description: Create and look up PMM test cases in Zephyr Scale (project PMM) to get the PMM-Txxxx key a new automated test needs in its title. Use when writing a test that has no key yet, checking whether a case already exists before creating a duplicate, or reading an existing PMM-Txxxx.
---

# Zephyr Scale (PMM test cases)

Every automated test in this repo is named after its Zephyr **test case key**
(`PMM-Txxxx`) — the CI reporter parses the key out of the test title to post the
result. A test with no key reports nowhere, so a new test needs a real test case
first. This skill creates it and hands back the key.

## Access path — the relay broker

**All Zephyr operations go through the relay's `/zephyr/<action>` broker** (curl,
see "Operations"). The relay holds `ZEPHYR_PMM_API_KEY`; this environment holds
only `RELAY_KEY`. Identify yourself with `X-Actor` (your GitHub login, from the
GitHub MCP `get_me`), which the relay roster-checks. Same gate and same shape as
the `jira` skill. The relay:

- forces `projectKey: PMM` on every call;
- exposes **read + create test cases only** — no update, no delete, and no
  execution reporting (CI posts executions itself, see "Who reports results");
- returns the Zephyr REST response (status + body) verbatim on create/get.

Do **not** call `api.zephyrscale.smartbear.com` directly — the API key is not in
this environment (the one place that holds it is GitHub Actions, for the CI
reporter).

## Title format the rest of the repo assumes

The reporter splits on `' - '` and then on `' + '`, so the key block must come
first and be separated by exactly those:

| Case | Title |
|---|---|
| One test case | `PMM-T2087 - Verify description of the check @tag` |
| Several test cases in one test | `PMM-T948 + PMM-T947 - Verify A, Verify B @tag` |
| Zephyr `name` field | `Verify description of the check` — **no key, no `@tag`** |

Rules: the key block is `PMM-Txxxx` joined by ` + ` (2, 3, or more), then ` - `,
then the description, then CodeceptJS/Playwright tags at the end. The Zephyr test
case `name` is the description **only** — the key is Zephyr's own identifier and
the tags are a repo concern, so the broker rejects a `name` starting with a key.

## Workflow — from "new test" to a key in the title

1. **Search first** (mandatory — duplicates are cheap to create, expensive to
   clean up). Query with the description, or paste the whole intended test title;
   the relay strips the `PMM-Txxxx - ` prefix and trailing `@tags` for you.
2. **Read the candidates.** `matches` is ranked by `score`: a name containing the
   whole query scores highest, then by how many query words the name contains
   (a match needs ≥60% of them). Judge them yourself — a high score can still be
   a different case, and a real duplicate can score low if it is worded
   differently. Search once more with different words before concluding "none".
3. **Reuse or create.** If an existing case covers the behaviour, use its key —
   automating an already-written manual case is the normal path. Only create when
   nothing covers it.
4. **Create** with `create`, taking `folderId` from `folders` so the
   case lands next to its feature instead of the project root. The response is
   `201 {"id":…,"key":"PMM-T…"}` — that `key` is what goes into the test title.
5. **Put the key in the test title** in the format above, and check the test's
   suite actually reports to Zephyr (see below) before claiming the result will
   land in a cycle.

## Operations (via the relay)

`POST $RELAY/zephyr/<action>` with `X-Relay-Secret: $RELAY_KEY` and
`X-Actor: <your GitHub login>`; the action is in the URL path, args in the JSON
body. Project is forced to `PMM`.

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com   # fixed prod relay (reserved IP)
# X-Actor is your GitHub login — set ACTOR from the GitHub MCP get_me (.login) first.
command -v gh >/dev/null && ACTOR="${ACTOR:-$(gh api user --jq .login)}"
[ -n "$ACTOR" ] || { echo "ACTOR unset — set it from the GitHub MCP get_me .login" >&2; exit 1; }
Z() { curl -sS -m 180 --fail-with-body -X POST "$RELAY/zephyr/$1" \
        -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" \
        -H "Content-Type: application/json" -d "$2"; }

# search — dedup BEFORE creating. A full test title works as the query.
Z search "$(jq -n --arg q 'PMM-T555 - Verify user is able to add MySQL service @instances' \
      '{query:$q, limit:20}')"
Z search "$(jq -n --arg q 'add MySQL service' '{query:$q, folderId:1234}')"

# folders — TEST_CASE folders of the PMM project, to pick a folderId
Z folders '{}'

# create — name is the DESCRIPTION only. Returns 201 {id, key, self}.
Z create "$(jq -n --arg n 'Verify user is able to add MySQL service' \
      --arg o 'Ensures the Add Service wizard registers a MySQL instance' \
      '{name:$n, objective:$o, folderId:1234, labels:["Automated"]}')"

# get — read an existing key (name, folder, status, priority, labels)
Z get "$(jq -n --arg k PMM-T2087 '{key:$k}')"
```

| Action | Body | Notes |
|---|---|---|
| `search` | `query` (required), `folderId`, `limit` (≤100, default 20) | Ranked name match, done relay-side; returns `{query, scanned, truncated, matches:[{key,name,score,folderId}]}`. `truncated:true` = the scan hit its page cap, so treat "no match" as inconclusive |
| `create` | `name` (required, 1–255), `objective`, `precondition`, `folderId`, `labels`, `priorityName`, `statusName`, `ownerId`, `fields` (raw passthrough) | Returns Zephyr's `201 {id, key, self}` |
| `get` | `key` (`PMM-Txxxx`) | Returns the test case verbatim; `404` if it does not exist |
| `folders` | — | `{folders:[{id,name,parentId}], total, isLast}` for `TEST_CASE` folders |

Errors: `400` bad input (`name_required_1_255_chars`,
`name_must_not_start_with_a_test_case_key`, `key_must_be_a_PMM-T_key`,
`bad_folder_id`, `query_required`), `403` bad `RELAY_KEY` / non-roster actor,
`503 zephyr_not_configured` (key missing from the relay `.env`),
`502 zephyr_upstream_error`, or Zephyr's own status passed through.

## Zephyr Scale API v2 — only what this skill uses

Base `https://api.zephyrscale.smartbear.com/v2`, auth
`Authorization: Bearer <key>`, project key `PMM`, default test cycle `PMM-R203`
(`ZEPHYR_TEST_CYCLE_KEY` overrides it in CI).
[Full spec](https://support.smartbear.com/zephyr-scale-cloud/api-docs/).

| Endpoint | Used by | Notes |
|---|---|---|
| `POST /testcases` | `create` | Requires `projectKey` + `name`; `priorityName`/`statusName` default to Normal/Draft. `201 {id, key, self}`. Creation adds one empty test step — real steps need `POST /testcases/{key}/teststeps` in `OVERWRITE` mode, which this broker does not expose |
| `GET /testcases/{testCaseKey}` | `get` | `status`/`priority`/`folder` come back as `{id, self}` links, not names |
| `GET /testcases/nextgen` | `search` | `projectKey`, `folderId`, `limit` (≤1000), `startAtId`; cursor pagination via `nextStartAtId`. **There is no name/text search in the API** — hence the relay-side scan and ranking |
| `GET /folders` | `folders` | `projectKey`, `folderType=TEST_CASE`, `maxResults` (≤1000) |
| `POST /testexecutions` | CI only | `projectKey`, `testCaseKey`, `testCycleKey`, `statusName` (`PASS`/`FAIL`), `comment`. Not brokered — see below |

## Who reports results (and who doesn't)

| Suite | Reports to Zephyr? |
|---|---|
| `codeceptjs-e2e` | Yes — `tests/helper/reporter_helper.js` (`_afterSuite`) posts `POST /testexecutions` per key when `CI` is set, into `ZEPHYR_TEST_CYCLE_KEY` or `PMM-R203`. Every upload error is swallowed by a silent `catch`, so a missing execution leaves no trace beyond a `console.log` |
| `e2e_tests` (Playwright) | **No.** No Zephyr reporter exists, so a `PMM-Txxxx` in a Playwright title records nothing — the workflow injects `ZEPHYR_PMM_API_KEY` but nothing reads it |

Still put the key in a Playwright test title (it is the traceability link and the
convention), but do not tell anyone the run will show up in a Zephyr cycle until
that reporter exists.
