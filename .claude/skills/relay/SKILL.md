---
name: relay
description: Use the shared PMM HTTPS relay for Jira ticket reads and writes, Zephyr test cases, Linode provisioning, and Slack messages. Use for any PMM Jira lookup, search, comment, field update, transition, attachment, or issue creation, and whenever another PMM workflow needs a relay-brokered service. Load only that service's reference. Not for test-case design or PMM-T lifecycle decisions; use test-cases.
---

# PMM relay

Own only the transport shared by relay-backed services. The calling domain skill owns decisions, workflow, permissions, and interpretation of the response.

## Call the broker

1. Resolve the caller's GitHub login with GitHub MCP `get_me` and export it as `ACTOR`. Never derive it from email, display name, Jira identity, or the user's identity.
2. Read only the service reference needed for the call:
   - Jira: [references/jira.md](references/jira.md)
   - Zephyr: [references/zephyr.md](references/zephyr.md)
   - Linode: [references/linode.md](references/linode.md)
   - Slack: [references/slack.md](references/slack.md)
3. Build the JSON body with `jq`, then define the native curl helpers once per shell:

   ```bash
   RELAY=https://139-162-176-43.ip.linodeusercontent.com
   R() { curl -sS --connect-timeout 10 -m "${RELAY_TIMEOUT:-240}" --fail-with-body \
     -X POST "$RELAY/$1/$2" -H "X-Relay-Secret: $RELAY_KEY" \
     -H "X-Actor: $ACTOR" -H "Content-Type: application/json" -d "$3"; }
   R_STATUS() { local out=$1; shift; curl -sS --connect-timeout 10 -m "${RELAY_TIMEOUT:-240}" \
     -X POST "$RELAY/$1/$2" -H "X-Relay-Secret: $RELAY_KEY" \
     -H "X-Actor: $ACTOR" -H "Content-Type: application/json" -d "$3" \
     -o "$out" -w '%{http_code}'; }
   ```

Use `R <service> <action> '<json>'` for ordinary calls. Use
`R_STATUS <output-file> <service> <action> '<json>'` only when asynchronous
polling must preserve the response body and branch on HTTP status.

## Boundaries

- Never place service tokens in this environment or call Jira, Zephyr, Slack, or Linode APIs directly when a broker action exists.
- A relay call does not grant permission for the underlying write. The calling skill must authorize it first.
- Parse the raw response at the call site so the service reference remains authoritative.
