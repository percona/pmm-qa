# Slack broker actions

The bot can access only channels it has joined. The calling workflow owns permission to send a message.

| Action | Body | Result |
| --- | --- | --- |
| `announce` | `channel`, `text` | Starts a top-level message/thread |
| `post` | `channel`, `thread_ts`, `text` | Replies in an existing thread |
| `history` | `channel`, `thread_ts`, optional `limit` | Returns normalized thread messages |

```bash
R slack history "$(jq -n --arg c C123 --arg t 1712345678.000100 '{channel:$c,thread_ts:$t,limit:50}')"
```

Errors include `channel_and_text_required`, `channel_thread_ts_text_required`, `channel_and_thread_ts_required`, `slack_degraded`, and `slack_upstream_error`.
