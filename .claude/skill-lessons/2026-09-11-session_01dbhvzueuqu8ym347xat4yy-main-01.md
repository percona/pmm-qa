# .claude/skills/ui-evidence/SKILL.md — render a static page locally before publishing it; a CDN-loaded library must be optional

- Added: 2026-09-11
- Applies to: all skills that publish or hand off a static HTML page (Pages sites, artifacts, report dashboards)
- Evidence: A GitHub Pages dashboard loaded Chart.js from a CDN and called `new Chart(...)` before rendering its runs table. Rendering the page once locally (python http.server + headless Chromium) in an environment where the CDN was unreachable showed the chart missing — and reading the flow showed the unguarded call would have thrown and left the runs table blank too. Guarding the chart behind `if (window.Chart) try {...} catch` kept the table rendering; the screenshot then confirmed cards, badges, links and sorting worked.
- Proposed change: Before publishing a static page, serve it locally and screenshot it with the pre-installed Chromium (the ui-evidence path) — a syntax check alone misses runtime failures. Treat any CDN-loaded library as optional: guard its use so the page's core content renders without it, and show a visible fallback where the widget would be.
