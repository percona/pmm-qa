#!/usr/bin/env bash
set -uo pipefail

RELAY=${RELAY:-https://139-162-176-43.ip.linodeusercontent.com}

usage() {
  cat <<'EOF'
Usage: scripts/relay.sh [--full] <service> <action> '<json body>'

Read Jira, and read or write Zephyr, through the QA relay. Prints JSON on stdout.
The answer is trimmed to the fields this skill uses; --full prints the relay's answer as is.

  jira   read           {"issue":"PMM-15379"}
  jira   search         {"jql":"text ~ \"retention\" ORDER BY updated DESC","maxResults":20}
  zephyr search         {"query":"retention","folderId":56554549}
  zephyr get            {"key":"PMM-T2206"}
  zephyr list           {"folderId":56554549}
  zephyr folders        {}
  zephyr create         {"name":"...","objective":"...","folderId":123,"priorityName":"Normal","statusName":"Needs Automation","customFields":{"Version of the Product":"3.10.0"}}
  zephyr steps          {"key":"PMM-Txxxx","steps":[{"description":"...","testData":"...","expectedResult":"..."}]}
  zephyr link-issue     {"key":"PMM-Txxxx","issue":"PMM-nnnn"}
  zephyr create-folder  {"name":"LBAC","parentId":56554549}

The last four write to Zephyr: use them only in step 10, after the user approves the draft.
Jira is read-only here. Needs RELAY_KEY, and ACTOR set to your GitHub login (GitHub MCP get_me .login).
Exit 0 on success, 1 when the relay, Jira or Zephyr refuses, 2 on a usage error.
EOF
}

full=0
if [ "${1:-}" = "--full" ]; then full=1; shift; fi
case "${1:-}" in -h|--help) usage; exit 0 ;; esac
if [ $# -ne 3 ]; then usage >&2; exit 2; fi
service=$1; action=$2; body=$3

case "$service/$action" in
  jira/read|jira/search|zephyr/search|zephyr/get|zephyr/list|zephyr/folders|zephyr/create|zephyr/steps|zephyr/link-issue|zephyr/create-folder) ;;
  jira/*) echo "Error: jira $action is not allowed; this skill only reads Jira (read, search)." >&2; exit 2 ;;
  *) echo "Error: unknown $service $action. Run scripts/relay.sh --help for the list." >&2; exit 2 ;;
esac
[ -n "${RELAY_KEY:-}" ] || { echo "Error: RELAY_KEY is not set." >&2; exit 2; }
[ -n "${ACTOR:-}" ] || { echo "Error: ACTOR is not set. Set it to your GitHub login from the GitHub MCP get_me .login." >&2; exit 2; }
jq -e . >/dev/null 2>&1 <<<"$body" || { echo "Error: the body is not valid JSON: $body" >&2; exit 2; }

if [ "$service/$action" = "jira/read" ]; then
  body=$(jq -c '.fieldsCsv //= "summary,status,issuetype,components,labels,fixVersions,description,customfield_10083,comment,issuelinks,parent"' <<<"$body")
elif [ "$service/$action" = "jira/search" ]; then
  body=$(jq -c '.fields //= "summary,status,fixVersions"' <<<"$body")
fi

out=$(curl -sS -m 180 --fail-with-body -X POST "$RELAY/$service/$action" \
  -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" \
  -H "Content-Type: application/json" -d "$body" 2>&1)
rc=$?
if [ $rc -ne 0 ]; then
  echo "Error: $service $action failed (curl exit $rc): ${out:0:600}" >&2
  exit 1
fi

if [ $full -eq 1 ]; then printf '%s\n' "$out"; exit 0; fi

case "$service/$action" in
  jira/read) filter='{key, summary: .fields.summary, status: .fields.status.name, type: .fields.issuetype.name,
      fixVersions: [.fields.fixVersions[]?.name], components: [.fields.components[]?.name], labels: .fields.labels,
      parent: .fields.parent.key,
      links: [.fields.issuelinks[]? | {type: .type.name, key: (.outwardIssue.key // .inwardIssue.key),
               summary: (.outwardIssue.fields.summary // .inwardIssue.fields.summary)}],
      description: .fields.description, howToTest: .fields.customfield_10083,
      comments: [.fields.comment.comments[]? | {author: .author.displayName, created: .created[0:10], body}]}' ;;
  jira/search) filter='{total: (.total // (.issues | length)), issues: [.issues[]? | {key, summary: .fields.summary, status: .fields.status.name,
      fixVersions: [.fields.fixVersions[]?.name]}]}' ;;
  zephyr/search) filter='{scanned, truncated, matches: [.matches[]? | {key, name, folderId}]}' ;;
  zephyr/get) filter='{key, name, objective, precondition, status: .resolved.status, folder: .resolved.folder,
      jira: [.resolved.jiraIssues[]?.key], steps: [.resolved.steps[]? | {description, testData, expectedResult}]}' ;;
  zephyr/list) filter='{total, truncated, cases: [.cases[]? | {key, name, status, folder}]}' ;;
  zephyr/folders) filter='[.. | objects | select(has("id") and has("name") and has("parentId")) | {id, name, parentId}]' ;;
  *) filter='.' ;;
esac
trimmed=$(jq -c "$filter" <<<"$out" 2>&1); jrc=$?
if [ $jrc -ne 0 ]; then
  echo "Error: could not trim the $service $action answer ($trimmed); rerun with --full." >&2
  exit 1
fi
printf '%s\n' "$trimmed"
