# Zephyr broker actions

The relay forces project `PMM` and the created case's owner from `ACTOR`. It exposes test-case operations only: no delete, free-form edit, or execution reporting.

| Action | Body | Result or constraint |
| --- | --- | --- |
| `search` | `query`, optional `folderId`, `limit` | Ranked name matches; `truncated:true` is inconclusive |
| `get` | `key`, optional `steps`, `jira` | Raw case plus resolved names, folder path, steps, and Jira keys |
| `list` | optional `folderId`, `recursive`, `limit` | Cases in a folder subtree or project |
| `statuses` | `{}` | Test-case status and priority id/name tables |
| `folders` | `{}` | Test-case folders |
| `create` | `name`, `customFields`, optional objective/precondition/folder/labels/priority/status | `Version of the Product` is required; name excludes key and tags |
| `set-status` | `key`, `status` | Server-side read-modify-write |
| `steps` | `key`, `steps`, optional `mode` | `OVERWRITE` by default; at most 100 steps |
| `link-issue` | `key`, `issue` | Adds Jira coverage link |
| `create-folder` | `name`, optional `parentId` | Check `folders` first; duplicate names are allowed upstream |

Examples:

```bash
R zephyr get "$(jq -n --arg k PMM-T2087 '{key:$k}')"
R zephyr search "$(jq -n --arg q 'add MySQL service' '{query:$q,limit:20}')"
R zephyr create "$(jq -n --arg n 'Verify MySQL service registration' --arg v '3.5.0' \
  '{name:$n,statusName:"Automated",customFields:{"Version of the Product":$v}}')"
```

Use `get`, not `search`, to read a known key. Never infer names from Zephyr ids; use the resolved block or `statuses`.
