#!/usr/bin/env python3
import argparse
import json
import re
import sys

STATUSES = ("Needs automation", "Automation candidate — infra gap", "Manual")
PRIORITIES = ("High", "Normal", "Low")
FORBIDDEN = [
    ("url", re.compile(r"https?://")),
    ("backtick", re.compile(r"`")),
    ("flag", re.compile(r"(^|\s)--?[a-zA-Z][\w-]*")),
    ("path", re.compile(r"(^|[\s(])/[\w.-]+/")),
    ("json", re.compile(r"[{}]")),
    ("header", re.compile(r"\bX-[A-Z][A-Za-z-]+")),
]


def cells(line):
    return [c.strip() for c in re.split(r"(?<!\\)\|", line.strip().strip("|"))]


def check(text):
    issues = []
    lines = text.splitlines()
    summary = []
    blocks = {}
    current = None
    for i, line in enumerate(lines, 1):
        m = re.match(r"^### (\d+)\. (.+)$", line)
        if m:
            current = int(m.group(1))
            blocks[current] = {"title": m.group(2).strip(), "lines": []}
            continue
        if current is None:
            row = cells(line) if line.startswith("|") else []
            if len(row) == 6 and row[0].isdigit():
                summary.append(int(row[0]))
                if row[2] not in PRIORITIES:
                    issues.append({"case": int(row[0]), "line": i, "check": "summary-priority", "detail": row[2]})
                if row[4] not in STATUSES:
                    issues.append({"case": int(row[0]), "line": i, "check": "summary-status", "detail": row[4]})
        else:
            blocks[current]["lines"].append((i, line))

    if sorted(summary) != sorted(blocks):
        issues.append({"case": None, "line": None, "check": "numbering",
                       "detail": f"summary table {sorted(summary)} vs case blocks {sorted(blocks)}"})
    if list(blocks) != list(range(1, len(blocks) + 1)):
        issues.append({"case": None, "line": None, "check": "numbering", "detail": f"case blocks not 1..n: {list(blocks)}"})
    if not blocks and not any(re.match(r"^Covered by: .+ → .+$", ln) for ln in lines):
        issues.append({"case": None, "line": None, "check": "coverage", "detail": "zero-case draft has no Covered by line"})

    for n, block in blocks.items():
        body = block["lines"]
        text_lines = [ln for _, ln in body]
        prio = next(((i, ln) for i, ln in body if ln.startswith("Priority:")), None)
        if not prio:
            issues.append({"case": n, "line": None, "check": "priority-line", "detail": "missing"})
        else:
            i, ln = prio
            m = re.match(r"^Priority: (\w+) · (.+)$", ln)
            if not m or m.group(1) not in PRIORITIES:
                issues.append({"case": n, "line": i, "check": "priority-line", "detail": ln})
            else:
                status = m.group(2)
                if status.startswith("Needs automation"):
                    if "lane:" not in status:
                        issues.append({"case": n, "line": i, "check": "lane", "detail": "Needs automation names no lane"})
                elif status.startswith("Automation candidate — infra gap"):
                    if "blocked:" not in status:
                        issues.append({"case": n, "line": i, "check": "blocker", "detail": "infra gap names no missing lane or helper"})
                elif status.startswith("Manual"):
                    if not re.match(r"^Manual — \S", status):
                        issues.append({"case": n, "line": i, "check": "manual-reason", "detail": "Manual gives no reason"})
                else:
                    issues.append({"case": n, "line": i, "check": "status", "detail": status})
        if not any(ln.startswith("Catches:") and "Evidence:" in ln for ln in text_lines):
            issues.append({"case": n, "line": None, "check": "catches", "detail": "missing Catches: … — Evidence: … line"})
        for i, ln in body:
            m = re.match(r"^(Precondition|Cleanup):\s*(.*)$", ln)
            if m and m.group(2).strip().rstrip(".").lower() in ("", "none", "n/a", "na"):
                issues.append({"case": n, "line": i, "check": "empty-optional", "detail": f"omit the {m.group(1)} line instead"})
        table = [(i, ln) for i, ln in body if ln.startswith("|")]
        if len(table) < 3:
            issues.append({"case": n, "line": None, "check": "table", "detail": "no step rows"})
            continue
        if cells(table[0][1]) != ["Step", "Data", "Expected"]:
            issues.append({"case": n, "line": table[0][0], "check": "columns", "detail": table[0][1]})
        for i, ln in table[2:]:
            row = cells(ln)
            if len(row) != 3:
                issues.append({"case": n, "line": i, "check": "columns", "detail": ln})
                continue
            for name, cell in zip(("Step", "Data", "Expected"), row, strict=True):
                if cell and not cell.startswith("- "):
                    issues.append({"case": n, "line": i, "check": "cell-prefix", "detail": f"{name}: {cell[:60]}"})
                if name == "Data":
                    continue
                if not cell:
                    issues.append({"case": n, "line": i, "check": "empty-cell", "detail": name})
                for kind, rx in FORBIDDEN:
                    if rx.search(cell.removeprefix("- ")):
                        issues.append({"case": n, "line": i, "check": f"{kind}-in-{name.lower()}", "detail": cell[:80]})
    return {"ok": not issues, "cases": len(blocks), "issues": issues}


def main():
    parser = argparse.ArgumentParser(
        description="Check a test-cases review draft against the test-case template. "
                    "Prints JSON on stdout. Exit 0 when clean, 1 when issues were found, 2 on a usage or read error.",
        epilog="Example: python3 scripts/check_draft.py /tmp/PMM-15379-draft.md")
    parser.add_argument("draft", help="markdown file holding the review draft")
    args = parser.parse_args()
    try:
        with open(args.draft, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        print(json.dumps({"ok": False, "error": f"cannot read {args.draft}: {e.strerror}"}))
        return 2
    result = check(text)
    print(json.dumps(result, ensure_ascii=False, indent=1))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
