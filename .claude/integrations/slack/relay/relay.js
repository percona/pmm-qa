// PMM AI relay — Slack/Jira -> Claude Code Routines (Socket Mode; no public inbound needed for Slack)
// Deps: npm i @slack/bolt   (Node >= 20)
// Deployed on the pmm-ai-relay Linode by deploy.sh (same directory); config via /opt/pmm-ai-relay/.env
import pkg from "@slack/bolt";
import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const { App } = pkg;
const execFileP = promisify(execFile);

// Slack Socket Mode can reject asynchronously on a background reconnect (e.g.
// invalid_auth) OUTSIDE the try/catch around app.start(); unguarded that becomes
// an unhandledRejection and takes the whole relay down, defeating the
// endpoints-only fallback and killing the /linode, /jira, /slack broker with it.
// Keep the listeners serving and just log — a broken Slack must never stop the
// HTTPS broker. (Sync bugs still crash, as they should.)
process.on("unhandledRejection", (e) => {
  console.error(`unhandledRejection (relay stays up): ${e?.stack || e?.message || e}`);
});
// The relay's own copy of the linode-runner module (cloned by deploy.sh), used
// by /linode/provision + /linode/destroy so the LINODE_TOKEN never leaves this box.
const RUNNER_DIR = process.env.RUNNER_DIR || "/opt/pmm-qa/terraform/linode-runner";

// Mentions from REGISTERED people fire the central owner's "router" routine;
// it only decides which of the caller's own routines fits (or declines), then
// hands off via POST /route. The actual work runs on the CALLER's routine,
// billed to the caller.
// ALL routine ids/tokens live in the per-person files — the .env holds names
// only. People are ONE SMALL JSON FILE EACH in PEOPLE_DIR (default
// /opt/pmm-ai-relay/people/<name>.json), hot-reloaded on any change:
//   { "slack": "U0123", "jira": "<atlassian accountId>",
//     "routines": { "test-runner": {"id":"trig_...","token":"sk-ant-..."},
//                   "investigator": {...}, "router": {...} } }
// CENTRAL_OWNER: which person's file holds the central routines — the
//   "router" entry (fired by registered mentions), the fallback test-runner
//   for /jira, and whatever WATCHED_CHANNELS points at.
// WATCHED_CHANNELS: {"C0123":"investigator"} — channel ID -> agent NAME,
//   resolved from CENTRAL_OWNER's file; every top-level human message fires it.
const PEOPLE_DIR = process.env.PEOPLE_DIR || "/opt/pmm-ai-relay/people";
const CENTRAL_OWNER = process.env.CENTRAL_OWNER || "";
const WATCHED_CHANNELS = JSON.parse(process.env.WATCHED_CHANNELS || "{}");

let bySlack = {};
let byJira = {};
let byName = {};
let ghRoster = new Set(); // github logins from people files (broker roster), lowercased
function loadPeople() {
  const s = {};
  const j = {};
  const n = {};
  const gh = new Set();
  let files = [];
  try {
    files = fs.readdirSync(PEOPLE_DIR).filter((f) => f.endsWith(".json"));
  } catch (e) {
    console.error(`people dir unreadable (${PEOPLE_DIR}): ${e.message}`);
  }
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(PEOPLE_DIR, f), "utf8"));
      p.name = f.replace(/\.json$/, "");
      n[p.name] = p;
      if (p.slack) s[p.slack] = p;
      if (p.jira) j[p.jira] = p;
      if (p.github) gh.add(String(p.github).toLowerCase()); // broker roster
    } catch (e) {
      console.error(`people: skipping bad file ${f}: ${e.message}`); // one broken file never takes the relay down
    }
  }
  bySlack = s;
  byJira = j;
  byName = n;
  ghRoster = gh;
  console.log(`people loaded: ${files.length} file(s), central owner "${CENTRAL_OWNER}" ${byName[CENTRAL_OWNER] ? "found" : "MISSING"}`);
}

// Central routines resolve from the owner's file at call time, so they pick
// up hot-reloaded token changes too.
const centralRoutine = (agent) => byName[CENTRAL_OWNER]?.routines?.[agent] || null;
loadPeople();
let reloadTimer;
try {
  fs.watch(PEOPLE_DIR, { persistent: false }, () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadPeople, 500); // editors fire several events per save
  });
} catch (e) {
  console.error(`people watch failed (edits need a restart): ${e.message}`);
}
const ALLOW_FALLBACK = process.env.ALLOW_FALLBACK === "true"; // /jira: unmapped initiator -> central owner's test-runner
const CHANNELS = (process.env.CHANNEL_ALLOWLIST || "").split(",").filter(Boolean); // mention flow; empty => all channels
const JIRA_RELAY_SECRET = process.env.JIRA_RELAY_SECRET;
const RELAY_KEY = process.env.RELAY_KEY; // shared-env → relay bearer; gates every /<service>/<action> broker call (with GitHub identity)
const JIRA_EMAIL = process.env.JIRA_EMAIL; // relay-side Jira service account, used by the /jira/<action> broker
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const REPLY_SECRET = process.env.REPLY_SECRET;
if (!REPLY_SECRET) {
  // sign() runs before either Slack handler's try block, so a missing secret
  // would otherwise crash the process on the first mention with an opaque
  // createHmac error. Fail loudly at startup instead.
  console.error("REPLY_SECRET is required (used to sign /reply and /route capabilities). Set it in .env.");
  process.exit(1);
}
const REPLY_BASE_URL = process.env.REPLY_BASE_URL || "https://localhost";
// HTTPS-only. Fired cloud sessions can only egress through an HTTPS CONNECT
// proxy that validates the origin cert against public CAs, so the relay needs
// a real (Let's Encrypt) cert and there is no plain-HTTP path.
const HTTPS_PORT = Number(process.env.REPLY_HTTPS_PORT || 443);
const TLS_CERT = process.env.TLS_CERT || "/opt/pmm-ai-relay/tls/cert.pem";
const TLS_KEY = process.env.TLS_KEY || "/opt/pmm-ai-relay/tls/key.pem";
// deploy points these at the Let's Encrypt live cert when issuance succeeds,
// else at a self-signed fallback (relay still starts, but the egress proxy
// will reject the self-signed origin cert — see README "Endpoints").
const CAP_TTL_MS = 2 * 60 * 60 * 1000;

// Broker access control. Every /<service>/<action> call needs the shared
// RELAY_KEY (possession) plus a caller identity. The caller sends its GitHub
// login in X-Actor — it gets that login from `gh api user`, which the egress
// proxy really verified — and the relay checks it against the roster (the
// `github` logins in the people files it already loads; see ghRoster) and logs
// it. No extra env var; the roster is the people directory.
//
// Design note: this is env-membership-grade, not cryptographically unspoofable
// at the relay boundary — a caller that already holds RELAY_KEY could forge
// X-Actor. That's an accepted trade: the hard gate is possession of RELAY_KEY
// (= membership of the admin-controlled shared env), and the whole broker
// surface is bounded + audited, so the blast radius of a forged identity is the
// short op list, never account access. (Unspoofable upgrade = the push-proof
// handshake, documented in AUTOMATIONS.) Empty roster = any login accepted.
function rosterOk(login) {
  return ghRoster.size === 0 || ghRoster.has(login.toLowerCase());
}
function identity(req) {
  const actor = String(req.headers["x-actor"] || "").trim();
  if (!actor) return { ok: false, code: 401, msg: "actor_required" };
  if (!rosterOk(actor)) return { ok: false, code: 403, msg: "identity_not_authorized" };
  return { ok: true, login: actor };
}

// DEGRADED MODE: without real Slack tokens the relay still serves /health,
// /jira, /route and /reply so every non-Slack flow can be exercised before
// the app is approved — Slack-bound actions (reactions, thread replies)
// become log lines instead.
const SLACK_READY =
  /^xapp-/.test(process.env.SLACK_APP_TOKEN || "") &&
  /^xoxb-/.test(process.env.SLACK_BOT_TOKEN || "") &&
  !/FILL/i.test(`${process.env.SLACK_APP_TOKEN}${process.env.SLACK_BOT_TOKEN}`);
const app = SLACK_READY
  ? new App({
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
    })
  : null;

const seen = new Map(); // event_id -> ts (fast in-memory dedup)
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of seen) if (v < cutoff) seen.delete(k);
}, 60_000).unref();

// Capabilities are HMAC-bound to their purpose + thread, so a fired session
// can only act on the thread that triggered it, and a /reply cap can't be
// replayed against /route (and vice versa).
const sign = (purpose, parts, exp) =>
  crypto.createHmac("sha256", REPLY_SECRET).update(`${purpose}|${parts.join("|")}|${exp}`).digest("hex");
const verify = (cap, purpose, parts, exp) => {
  if (Date.now() > exp) return false;
  const expected = sign(purpose, parts, exp);
  return cap.length === expected.length && crypto.timingSafeEqual(Buffer.from(cap), Buffer.from(expected));
};

async function fire(routine, text) {
  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routine.id}/fire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${routine.token}`,
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`fire ${res.status}: ${await res.text()}`);
  return (await res.json()).claude_code_session_url;
}

// Durable dedup + "seen" UX: 👀 reaction survives relay restarts; Slack
// redeliveries hit already_reacted and stop. 👀 is never removed (removing it
// would let a late redelivery re-fire); ✅ is ADDED on completion instead.
// Returns false when this event is a duplicate.
async function markSeen(client, channel, ts, eventId) {
  if (seen.has(eventId)) return false;
  seen.set(eventId, Date.now());
  try {
    await client.reactions.add({ channel, timestamp: ts, name: "eyes" });
  } catch (e) {
    if (e?.data?.error === "already_reacted") return false;
    console.error(`reactions.add: ${e?.data?.error || e.message}`);
  }
  return true;
}

// Roll back the dedup marker when fire() fails, so a Slack redelivery (or the
// next mention) can retry instead of hitting already_reacted and dropping the
// request permanently. 👀 is only durable once the routine has actually started.
async function unsee(client, channel, ts, eventId) {
  seen.delete(eventId);
  try {
    await client.reactions.remove({ channel, timestamp: ts, name: "eyes" });
  } catch (e) {
    console.error(`reactions.remove: ${e?.data?.error || e.message}`);
  }
}

function replyInstructions(channel, threadTs) {
  const exp = Date.now() + CAP_TTL_MS;
  const cap = sign("reply", [channel, threadTs], exp);
  return (
    `To reply in the Slack thread, POST ${REPLY_BASE_URL}/reply with JSON ` +
    `{"channel":"${channel}","thread_ts":"${threadTs}","cap":"${cap}","exp":${exp},"text":"<your reply>"}`
  );
}

async function fetchThreadHistory(client, channel, threadTs) {
  try {
    const r = await client.conversations.replies({ channel, ts: threadTs, limit: 30 });
    return (
      "Earlier messages in this thread (oldest first):\n" +
      r.messages
        .slice(0, -1)
        .map((m) => `- ${m.bot_id ? "PMM AI" : m.user}: ${m.text}`)
        .join("\n") +
      "\n\n"
    );
  } catch (e) {
    console.error(`history fetch failed: ${e?.data?.error || e.message}`);
    return "";
  }
}

// Channel watch: every top-level human message in a watched channel fires the
// mapped agent from the central owner's file (e.g. alerts channel -> investigator).
app?.event("message", async ({ event, body, client }) => {
  const agent = WATCHED_CHANNELS[event.channel];
  if (!agent) return;
  const routine = centralRoutine(agent);
  if (!routine) {
    console.error(`watched channel ${event.channel}: central owner has no "${agent}" routine`);
    return;
  }
  if (event.subtype || event.bot_id || event.thread_ts) return; // top-level human posts only
  if (!(await markSeen(client, event.channel, event.ts, body.event_id))) return;

  const payload =
    `Slack message in watched channel ${event.channel} (thread ${event.ts}, author ${event.user}):\n` +
    `${event.text}\n\n${replyInstructions(event.channel, event.ts)}`;
  try {
    console.log(`channel-fire ${routine.id}: ${await fire(routine, payload)}`);
  } catch (e) {
    console.error(e.message);
    await unsee(client, event.channel, event.ts, body.event_id); // let a redelivery retry
  }
});

// Mention flow: only REGISTERED people reach the central router (unregistered
// get a zero-cost reply). The router evaluates the ask and hands off to one of
// the CALLER's own routines via POST /route — so the work is billed to, and
// acts as, the person who asked. Tokens stay on this server.
app?.event("app_mention", async ({ event, body, client }) => {
  const ROUTER = centralRoutine("router");
  if (!ROUTER) return; // mention flow disabled (no router in the central owner's file)
  if (WATCHED_CHANNELS[event.channel]) return; // watched channels are handled above
  if (CHANNELS.length && !CHANNELS.includes(event.channel)) return;
  if (!(await markSeen(client, event.channel, event.ts, body.event_id))) return;

  const threadTs = event.thread_ts || event.ts;
  // ALLOW_FALLBACK gates BOTH entry points the same way: true lets an
  // unregistered person run on the central owner's routines; false blocks.
  // A person with no routines yet (IDs pre-loaded, token not added) counts as
  // unregistered here too — same zero-cost reply as the Jira path, so their
  // mention never fires the central router by accident.
  const mapped = (p) => p && Object.keys(p.routines || {}).length > 0;
  let person = bySlack[event.user];
  if (!mapped(person) && ALLOW_FALLBACK && byName[CENTRAL_OWNER])
    person = { ...byName[CENTRAL_OWNER], name: `${CENTRAL_OWNER} (fallback for ${event.user})` };
  if (!mapped(person)) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: `:lock: <@${event.user}> you're not registered with PMM AI yet — ask the QA team to add you to the relay map.`,
    });
    return;
  }

  const text = event.text.replace(/<@[^>]+>/g, "").trim();
  const history = event.thread_ts ? await fetchThreadHistory(client, event.channel, event.thread_ts) : "";
  const exp = Date.now() + CAP_TTL_MS;
  const routeCap = sign("route", [event.user, event.channel, threadTs], exp);
  const agents = Object.keys(person.routines || {});

  const payload =
    `Slack mention from ${person.name} (${event.user}) in channel ${event.channel} (thread ${threadTs}):\n` +
    `${history}Current request:\n${text}\n\n` +
    `This caller has these personal routines available: ${agents.join(", ") || "(none)"}.\n` +
    `If the request fits one of them, hand off by POSTing ${REPLY_BASE_URL}/route with JSON ` +
    `{"user":"${event.user}","channel":"${event.channel}","thread_ts":"${threadTs}",` +
    `"agent":"<one of the available routines>","instruction":"<self-contained task for that agent>",` +
    `"cap":"${routeCap}","exp":${exp}} — the work then runs on the caller's own account.\n` +
    `If the request is off-topic, or no suitable routine is available, do NOT hand off; ` +
    `reply briefly instead. ${replyInstructions(event.channel, threadTs)}`;

  try {
    console.log(`router-fire for ${person.name}: ${await fire(ROUTER, payload)}`);
  } catch (e) {
    console.error(e.message);
    await unsee(client, event.channel, event.ts, body.event_id); // let a redelivery retry
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: `:warning: PMM AI could not start. Check the relay logs.`,
    });
  }
});

// ---- Broker service handlers -------------------------------------------
// Each takes (action, body, by) where `by` is the VERIFIED GitHub login, and
// returns {status, body, json?} — the dispatch in handler() writes the
// response. All privileged actions live here behind one auth gate.

async function brokerLinode(action, m, by) {
  if (!process.env.LINODE_TOKEN) return { status: 503, body: "linode_not_configured" };
  if (action === "provision") {
    const { role, run_id, ttl_hours, pmm_qa_ref } = m;
    if (!/^[A-Za-z0-9._-]+$/.test(String(role || ""))) return { status: 400, body: "bad_role" };
    if (!/^[A-Za-z0-9._-]+$/.test(String(run_id || ""))) return { status: 400, body: "bad_run_id" };
    const args = [`${RUNNER_DIR}/up.sh`, String(role), String(run_id)];
    if (ttl_hours != null && Number.isFinite(Number(ttl_hours))) args.push("-var", `ttl_hours=${Number(ttl_hours)}`);
    const env = { ...process.env, PMM_QA_REF: pmm_qa_ref ? String(pmm_qa_ref) : "main", CLAUDE_CODE_SESSION_ID: `relay:${by}` };
    console.log(`linode/provision ${role} ${run_id} (ttl=${ttl_hours ?? 24}) by ${by}`);
    try {
      await execFileP("bash", args, { env, timeout: 480000, maxBuffer: 10 * 1024 * 1024 });
      const rd = `${RUNNER_DIR}/runs/${run_id}`;
      const ip = fs.readFileSync(`${rd}/ip`, "utf8").trim();
      const exec_token = fs.readFileSync(`${rd}/exec_token`, "utf8").trim();
      const exec_cert_pem = fs.readFileSync(`${rd}/exec_cert.pem`, "utf8"); // public cert, run.sh pins it
      return { status: 200, json: true, body: JSON.stringify({ run_id, ip, exec_token, exec_cert_pem }) };
    } catch (e) {
      const tail = String(e.stderr || e.stdout || e.message || "").slice(-1500);
      console.error(`linode/provision failed: ${e.message}\n${tail}`);
      return { status: 502, json: true, body: JSON.stringify({ error: "provision_failed", detail: tail }) };
    }
  }
  if (action === "destroy") {
    const { run_id } = m;
    if (!/^[A-Za-z0-9._-]+$/.test(String(run_id || ""))) return { status: 400, body: "bad_run_id" };
    console.log(`linode/destroy ${run_id} by ${by}`);
    try {
      await execFileP("bash", [`${RUNNER_DIR}/down.sh`, String(run_id)], { env: process.env, timeout: 240000, maxBuffer: 10 * 1024 * 1024 });
      return { status: 200, body: "ok" };
    } catch (e) {
      const tail = String(e.stderr || e.stdout || e.message || "").slice(-1500);
      console.error(`linode/destroy failed: ${e.message}\n${tail}`);
      return { status: 502, json: true, body: JSON.stringify({ error: "destroy_failed", detail: tail }) };
    }
  }
  return { status: 400, body: "unknown_action" };
}

async function brokerJira(action, m, by) {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) return { status: 503, body: "jira_not_configured" };
  const issue = m.issue;
  if (!/^PMM-\d+$/.test(issue || "")) return { status: 400, body: "issue_must_be_a_PMM_key" };
  const base = "https://perconadev.atlassian.net/rest/api/2";
  const auth = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const jira = (path, init = {}) =>
    fetch(`${base}${path}`, { ...init, headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) } });
  console.log(`jira/${action} ${issue} by ${by}`);
  let r;
  try {
    if (action === "read") {
      const fields = m.fieldsCsv || "summary,description,status,customfield_10083,customfield_10492,comment";
      r = await jira(`/issue/${issue}?fields=${encodeURIComponent(fields)}`);
    } else if (action === "comment") {
      // visibility FORCED to Developers regardless of caller input — never public.
      r = await jira(`/issue/${issue}/comment`, { method: "POST", body: JSON.stringify({ body: String(m.body || ""), visibility: { type: "role", value: "Developers" } }) });
    } else if (action === "field") {
      r = await jira(`/issue/${issue}`, { method: "PUT", body: JSON.stringify({ fields: m.fields || {} }) });
    } else if (action === "transitions") {
      r = await jira(`/issue/${issue}/transitions`);
    } else if (action === "transition") {
      r = await jira(`/issue/${issue}/transitions`, { method: "POST", body: JSON.stringify({ transition: { id: String(m.transitionId) } }) });
    } else if (action === "attach") {
      const fd = new FormData();
      fd.append("file", new Blob([Buffer.from(String(m.content_b64 || ""), "base64")]), String(m.filename || "evidence.png"));
      r = await fetch(`${base}/issue/${issue}/attachments`, { method: "POST", headers: { Authorization: auth, "X-Atlassian-Token": "no-check" }, body: fd });
    } else {
      return { status: 400, body: "unknown_action" };
    }
    return { status: r.status, json: true, body: (await r.text()) || "{}" };
  } catch (e) {
    console.error(`jira/${action} failed: ${e.message}`);
    return { status: 502, body: "jira_upstream_error" };
  }
}

async function brokerSlack(action, m, by) {
  console.log(`slack/${action} by ${by}`);
  try {
    if (action === "announce") {
      // fresh top-level message (starts a thread); the bot only reaches channels it was invited to.
      const { channel, text } = m;
      if (!channel || !text) return { status: 400, body: "channel_and_text_required" };
      if (app) await app.client.chat.postMessage({ channel, text });
      else console.log(`DEGRADED slack/announce ${channel}: ${text}`);
      return { status: 200, body: "ok" };
    }
    if (action === "post") {
      // reply into an existing thread by ts (no HMAC cap — this is the identity-gated broker path).
      const { channel, thread_ts, text } = m;
      if (!channel || !thread_ts || !text) return { status: 400, body: "channel_thread_ts_text_required" };
      if (app) await app.client.chat.postMessage({ channel, thread_ts, text });
      else console.log(`DEGRADED slack/post ${channel}/${thread_ts}: ${text}`);
      return { status: 200, body: "ok" };
    }
    if (action === "history") {
      const { channel, thread_ts, limit } = m;
      if (!channel || !thread_ts) return { status: 400, body: "channel_and_thread_ts_required" };
      if (!app) return { status: 503, body: "slack_degraded" };
      const rr = await app.client.conversations.replies({ channel, ts: thread_ts, limit: Number(limit) || 50 });
      return { status: 200, json: true, body: JSON.stringify({ messages: rr.messages.map((x) => ({ from: x.bot_id ? "PMM AI" : x.user, text: x.text, ts: x.ts })) }) };
    }
    return { status: 400, body: "unknown_action" };
  } catch (e) {
    console.error(`slack/${action} failed: ${e?.data?.error || e.message}`);
    return { status: 502, body: "slack_upstream_error" };
  }
}

const MAX_BODY_BYTES = 64 * 1024; // relay payloads are tiny JSON; reject anything larger
const handler = async (req, res) => {
    req.setTimeout(15_000, () => req.destroy()); // don't let a slow client hold the socket open
    let raw = "";
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413).end("payload too large");
        req.destroy();
        return;
      }
      raw += c;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ mode: app ? "full" : "degraded", people: Object.keys(byName), centralOwner: CENTRAL_OWNER }),
      );
      return;
    }

    // Fired sessions reply in-thread through here; the bot token never leaves the relay.
    if (req.method === "POST" && req.url === "/reply") {
      try {
        const { channel, thread_ts, cap, exp, text } = JSON.parse(raw);
        if (!verify(cap, "reply", [channel, thread_ts], exp)) throw new Error("bad capability");
        if (app) {
          await app.client.chat.postMessage({ channel, thread_ts, text });
          await app.client.reactions
            .add({ channel, timestamp: thread_ts, name: "white_check_mark" })
            .catch(() => {});
        } else {
          console.log(`DEGRADED /reply accepted for ${channel}/${thread_ts}: ${text}`);
        }
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`reply rejected: ${e.message}`);
        res.writeHead(403).end("forbidden");
      }
      return;
    }

    // The central router hands off here: fires one of the CALLER's own
    // routines with a fresh reply capability for the same thread.
    if (req.method === "POST" && req.url === "/route") {
      try {
        const { user, channel, thread_ts, agent, instruction, cap, exp } = JSON.parse(raw);
        if (!verify(cap, "route", [user, channel, thread_ts], exp)) throw new Error("bad capability");
        const person = bySlack[user] || (ALLOW_FALLBACK ? byName[CENTRAL_OWNER] : null); // same fallback as the mention path
        const routine = person?.routines?.[agent];
        if (!routine) throw new Error(`no "${agent}" routine mapped for ${user}`);
        const payload =
          `Handed off by PMM AI router on behalf of ${person.name} (Slack ${user}).\n` +
          `Task:\n${instruction}\n\n${replyInstructions(channel, thread_ts)}`;
        console.log(`route-fire ${agent} for ${person.name}: ${await fire(routine, payload)}`);
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`/route rejected: ${e.message}`);
        res.writeHead(403).end("forbidden");
      }
      return;
    }

    // Jira Automation entry point: the single admin-configured rule POSTs here
    // with {"accountId":"{{initiator.accountId}}","text":"ticket + instruction"}.
    // Routes to the initiator's own test-runner routine.
    // Distinct statuses so the Jira Automation rule can react precisely:
    // 403 bad secret | 404 initiator not onboarded (the ONLY case that should
    // trigger the "you're not registered" comment) | 502 downstream failure.
    if (req.method === "POST" && req.url === "/jira") {
      if (!JIRA_RELAY_SECRET || req.headers["x-relay-secret"] !== JIRA_RELAY_SECRET) {
        console.error("/jira rejected: bad secret");
        res.writeHead(403).end("forbidden");
        return;
      }
      let accountId, text;
      try {
        ({ accountId, text } = JSON.parse(raw));
      } catch {
        res.writeHead(400).end("bad_request");
        return;
      }
      const person = byJira[accountId];
      const routine = person?.routines?.["test-runner"] || (ALLOW_FALLBACK ? centralRoutine("test-runner") : null);
      if (!routine) {
        console.error(`/jira: initiator ${accountId} not onboarded`);
        res.writeHead(404).end("not_registered");
        return;
      }
      try {
        console.log(
          `jira-fire for ${person?.name || "fallback"}: ${await fire(routine, `Jira trigger (initiator ${accountId}):\n${text}`)}`,
        );
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`/jira fire failed: ${e.message}`);
        res.writeHead(502).end("fire_failed");
      }
      return;
    }

    // Broker: POST /<service>/<action> — one gate, one dispatch for every
    // privileged action (linode/jira/slack). Requires BOTH the shared RELAY_KEY
    // (possession) AND a verified GitHub identity (who you are): the caller's
    // GitHub token is checked against GitHub itself, so `by` is unspoofable and
    // an unknown identity is refused even with a valid RELAY_KEY. The old
    // /announce, /jira-act, /provision, /destroy all live here now.
    const bm = req.method === "POST" && /^\/(linode|jira|slack)\/([a-z-]+)$/.exec(req.url);
    if (bm) {
      const [, service, action] = bm;
      if (!RELAY_KEY || req.headers["x-relay-secret"] !== RELAY_KEY) { res.writeHead(403).end("forbidden"); return; }
      const id = identity(req);
      if (!id.ok) { res.writeHead(id.code).end(id.msg); return; }
      let m;
      try { m = raw ? JSON.parse(raw) : {}; } catch { res.writeHead(400).end("bad_request"); return; }
      if (service === "linode") req.setTimeout(600000); // provision/destroy are long ops
      const out =
        service === "linode" ? await brokerLinode(action, m, id.login)
        : service === "jira" ? await brokerJira(action, m, id.login)
        : await brokerSlack(action, m, id.login);
      res.writeHead(out.status, out.json ? { "Content-Type": "application/json" } : {}).end(out.body);
      return;
    }

    res.writeHead(404).end();
};

// HTTPS only, on 443. Every caller (fired sessions AND the Jira Automation
// rule) reaches a hostname over TLS with a valid Let's Encrypt cert — there is
// no plain-HTTP path, so nothing here depends on curl -k.
https
  .createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, handler)
  .listen(HTTPS_PORT, () => console.log(`HTTPS up on :${HTTPS_PORT} — plumbing (/health /reply /route /jira) + broker /<linode|jira|slack>/<action> (RELAY_KEY + GitHub identity)`));

if (app) {
  try {
    await app.start();
    console.log("PMM AI relay connected (Socket Mode)");
  } catch (e) {
    // A bad/expired Slack token must not take the whole relay down — the HTTP
    // and HTTPS listeners are already serving, so log and stay up in HTTP-only
    // mode (health/jira/route/reply keep working; Slack reactions/replies don't).
    console.error(`Slack connect failed (${e.message}) — staying in endpoints-only mode`);
  }
} else {
  console.log("PMM AI relay in endpoints-only mode (no valid Slack tokens)");
}
