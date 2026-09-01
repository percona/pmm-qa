// PMM AI relay — Slack/Jira -> Claude Code Routines (Socket Mode; no public inbound needed for Slack)
// Deps: npm i @slack/bolt   (Node >= 20)
// Deployed on the pmm-ai-relay Linode by deploy.sh (same directory); config via /opt/pmm-ai-relay/.env
import pkg from "@slack/bolt";
import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const { App } = pkg;
const execFileP = promisify(execFile);

// Slack Socket Mode can reject asynchronously on a background reconnect (e.g.
// invalid_auth) OUTSIDE the try/catch around app.start(); unguarded that becomes
// an unhandledRejection and takes the whole relay down, defeating the
// endpoints-only fallback and killing the /linode, /jira, /slack, /zephyr broker with it.
// Keep the listeners serving and just log — a broken Slack must never stop the
// HTTPS broker. (Sync bugs still crash, as they should.)
process.on("unhandledRejection", (e) => {
  console.error(`unhandledRejection (relay stays up): ${e?.stack || e?.message || e}`);
});
// The relay's own copy of the linode-runner module (cloned by deploy.sh), used
// by /linode/provision + /linode/destroy so the LINODE_TOKEN never leaves this box.
const RUNNER_DIR = process.env.RUNNER_DIR || "/opt/pmm-qa/terraform/linode-runner";
// HA/LKE counterpart: the relay runs the linode-ha-provisioning scripts with its
// own token (kubeconfig/passwords come back to the session; the LINODE_TOKEN never
// leaves this box). An LKE cluster has no on-box self-destruct timer, so the reaper
// below is its backstop — it deletes any `pmm-qa-ephemeral` cluster past the
// `expires-<epoch>` tag the create script stamps on it.
const HA_DIR = process.env.HA_DIR || "/opt/pmm-qa/.claude/skills/linode-ha-provisioning/scripts";
const LKE_RUNS_DIR = process.env.LKE_RUNS_DIR || "/opt/pmm-ai-relay/lke-runs";
const LKE_DEFAULT_TTL_H = Number(process.env.LKE_DEFAULT_TTL_HOURS || 24);
const LKE_HARD_MAX_TTL_H = Number(process.env.LKE_HARD_MAX_TTL_HOURS || 48); // reaper backstop for an untagged/half-created cluster
const LKE_REAP_INTERVAL_MS = Number(process.env.LKE_REAP_INTERVAL_MS || 15 * 60 * 1000);

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
let byGithub = Object.create(null); // lowercased github login -> person (broker roster + caller identity)
function loadPeople() {
  const s = {};
  const j = {};
  const n = {};
  const gh = Object.create(null); // no prototype: "constructor"/"__proto__" must never look like a roster entry
  let files = [];
  try {
    files = fs.readdirSync(PEOPLE_DIR).filter((f) => f.endsWith(".json"));
  } catch (e) {
    // Fail closed: a transient read/permission fault must NOT drop the roster to
    // empty, which rosterOk() treats as allow-any. Keep the last good roster and
    // reserve the empty-roster fallback for a genuinely readable-but-empty dir.
    console.error(`people dir unreadable (${PEOPLE_DIR}): ${e.message} — keeping previous roster`);
    return;
  }
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(PEOPLE_DIR, f), "utf8"));
      p.name = f.replace(/\.json$/, "");
      n[p.name] = p;
      if (p.slack) s[p.slack] = p;
      if (p.jira) j[p.jira] = p;
      if (p.github) gh[String(p.github).toLowerCase()] = p; // broker roster
    } catch (e) {
      console.error(`people: skipping bad file ${f}: ${e.message}`); // one broken file never takes the relay down
    }
  }
  bySlack = s;
  byJira = j;
  byName = n;
  byGithub = gh;
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
// `github` logins in the people files it already loads; see byGithub) and logs
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
  return Object.keys(byGithub).length === 0 || Object.hasOwn(byGithub, login.toLowerCase());
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
  // Fire the central router for anyone on the roster (a people/ file exists),
  // even with routines:{}. The router answers general questions on the central
  // account and, for a request that needs a routine the caller lacks, names the
  // one they must set up (see router.md) rather than blocking silently. Only a
  // stranger with no file is turned away; ALLOW_FALLBACK still lets one run on
  // the central owner's routines.
  let person = bySlack[event.user];
  if (!person && ALLOW_FALLBACK && byName[CENTRAL_OWNER])
    person = { ...byName[CENTRAL_OWNER], name: `${CENTRAL_OWNER} (fallback for ${event.user})` };
  if (!person) {
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
  // Only a routine with BOTH id and token is usable — /route -> fire needs the
  // token. A half-configured entry (id, no token) is not "available", so the
  // router nudges them to finish it rather than trying to fire an unusable one.
  const agents = Object.entries(person.routines || {})
    .filter(([, r]) => r && r.id && r.token)
    .map(([name]) => name);

  const payload =
    `Slack mention from ${person.name} (${event.user}) in channel ${event.channel} (thread ${threadTs}):\n` +
    `${history}Current request:\n${text}\n\n` +
    `This caller has these personal routines available: ${agents.join(", ") || "(none)"}.\n` +
    `If the request fits one of them, hand off by POSTing ${REPLY_BASE_URL}/route with JSON ` +
    `{"user":"${event.user}","channel":"${event.channel}","thread_ts":"${threadTs}",` +
    `"agent":"<one of the available routines>","instruction":"<self-contained task for that agent>",` +
    `"cap":"${routeCap}","exp":${exp}} — the work then runs on the caller's own account.\n` +
    `If the request needs a routine the caller doesn't have, or is off-topic, do NOT hand off; ` +
    `follow router.md to reply — answer a general question, or name the exact routine they must set up and send to QA. ${replyInstructions(event.channel, threadTs)}`;

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

// Path-safe id: the charset alone still admits "." and ".." — both valid path
// segments that would escape a run directory when interpolated into a filesystem
// path (write side and reaper delete side). Reject them explicitly.
const SAFE_ID = (v) => {
  v = String(v || "");
  return /^[A-Za-z0-9._-]+$/.test(v) && v !== "." && v !== ".." && !v.includes("..");
};
const readIf = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return null; } };
// Index of a top-level JQL `ORDER BY` (outside any quoted string), or -1. Used to keep
// the caller's WHERE clause and any sort clause separate when forcing `project = PMM`.
const findOrderBy = (s) => {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === "\\") { i++; continue; }
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if ((ch === "o" || ch === "O") && (i === 0 || /\s/.test(s[i - 1])) && /^order\s+by\b/i.test(s.slice(i))) {
      return i;
    }
  }
  return -1;
};

// Every per-run artifact a build can leave behind. A reclaim wipes ALL of them
// so a replacement build never serves the previous run's creds/cluster/logs.
const RUN_ARTIFACTS = ["status", "summary.env", "ip", "exec_token", "exec_cert.pem", "cluster_id", "kubeconfig.yaml", "provision.log", "pods.txt", "events.txt", "describe.txt", "expires_epoch"];
// Atomic single-flight claim for a provisioning run dir, guarded by an exclusive
// mkdir lock (mkdir is atomic) so two concurrent kickoffs for the same run_id
// can't both claim/reclaim. Inside the lock we re-read state: a run is busy if a
// build is in flight (started, no terminal status, younger than capSec);
// otherwise it's a fresh dir or a terminal/stale run, which we reclaim by wiping
// every prior artifact and recording the initiating actor. claimRun is fully
// synchronous, so the lock is always released within the same tick.
// Returns { busy:true } or { ok:true }.
function claimRun(rd, by, capSec) {
  fs.mkdirSync(rd, { recursive: true });
  try { fs.mkdirSync(`${rd}/.lock`); } catch (e) { if (e.code === "EEXIST") return { busy: true }; throw e; }
  try {
    const now = Math.floor(Date.now() / 1000);
    const started = Number(readIf(`${rd}/started`)) || 0;
    if (fs.existsSync(`${rd}/started`) && !readIf(`${rd}/status`) && now - started < capSec) return { busy: true };
    for (const f of RUN_ARTIFACTS) { try { fs.rmSync(`${rd}/${f}`, { force: true }); } catch {} }
    fs.writeFileSync(`${rd}/started`, String(now));
    fs.writeFileSync(`${rd}/actor`, String(by));
    return { ok: true };
  } finally {
    try { fs.rmSync(`${rd}/.lock`, { recursive: true, force: true }); } catch {}
  }
}
// Bind result reads to the initiating actor: a shared RELAY_KEY + a guessable
// run_id must not let another roster user read someone else's creds/kubeconfig.
// A run with no recorded owner is treated as unauthorized, never world-readable.
const ownerOk = (rd, by) => { const o = readIf(`${rd}/actor`); return o != null && o === String(by); };

async function brokerLinode(action, m, by) {
  if (!process.env.LINODE_TOKEN) return { status: 503, body: "linode_not_configured" };
  if (action === "provision") {
    const { role, run_id, ttl_hours, pmm_qa_ref } = m;
    if (!SAFE_ID(role)) return { status: 400, body: "bad_role" };
    if (!SAFE_ID(run_id)) return { status: 400, body: "bad_run_id" };
    const rd = `${RUNNER_DIR}/runs/${run_id}`;
    // Same async model as provision-lke: a VM build can brush past the ~5-min
    // connection cut, and the exec creds only come back in the final response.
    // Kick off detached, return the run_id now, poll /linode/provision-result.
    if (claimRun(rd, by, 900).busy) {
      return { status: 409, json: true, body: JSON.stringify({ run_id, status: "provisioning", hint: "already running — poll /linode/provision-result" }) };
    }
    const args = [`${RUNNER_DIR}/up.sh`, String(role), String(run_id)];
    if (ttl_hours != null && Number.isFinite(Number(ttl_hours))) args.push("-var", `ttl_hours=${Number(ttl_hours)}`);
    const env = { ...process.env, PMM_QA_REF: pmm_qa_ref ? String(pmm_qa_ref) : "main", CLAUDE_CODE_SESSION_ID: `relay:${by}`, RUN_DIR: rd };
    // Detached wrapper: cap at 12 min, tee to provision.log, write a terminal
    // status file. `ready` requires all three creds so a partial write never reads ready.
    const wrapper =
      'timeout 720 bash "$@" >>"$RUN_DIR/provision.log" 2>&1; ec=$?; ' +
      'if [ "$ec" -eq 0 ] && [ -s "$RUN_DIR/ip" ] && [ -s "$RUN_DIR/exec_token" ] && [ -s "$RUN_DIR/exec_cert.pem" ]; then echo ready >"$RUN_DIR/status"; ' +
      'else echo "failed:$ec" >"$RUN_DIR/status"; fi';
    const child = spawn("bash", ["-c", wrapper, "_", ...args], { env, detached: true, stdio: "ignore" });
    child.unref();
    console.log(`linode/provision ${role} ${run_id} started (ttl=${ttl_hours ?? 24}) by ${by}`);
    return { status: 202, json: true, body: JSON.stringify({ run_id, status: "provisioning", poll: "/linode/provision-result" }) };
  }
  if (action === "provision-result") {
    const { run_id } = m;
    if (!SAFE_ID(run_id)) return { status: 400, body: "bad_run_id" };
    const rd = `${RUNNER_DIR}/runs/${run_id}`;
    if (!fs.existsSync(rd)) return { status: 404, body: "unknown_run" };
    if (!ownerOk(rd, by)) return { status: 403, body: "not_your_run" };
    const status = readIf(`${rd}/status`);
    if (status === "ready") {
      const ip = readIf(`${rd}/ip`);
      const exec_token = readIf(`${rd}/exec_token`);
      const exec_cert_pem = fs.existsSync(`${rd}/exec_cert.pem`) ? fs.readFileSync(`${rd}/exec_cert.pem`, "utf8") : null;
      return { status: 200, json: true, body: JSON.stringify({ run_id, status: "ready", ip, exec_token, exec_cert_pem }) };
    }
    if (status && status.startsWith("failed")) {
      const tail = (readIf(`${rd}/provision.log`) || "").slice(-1500);
      return { status: 502, json: true, body: JSON.stringify({ run_id, status, error: "provision_failed", detail: tail }) };
    }
    return { status: 202, json: true, body: JSON.stringify({ run_id, status: "provisioning" }) };
  }
  if (action === "destroy") {
    const { run_id } = m;
    if (!SAFE_ID(run_id)) return { status: 400, body: "bad_run_id" };
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
  // HA path: stand up a throwaway LKE cluster with PMM in HA mode (Helm). Same
  // token-on-the-relay model as the VM path; returns the kubeconfig + LB IP +
  // generated passwords the session needs. The cluster is tagged with its expiry
  // so the reaper reaps it even if teardown is never called.
  if (action === "provision-lke") {
    const { run_id, ttl_hours } = m;
    if (!SAFE_ID(run_id)) return { status: 400, body: "bad_run_id" };
    const ttlH = ttl_hours != null && Number.isFinite(Number(ttl_hours)) && Number(ttl_hours) > 0 ? Number(ttl_hours) : LKE_DEFAULT_TTL_H;
    const expiresEpoch = Math.floor(Date.now() / 1000) + Math.round(ttlH * 3600);
    const runDir = `${LKE_RUNS_DIR}/${run_id}`;
    // An LKE HA build takes 10–20 min, but the kubeconfig only comes back in the
    // final response and a silent long-held connection gets cut by intermediaries
    // at ~5 min. So provisioning is ASYNC: kick off a detached build, return the
    // run_id immediately, and let the caller poll /linode/lke-result. A dropped
    // connection is then fully recoverable — all state lives in runDir on this box.
    if (claimRun(runDir, by, 3300).busy) {
      return { status: 409, json: true, body: JSON.stringify({ run_id, status: "provisioning", hint: "already running — poll /linode/lke-result" }) };
    }
    // Optional passthrough config — light validation, then handed to the script as env vars.
    const cfg = {};
    const pass = (k, envk, re) => { const v = m[k]; if (v != null && (!re || re.test(String(v)))) cfg[envk] = String(v); };
    pass("region", "REGION", /^[a-z0-9-]+$/);
    pass("node_type", "NODE_TYPE", /^[a-z0-9-]+$/);
    pass("node_count", "NODE_COUNT", /^[0-9]+$/);
    pass("k8s_version", "K8S_VERSION", /^[0-9.]+$/);
    pass("namespace", "NAMESPACE", /^[a-z0-9-]+$/);
    pass("chart_version", "CHART_VERSION", /^[A-Za-z0-9._-]+$/);
    pass("pmm_chart", "PMM_CHART");
    pass("deps_chart", "DEPS_CHART");
    pass("pmm_set", "PMM_SET");
    pass("deps_set", "DEPS_SET");
    // FB custom values files arrive base64-encoded and are written into the run dir.
    for (const [key, fname, envk] of [["pmm_values_b64", "pmm-values.yaml", "PMM_VALUES"], ["deps_values_b64", "deps-values.yaml", "DEPS_VALUES"]]) {
      if (m[key]) { const p = `${runDir}/${fname}`; fs.writeFileSync(p, Buffer.from(String(m[key]), "base64")); cfg[envk] = p; }
    }
    const env = { ...process.env, LINODE_CLI_TOKEN: process.env.LINODE_TOKEN, RUN_ID: String(run_id), RUN_DIR: runDir, TTL_HOURS: String(ttlH), EXPIRES_EPOCH: String(expiresEpoch), CLAUDE_CODE_SESSION_ID: `relay:${by}`, ...cfg };
    fs.writeFileSync(`${runDir}/expires_epoch`, String(expiresEpoch));
    // Detached wrapper: cap the build at 50 min, tee to provision.log, and write a
    // terminal `status` file (ready | failed:<code>) the poller reads. `ready`
    // requires BOTH result artifacts so a partial run never reads ready. unref()
    // so the build outlives both this request and a relay restart.
    const wrapper =
      'timeout 3000 bash "$0" >>"$RUN_DIR/provision.log" 2>&1; ec=$?; ' +
      'if [ "$ec" -eq 0 ] && [ -s "$RUN_DIR/summary.env" ] && [ -s "$RUN_DIR/kubeconfig.yaml" ]; then echo ready >"$RUN_DIR/status"; ' +
      'else echo "failed:$ec" >"$RUN_DIR/status"; fi';
    const child = spawn("bash", ["-c", wrapper, `${HA_DIR}/create-lke-pmm-ha.sh`], { env, detached: true, stdio: "ignore" });
    child.unref();
    console.log(`linode/provision-lke ${run_id} started (ttl=${ttlH}h, expires=${expiresEpoch}) by ${by}`);
    return { status: 202, json: true, body: JSON.stringify({ run_id, status: "provisioning", expires_epoch: expiresEpoch, ttl_hours: ttlH, poll: "/linode/lke-result" }) };
  }
  if (action === "lke-result") {
    const { run_id } = m;
    if (!SAFE_ID(run_id)) return { status: 400, body: "bad_run_id" };
    const runDir = `${LKE_RUNS_DIR}/${run_id}`;
    if (!fs.existsSync(runDir)) return { status: 404, body: "unknown_run" };
    if (!ownerOk(runDir, by)) return { status: 403, body: "not_your_run" };
    const status = readIf(`${runDir}/status`);
    const cluster_id = readIf(`${runDir}/cluster_id`);
    const expiresEpoch = Number(readIf(`${runDir}/expires_epoch`)) || null;
    if (status === "ready" && fs.existsSync(`${runDir}/summary.env`)) {
      const summary = {};
      for (const line of fs.readFileSync(`${runDir}/summary.env`, "utf8").split("\n")) { const i = line.indexOf("="); if (i > 0) summary[line.slice(0, i)] = line.slice(i + 1).trim(); }
      const kubeconfig_b64 = fs.readFileSync(`${runDir}/kubeconfig.yaml`).toString("base64");
      const pods = readIf(`${runDir}/pods.txt`); // HA pod snapshot the create script captured (kubectl runs on the relay, not the caller)
      return { status: 200, json: true, body: JSON.stringify({ run_id, status: "ready", cluster_id, expires_epoch: expiresEpoch, external_ip: summary.external_ip, url: summary.url, kubeconfig_b64, passwords: summary, pods }) };
    }
    if (status && status.startsWith("failed")) {
      const tail = (readIf(`${runDir}/provision.log`) || "").slice(-2000);
      const pods = readIf(`${runDir}/pods.txt`); // diagnostics the create script captures on exit
      const describe = (readIf(`${runDir}/describe.txt`) || "").slice(-6000);
      return { status: 502, json: true, body: JSON.stringify({ run_id, status, cluster_id, error: "provision_lke_failed", detail: tail, pods, describe }) };
    }
    // still building — surface a coarse phase so the caller can log progress
    return { status: 202, json: true, body: JSON.stringify({ run_id, status: "provisioning", phase: cluster_id ? "installing" : "creating-cluster", cluster_id, expires_epoch: expiresEpoch }) };
  }
  if (action === "destroy-lke") {
    const { run_id, cluster_id } = m;
    let arg;
    if (cluster_id != null) {
      if (!/^[0-9]+$/.test(String(cluster_id))) return { status: 400, body: "bad_cluster_id" };
      arg = String(cluster_id);
    } else {
      if (!SAFE_ID(run_id)) return { status: 400, body: "bad_run_id" };
      try { arg = fs.readFileSync(`${LKE_RUNS_DIR}/${run_id}/cluster_id`, "utf8").trim(); } catch {}
      if (!arg) return { status: 404, body: "unknown_run" };
    }
    console.log(`linode/destroy-lke ${arg} by ${by}`);
    try {
      await execFileP("bash", [`${HA_DIR}/destroy-lke.sh`, arg], { env: { ...process.env, LINODE_CLI_TOKEN: process.env.LINODE_TOKEN }, timeout: 240000, maxBuffer: 10 * 1024 * 1024 });
      return { status: 200, body: "ok" };
    } catch (e) {
      const tail = String(e.stderr || e.stdout || e.message || "").slice(-1500);
      console.error(`linode/destroy-lke failed: ${e.message}\n${tail}`);
      return { status: 502, json: true, body: JSON.stringify({ error: "destroy_lke_failed", detail: tail }) };
    }
  }
  return { status: 400, body: "unknown_action" };
}

// LKE reaper — the LKE equivalent of the VM's on-box self-destruct timer. Lists
// ephemeral clusters straight from the Linode API (so it survives relay restarts
// and lost run state) and deletes any whose `expires-<epoch>` tag is in the past;
// a cluster with no parseable expiry (a half-created run) falls back to
// created + LKE_HARD_MAX_TTL_H. Never touches a cluster without the
// `pmm-qa-ephemeral` tag. API-only: independent of linode-cli being configured.
async function linodeApi(pathname, init = {}) {
  return fetch(`https://api.linode.com/v4${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.LINODE_TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}
async function reapLke() {
  if (!process.env.LINODE_TOKEN) return;
  const nowS = Math.floor(Date.now() / 1000);
  const hardMax = LKE_HARD_MAX_TTL_H * 3600;
  try {
    let page = 1, pages = 1, checked = 0, reaped = 0;
    do {
      const r = await linodeApi(`/lke/clusters?page=${page}&page_size=100`);
      if (!r.ok) { console.error(`lke-reaper: list page ${page} -> ${r.status} ${await r.text()}`); return; }
      const j = await r.json();
      pages = j.pages || 1;
      for (const c of j.data || []) {
        const tags = c.tags || [];
        if (!tags.includes("pmm-qa-ephemeral")) continue; // only our throwaway clusters, ever
        checked++;
        let expiry = null;
        for (const t of tags) { const mm = /^expires-(\d+)$/.exec(t); if (mm) { expiry = Number(mm[1]); break; } }
        if (expiry == null) { const created = Date.parse(c.created || "") / 1000; expiry = Number.isFinite(created) ? created + hardMax : 0; }
        if (nowS > expiry) {
          const del = await linodeApi(`/lke/clusters/${c.id}`, { method: "DELETE" });
          console.log(`lke-reaper: deleted cluster ${c.id} "${c.label}" (expiry ${expiry} < now ${nowS}) -> ${del.status}`);
          if (del.ok) {
            reaped++;
            // Delete this cluster's unique account-level tags (Linode leaves them
            // behind on cluster delete, so they pile up). Only the per-cluster
            // ones -- never the shared pmm-qa-ephemeral / pmm-qa-role:* tags.
            for (const t of tags) {
              if (!/^(expires-\d+|pmm-qa-run:)/.test(t)) continue;
              try {
                const dt = await linodeApi(`/tags/${encodeURIComponent(t)}`, { method: "DELETE" });
                if (!dt.ok && dt.status !== 404) console.error(`lke-reaper: delete tag "${t}" -> ${dt.status}`);
              } catch (e) { console.error(`lke-reaper: delete tag "${t}" failed: ${e.message}`); }
            }
            // Derive the run dir from the (Linode-controlled) label, but never let it
            // escape LKE_RUNS_DIR before an rmSync(recursive).
            try {
              const base = path.resolve(LKE_RUNS_DIR);
              const target = path.resolve(base, c.label.replace(/^pmm-ha-/, ""));
              if (target.startsWith(base + path.sep)) fs.rmSync(target, { recursive: true, force: true });
            } catch {}
          }
        }
      }
      page++;
    } while (page <= pages);
    if (checked) console.log(`lke-reaper: checked ${checked} ephemeral cluster(s), reaped ${reaped}`);
  } catch (e) {
    console.error(`lke-reaper error (relay stays up): ${e.message}`);
  }
}
setInterval(reapLke, LKE_REAP_INTERVAL_MS).unref();
setTimeout(reapLke, 60_000).unref(); // first sweep shortly after boot

async function brokerJira(action, m, by) {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) return { status: 503, body: "jira_not_configured" };
  const issue = m.issue;
  // Every action except create/search operates on an existing PMM issue.
  if (action !== "create" && action !== "search" && !/^PMM-\d+$/.test(issue || "")) return { status: 400, body: "issue_must_be_a_PMM_key" };
  const base = "https://perconadev.atlassian.net/rest/api/2";
  const auth = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const JIRA_TIMEOUT_MS = 30_000; // bound every Jira call so a hung upstream can't wedge the handler
  const jira = (path, init = {}) =>
    fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(JIRA_TIMEOUT_MS), headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) } });
  console.log(`jira/${action} ${issue || m.summary || m.jql || ""} by ${by}`);
  let r;
  try {
    if (action === "create") {
      // Create a PMM issue — Investigator files auto-detected bugs here. Project is
      // FORCED to PMM; caller provides issuetype + summary (required) and optional
      // description / extra fields. "Found by Automation" (customfield_10059)
      // defaults to Yes on Bugs — every relay-brokered create is automation-
      // originated — unless the caller sets customfield_10059 explicitly.
      const fields = { ...(m.fields || {}), project: { key: "PMM" } };
      if (m.summary) fields.summary = String(m.summary);
      if (m.description) fields.description = String(m.description);
      if (m.issuetype) fields.issuetype = { name: String(m.issuetype) };
      if (!fields.summary || !fields.issuetype?.name) return { status: 400, body: "summary_and_issuetype_required" };
      if (fields.issuetype.name === "Bug" && fields.customfield_10059 === undefined) fields.customfield_10059 = [{ value: "Yes" }];
      r = await jira(`/issue`, { method: "POST", body: JSON.stringify({ fields }) });
    } else if (action === "search") {
      // JQL search, FORCED to the PMM project — lets callers (e.g. Investigator
      // dedup) find existing tickets through the relay's service account instead
      // of an interactively-authenticated MCP. Read-only, PMM-only. Uses the
      // enhanced /search/jql endpoint (classic /search is sunset on Jira Cloud).
      const raw = String(m.jql || "").trim();
      // Find ORDER BY only OUTSIDE quoted strings, so a value like `summary ~ "order by"`
      // stays in the WHERE clause instead of being split as a sort clause. JQL quotes with
      // ' or " and escapes with a backslash.
      const oi = findOrderBy(raw);
      const where = oi >= 0 ? raw.slice(0, oi).trim() : raw;
      const order = oi >= 0 ? raw.slice(oi) : "";
      const jql = `project = PMM${where ? ` AND (${where})` : ""}${order ? ` ${order}` : ""}`;
      const maxResults = Math.min(Math.max(Math.floor(Number(m.maxResults) || 20), 1), 100);
      const fields = (Array.isArray(m.fields) ? m.fields
        : String(m.fields || "summary,status,issuetype,updated").split(","))
        .map((s) => String(s).trim()).filter(Boolean);
      r = await jira(`/search/jql`, { method: "POST", body: JSON.stringify({ jql, maxResults, fields }) });
    } else if (action === "read") {
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
      r = await fetch(`${base}/issue/${issue}/attachments`, { method: "POST", signal: AbortSignal.timeout(JIRA_TIMEOUT_MS), headers: { Authorization: auth, "X-Atlassian-Token": "no-check" }, body: fd });
    } else {
      return { status: 400, body: "unknown_action" };
    }
    return { status: r.status, json: true, body: (await r.text()) || "{}" };
  } catch (e) {
    console.error(`jira/${action} failed: ${e.message}`);
    return { status: 502, body: "jira_upstream_error" };
  }
}

// Zephyr Scale (SmartBear) test-case management. Project is FORCED to PMM.
// Read, create, status and steps — no free-form edit, no delete (the API has
// none: a case is retired by moving it to Deprecated), and no execution
// reporting (CI's own reporter posts executions with the same key from GitHub
// Actions; see codeceptjs-e2e/tests/helper/reporter_helper.js).
const ZEPHYR_BASE = "https://api.zephyrscale.smartbear.com/v2";
const ZEPHYR_TIMEOUT_MS = 30_000;
const ZEPHYR_SCAN_PAGES = 20; // search pages 1000 at a time; caps a runaway scan
const ZEPHYR_SCAN_BUDGET_MS = 150_000; // per-page timeouts are independent, so bound the whole scan inside the handler's own 180s
const TESTCASE_KEY = /^PMM-T[0-9]+$/;
const ZEPHYR_REQUIRED_CF = "Version of the Product"; // required on every test case in the PMM project
const PUT_ONLY_STRIP = ["createdOn", "links", "testScript"]; // read-only on GET, rejected by the update endpoint
const MAX_STEPS = 100; // per the API's own cap
// pmm-qa test titles are "PMM-Txxxx [+ PMM-Tyyyy] - description @tag @tag", so a
// caller pasting a whole title still searches on the description alone (Zephyr
// names carry neither the key nor the CodeceptJS/Playwright tags).
const titleToQuery = (s) =>
  String(s)
    .replace(/^\s*PMM-T[0-9]+(\s*\+\s*PMM-T[0-9]+)*\s*-\s*/, "")
    .replace(/(\s+@[\w-]+)+\s*$/, "")
    .trim();

// Zephyr returns every reference — status, priority, folder, steps, linked Jira
// issues — as a bare id or a URL, so a caller holding a test case cannot name any
// of them. `get` resolves them from these tables, which are a few dozen rows and
// change almost never, so they are cached rather than re-read per call.
const ZEPHYR_LOOKUP_TTL_MS = 600_000;
let zephyrLookups = { at: 0 };

async function zephyrLookupTables(z) {
  if (zephyrLookups.at && Date.now() - zephyrLookups.at < ZEPHYR_LOOKUP_TTL_MS) return zephyrLookups;
  const [st, pr, fo] = await Promise.all([
    z(`/statuses?projectKey=PMM&statusType=TEST_CASE&maxResults=100`),
    z(`/priorities?projectKey=PMM&maxResults=100`),
    z(`/folders?projectKey=PMM&folderType=TEST_CASE&maxResults=1000`),
  ]);
  if (!st.ok || !pr.ok || !fo.ok) throw new Error(`zephyr_lookup_failed statuses=${st.status} priorities=${pr.status} folders=${fo.status}`);
  const [sj, pj, fj] = await Promise.all([st.json(), pr.json(), fo.json()]);
  const named = (vs) => new Map((vs || []).map((v) => [v.id, v.name]));
  zephyrLookups = {
    at: Date.now(),
    statuses: named(sj.values),
    priorities: named(pj.values),
    folders: new Map((fj.values || []).map((f) => [f.id, { name: f.name, parentId: f.parentId ?? null }])),
  };
  return zephyrLookups;
}

// "PMM3.x HA Tests / Failover". The guard bounds a parentId cycle.
function zephyrFolderPath(folders, id) {
  const parts = [];
  for (let cur = id, depth = 0; cur != null && depth < 20; depth++) {
    const f = folders.get(cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return parts.join(" / ") || null;
}

// Every folder at or below `root`, so a listing covers a feature's whole subtree.
function zephyrSubtree(folders, root) {
  const ids = new Set([root]);
  for (const [id, f] of folders) {
    for (let p = f.parentId, depth = 0; p != null && depth < 20; depth++) {
      if (p === root) {
        ids.add(id);
        break;
      }
      p = folders.get(p)?.parentId ?? null;
    }
  }
  return ids;
}

// A step is either inline or a call to another case. Values stay as Zephyr stores
// them (HTML) — a broker should not lossily rewrite what it relays.
function zephyrFlattenSteps(script) {
  return (script?.values || []).map((s, i) =>
    s.testCase
      ? { index: i + 1, callsTestCase: s.testCase.testCaseKey ?? s.testCase.self ?? null }
      : {
          index: i + 1,
          description: s.inline?.description ?? null,
          testData: s.inline?.testData ?? null,
          expectedResult: s.inline?.expectedResult ?? null,
        },
  );
}

// Zephyr links coverage by numeric Jira id, so a caller sees 174296 and not
// PMM-14744. Resolved through the same service account the /jira broker uses.
async function zephyrJiraIssues(issueIds) {
  if (!issueIds.length || !JIRA_EMAIL || !JIRA_API_TOKEN) return [];
  const auth = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  const r = await fetch("https://perconadev.atlassian.net/rest/api/2/search/jql", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      jql: `project = PMM AND id in (${issueIds.join(",")})`,
      maxResults: Math.min(issueIds.length, 100),
      fields: ["key", "summary", "status", "issuetype"],
    }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.issues || []).map((i) => ({
    id: Number(i.id),
    key: i.key,
    summary: i.fields?.summary ?? null,
    status: i.fields?.status?.name ?? null,
    issuetype: i.fields?.issuetype?.name ?? null,
  }));
}

async function brokerZephyr(action, m, by) {
  if (!process.env.ZEPHYR_PMM_API_KEY) return { status: 503, body: "zephyr_not_configured" };
  const z = (p, init = {}) =>
    fetch(`${ZEPHYR_BASE}${p}`, {
      ...init,
      signal: AbortSignal.timeout(ZEPHYR_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${process.env.ZEPHYR_PMM_API_KEY}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) },
    });
  console.log(`zephyr/${action} ${m.key || m.name || m.query || ""} by ${by}`);
  try {
    if (action === "create") {
      const name = String(m.name || "").trim();
      if (!name || name.length > 255) return { status: 400, body: "name_required_1_255_chars" };
      // The key is assigned BY Zephyr; a name carrying one means the caller
      // pasted a test title and would create a test case named after another.
      if (/^PMM-T[0-9]+/.test(name)) return { status: 400, body: "name_must_not_start_with_a_test_case_key" };
      const body = { ...(m.fields || {}), projectKey: "PMM", name };
      for (const k of ["objective", "precondition", "priorityName", "statusName"]) if (m[k] != null) body[k] = String(m[k]);
      // Owner is the caller, never the caller's choice: X-Actor is already
      // roster-checked, so map that login to the person's Jira accountId. A case
      // with no owner has nobody to chase, so an unmappable caller is refused.
      const owner = byGithub[by.toLowerCase()]?.jira;
      if (!owner || !/^[-:a-zA-Z0-9]{1,128}$/.test(owner)) return { status: 403, body: "owner_unresolved_add_jira_id_to_your_people_file" };
      body.ownerId = owner;
      if (m.folderId != null) {
        if (!/^[0-9]+$/.test(String(m.folderId))) return { status: 400, body: "bad_folder_id" };
        body.folderId = Number(m.folderId);
      }
      if (Array.isArray(m.labels)) body.labels = m.labels.map(String);
      // The PMM project marks one custom field required, and Zephyr rejects the
      // create outright without it — surface that here instead of as a raw 400.
      const cf = m.customFields && typeof m.customFields === "object" ? { ...m.customFields } : {};
      if (!String(cf[ZEPHYR_REQUIRED_CF] ?? "").trim()) return { status: 400, body: "version_of_the_product_required" };
      body.customFields = cf;
      const r = await z("/testcases", { method: "POST", body: JSON.stringify(body) });
      return { status: r.status, json: true, body: (await r.text()) || "{}" };
    }
    if (action === "get") {
      const key = String(m.key || "").trim();
      if (!TESTCASE_KEY.test(key)) return { status: 400, body: "key_must_be_a_PMM-T_key" };
      const r = await z(`/testcases/${key}`);
      if (!r.ok) return { status: r.status, json: true, body: (await r.text()) || "{}" };
      const tc = await r.json();
      const wantSteps = m.steps !== false;
      const wantJira = m.jira !== false;
      // Additive: the verbatim test case plus `resolved`, which names what Zephyr
      // returns as ids. Enrichment must never cost the caller the raw read, so a
      // failing lookup degrades to resolved.error instead of failing the call.
      try {
        const [tables, script, issues] = await Promise.all([
          zephyrLookupTables(z),
          wantSteps ? z(`/testcases/${key}/teststeps?maxResults=${MAX_STEPS}`).then((s) => (s.ok ? s.json() : null)) : null,
          wantJira ? zephyrJiraIssues((tc.links?.issues || []).map((i) => i.issueId).filter(Boolean)) : [],
        ]);
        tc.resolved = {
          status: tables.statuses.get(tc.status?.id) ?? null,
          priority: tables.priorities.get(tc.priority?.id) ?? null,
          folder: tc.folder?.id != null ? zephyrFolderPath(tables.folders, tc.folder.id) : null,
          ...(wantSteps ? { steps: zephyrFlattenSteps(script) } : {}),
          ...(wantJira ? { jiraIssues: issues } : {}),
        };
      } catch (e) {
        tc.resolved = { error: e.message };
      }
      return { status: 200, json: true, body: JSON.stringify(tc) };
    }
    if (action === "list") {
      // Every case in a folder, no query needed — `search` cannot answer "what is
      // in this folder" because it requires a query, so callers were reduced to
      // searching a common letter and reading `scanned`.
      if (m.folderId != null && !/^[0-9]+$/.test(String(m.folderId))) return { status: 400, body: "bad_folder_id" };
      const limit = Math.min(Math.max(Math.floor(Number(m.limit) || 200), 1), 1000);
      const tables = await zephyrLookupTables(z);
      let wanted = null;
      if (m.folderId != null) {
        const root = Number(m.folderId);
        if (!tables.folders.has(root)) return { status: 400, body: "bad_folder_id" };
        wanted = m.recursive === false ? new Set([root]) : zephyrSubtree(tables.folders, root);
      }
      // One folder is filtered upstream (a single short page); a subtree or the
      // whole project is a paged scan filtered here, which costs fewer round
      // trips than one call per folder.
      const upstreamFolder = wanted && wanted.size === 1 ? `&folderId=${[...wanted][0]}` : "";
      const cases = [];
      let startAtId = 0;
      let scanned = 0;
      let pages = 0;
      let truncated = false;
      const scanStarted = Date.now();
      for (;;) {
        const r = await z(`/testcases/nextgen?projectKey=PMM&limit=1000&startAtId=${startAtId}${upstreamFolder}`);
        if (!r.ok) return { status: r.status, json: true, body: (await r.text()) || "{}" };
        const j = await r.json();
        for (const tc of j.values || []) {
          scanned++;
          const folderId = tc.folder?.id ?? null;
          if (wanted && !upstreamFolder && !wanted.has(folderId)) continue;
          cases.push({
            key: tc.key,
            name: String(tc.name || ""),
            status: tables.statuses.get(tc.status?.id) ?? null,
            priority: tables.priorities.get(tc.priority?.id) ?? null,
            folderId,
            folder: folderId != null ? zephyrFolderPath(tables.folders, folderId) : null,
          });
        }
        pages++;
        if (j.nextStartAtId == null) break;
        if (pages >= ZEPHYR_SCAN_PAGES || Date.now() - scanStarted > ZEPHYR_SCAN_BUDGET_MS) {
          truncated = true;
          break;
        }
        startAtId = j.nextStartAtId;
      }
      cases.sort((a, b) => Number(a.key.slice(6)) - Number(b.key.slice(6)));
      return {
        status: 200,
        json: true,
        body: JSON.stringify({
          folderId: m.folderId != null ? Number(m.folderId) : null,
          recursive: wanted ? wanted.size > 1 : null,
          folders: wanted ? [...wanted] : null,
          total: cases.length,
          scanned,
          truncated,
          cases: cases.slice(0, limit),
        }),
      };
    }
    if (action === "statuses") {
      const t = await zephyrLookupTables(z);
      return {
        status: 200,
        json: true,
        body: JSON.stringify({
          statuses: [...t.statuses].map(([id, name]) => ({ id, name })),
          priorities: [...t.priorities].map(([id, name]) => ({ id, name })),
        }),
      };
    }
    if (action === "search") {
      // Zephyr v2 has NO name search, so the relay pages the project and matches
      // here: a name containing the whole query scores highest, else one covering
      // >=60% of its words. Ranked and capped — the caller judges the duplicate.
      const query = titleToQuery(m.query || "");
      if (!query) return { status: 400, body: "query_required" };
      const needle = query.toLowerCase();
      const words = [...new Set(needle.split(/[^a-z0-9]+/).filter((w) => w.length > 2))];
      const need = Math.max(1, Math.ceil(words.length * 0.6));
      const limit = Math.min(Math.max(Math.floor(Number(m.limit) || 20), 1), 100);
      let folder = "";
      if (m.folderId != null) {
        if (!/^[0-9]+$/.test(String(m.folderId))) return { status: 400, body: "bad_folder_id" };
        folder = `&folderId=${Number(m.folderId)}`;
      }
      const matches = [];
      let startAtId = 0;
      let scanned = 0;
      let pages = 0;
      let truncated = false;
      const scanStarted = Date.now();
      for (;;) {
        const r = await z(`/testcases/nextgen?projectKey=PMM&limit=1000&startAtId=${startAtId}${folder}`);
        if (!r.ok) return { status: r.status, json: true, body: (await r.text()) || "{}" };
        const j = await r.json();
        for (const tc of j.values || []) {
          scanned++;
          const name = String(tc.name || "");
          const low = name.toLowerCase();
          const score = low.includes(needle) ? words.length + 1 : words.filter((w) => low.includes(w)).length;
          if (score >= need) matches.push({ key: tc.key, name, score, folderId: tc.folder?.id ?? null });
        }
        pages++;
        if (j.nextStartAtId == null) break;
        if (pages >= ZEPHYR_SCAN_PAGES || Date.now() - scanStarted > ZEPHYR_SCAN_BUDGET_MS) {
          truncated = true;
          break;
        }
        startAtId = j.nextStartAtId;
      }
      matches.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
      return { status: 200, json: true, body: JSON.stringify({ query, scanned, truncated, matches: matches.slice(0, limit) }) };
    }
    if (action === "folders") {
      const r = await z(`/folders?projectKey=PMM&folderType=TEST_CASE&maxResults=1000`);
      if (!r.ok) return { status: r.status, json: true, body: (await r.text()) || "{}" };
      const j = await r.json();
      return {
        status: 200,
        json: true,
        body: JSON.stringify({ folders: (j.values || []).map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })), total: j.total ?? null, isLast: j.isLast ?? null }),
      };
    }
    if (action === "set-status") {
      const key = String(m.key || "").trim();
      if (!TESTCASE_KEY.test(key)) return { status: 400, body: "key_must_be_a_PMM-T_key" };
      if (!m.status) return { status: 400, body: "status_required" };
      const sr = await z(`/statuses?projectKey=PMM&statusType=TEST_CASE&maxResults=100`);
      if (!sr.ok) return { status: sr.status, json: true, body: (await sr.text()) || "{}" };
      const statuses = (await sr.json()).values || [];
      const want = statuses.find((x) => x.name.toLowerCase() === String(m.status).toLowerCase());
      if (!want) return { status: 400, json: true, body: JSON.stringify({ error: "unknown_status", allowed: statuses.map((x) => x.name) }) };
      // The update endpoint CLEARS every field the body omits, so a status change
      // is a read-modify-write of the whole test case, never a partial PUT. Not
      // atomic: a concurrent edit between the GET and the PUT would be lost.
      const g = await z(`/testcases/${key}`);
      if (!g.ok) return { status: g.status, json: true, body: (await g.text()) || "{}" };
      const tc = await g.json();
      for (const f of PUT_ONLY_STRIP) delete tc[f];
      const from = tc.status?.id ?? null;
      tc.status = { id: want.id };
      const put = await z(`/testcases/${key}`, { method: "PUT", body: JSON.stringify(tc) });
      if (!put.ok) return { status: put.status, json: true, body: (await put.text()) || "{}" };
      return { status: 200, json: true, body: JSON.stringify({ key, status: want.name, statusId: want.id, previousStatusId: from }) };
    }
    if (action === "steps") {
      const key = String(m.key || "").trim();
      if (!TESTCASE_KEY.test(key)) return { status: 400, body: "key_must_be_a_PMM-T_key" };
      if (!Array.isArray(m.steps) || !m.steps.length) return { status: 400, body: "steps_required" };
      if (m.steps.length > MAX_STEPS) return { status: 400, body: "too_many_steps" };
      const items = m.steps.map((st) =>
        st.testCaseKey
          ? { testCase: { testCaseKey: String(st.testCaseKey) } }
          : {
              inline: {
                description: String(st.description ?? ""),
                testData: st.testData != null ? String(st.testData) : null,
                expectedResult: st.expectedResult != null ? String(st.expectedResult) : null,
              },
            },
      );
      // OVERWRITE by default: a freshly created test case already carries one
      // empty step, which APPEND would leave stranded at the top.
      const r = await z(`/testcases/${key}/teststeps`, { method: "POST", body: JSON.stringify({ mode: m.mode === "APPEND" ? "APPEND" : "OVERWRITE", items }) });
      return { status: r.status, json: true, body: (await r.text()) || "{}" };
    }
    return { status: 400, body: "unknown_action" };
  } catch (e) {
    console.error(`zephyr/${action} failed: ${e.message}`);
    return { status: 502, body: "zephyr_upstream_error" };
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
    const bm = req.method === "POST" && /^\/(linode|jira|slack|zephyr)\/([a-z-]+)$/.exec(req.url);
    if (bm) {
      const [, service, action] = bm;
      if (!RELAY_KEY || req.headers["x-relay-secret"] !== RELAY_KEY) { res.writeHead(403).end("forbidden"); return; }
      const id = identity(req);
      if (!id.ok) { res.writeHead(id.code).end(id.msg); return; }
      let m;
      try { m = raw ? JSON.parse(raw) : {}; } catch { res.writeHead(400).end("bad_request"); return; }
      if (service === "linode") req.setTimeout(action.endsWith("-lke") ? 1_800_000 : 600000); // LKE (cluster + Helm) runs far longer than a VM
      if (service === "zephyr") req.setTimeout(180_000); // search pages the whole PMM project
      const out =
        service === "linode" ? await brokerLinode(action, m, id.login)
        : service === "jira" ? await brokerJira(action, m, id.login)
        : service === "zephyr" ? await brokerZephyr(action, m, id.login)
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
  .listen(HTTPS_PORT, () => console.log(`HTTPS up on :${HTTPS_PORT} — plumbing (/health /reply /route /jira) + broker /<linode|jira|slack|zephyr>/<action> (RELAY_KEY + GitHub identity)`));

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
