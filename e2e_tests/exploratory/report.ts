import fs from 'node:fs';

export interface StepRecord {
  n: number;
  url: string;
  title: string;
  shot: string;
  broken: number;
  deadEnd: number;
  action: string;
  confidence: number;
  source: 'jev' | 'fallback';
  latencyMs: number;
  flagged: boolean;
}

const bar = (v: number) =>
  `<span class="bar"><i style="width:${Math.round(v * 100)}%;background:${v > 0.9 ? 'var(--bad)' : v > 0.5 ? 'var(--warn)' : 'var(--ok)'}"></i></span><b>${v.toFixed(2)}</b>`;

export const writeFilmstrip = (dir: string, steps: StepRecord[], summary: Record<string, unknown>) => {
  const cards = steps
    .map(
      (s) => `<figure class="${s.flagged ? 'flag' : ''}">
  <img src="${s.shot}" loading="lazy" alt="step ${s.n}">
  <figcaption>
    <div class="hdr"><span class="n">#${s.n}</span><span class="ms">${s.latencyMs} ms</span></div>
    <div class="url" title="${s.url}">${s.title || s.url}</div>
    <div class="row">broken ${bar(s.broken)}</div>
    <div class="row">dead end ${bar(s.deadEnd)}</div>
    <div class="act"><span class="${s.source}">${s.source}</span> → ${s.action} <em>(${s.confidence.toFixed(2)})</em></div>
  </figcaption>
</figure>`,
    )
    .join('\n');

  fs.writeFileSync(
    `${dir}/report.html`,
    `<!doctype html><meta charset="utf-8"><title>Jev crawl</title>
<style>
:root{--bg:#fff;--fg:#14161a;--mut:#5b6472;--line:#e4e7ec;--ok:#2f9e6d;--warn:#d38b12;--bad:#d64545;--flag:#d64545}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1115;--fg:#e8eaed;--mut:#98a2b3;--line:#242833}}
:root[data-theme=dark]{--bg:#0f1115;--fg:#e8eaed;--mut:#98a2b3;--line:#242833}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}
.sum{color:var(--mut);margin-bottom:20px;font-variant-numeric:tabular-nums}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
figure{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg)}
figure.flag{border-color:var(--flag);box-shadow:0 0 0 2px color-mix(in srgb,var(--flag) 25%,transparent)}
img{width:100%;display:block;border-bottom:1px solid var(--line)}
figcaption{padding:10px 12px;font-size:12px}
.hdr{display:flex;justify-content:space-between;color:var(--mut)}
.url{font-weight:600;margin:2px 0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row{display:flex;align-items:center;gap:6px;color:var(--mut)}
.bar{flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden}
.bar i{display:block;height:100%}
.act{margin-top:6px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.act .jev{color:var(--ok);font-weight:600}.act .fallback{color:var(--warn);font-weight:600}
b{font-variant-numeric:tabular-nums}
</style>
<h1>Exploratory crawl of the PMM UI — Jev in the loop</h1>
<div class="sum">${Object.entries(summary)
      .map(([k, v]) => `${k}=<b>${typeof v === 'object' ? JSON.stringify(v) : v}</b>`)
      .join(' · ')}</div>
<div class="grid">${cards}</div>`,
  );
};
