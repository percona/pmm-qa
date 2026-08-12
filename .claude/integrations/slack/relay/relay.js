// PMM AI relay — Slack/Jira -> Claude Code Routines (Socket Mode; no public inbound needed for Slack)
// Deps: npm i @slack/bolt   (Node >= 20)
// Deployed on the pmm-ai-relay Linode by deploy.sh (same directory); config via /opt/pmm-ai-relay/.env
import pkg from "@slack/bolt";
import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const { App } = pkg;

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
function loadPeople() {
  const s = {};
  const j = {};
  const n = {};
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
    } catch (e) {
      console.error(`people: skipping bad file ${f}: ${e.message}`); // one broken file never takes the relay down
    }
  }
  bySlack = s;
  byJira = j;
  byName = n;
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
const ANNOUNCE_SECRET = process.env.ANNOUNCE_SECRET; // gates POST /announce (proactive channel posts, e.g. the PR digest)
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

    // Bot posts a FRESH top-level message to a channel (starts a new thread) —
    // the general path for any proactive post, e.g. the PR Maintainer digest.
    // Distinct from /reply, which needs an HMAC cap bound to an EXISTING thread;
    // this has no thread to bind to, so it's a plain secret-gated bearer call.
    // The bot can still only reach channels it was invited to.
    if (req.method === "POST" && req.url === "/announce") {
      if (!ANNOUNCE_SECRET || req.headers["x-relay-secret"] !== ANNOUNCE_SECRET) {
        console.error("/announce rejected: bad secret");
        res.writeHead(403).end("forbidden");
        return;
      }
      let channel, text;
      try {
        ({ channel, text } = JSON.parse(raw));
      } catch {
        res.writeHead(400).end("bad_request");
        return;
      }
      if (!channel || !text) {
        res.writeHead(400).end("channel_and_text_required");
        return;
      }
      try {
        if (app) await app.client.chat.postMessage({ channel, text });
        else console.log(`DEGRADED /announce to ${channel}: ${text}`);
        res.writeHead(200).end("ok");
      } catch (e) {
        console.error(`/announce failed: ${e?.data?.error || e.message}`);
        res.writeHead(502).end("post_failed");
      }
      return;
    }

    res.writeHead(404).end();
};

// HTTPS only, on 443. Every caller (fired sessions AND the Jira Automation
// rule) reaches a hostname over TLS with a valid Let's Encrypt cert — there is
// no plain-HTTP path, so nothing here depends on curl -k.
https
  .createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, handler)
  .listen(HTTPS_PORT, () => console.log(`HTTPS endpoints (/health /reply /route /jira /announce) on :${HTTPS_PORT}`));

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
