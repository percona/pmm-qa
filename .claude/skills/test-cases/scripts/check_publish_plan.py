#!/usr/bin/env python3
import argparse
import json
import re
import sys

STATUSES = ("Needs Automation", "Manual Only", "Draft")
PRIORITIES = ("High", "Normal", "Low")


def check(plan):
    errors = []

    def err(case, field, detail):
        errors.append({"case": case, "field": field, "detail": detail})

    ticket = plan.get("ticket")
    if ticket is not None and not re.fullmatch(r"PMM-\d+", str(ticket)):
        err(None, "ticket", f"expected PMM-<number> or null for a coverage audit, got {ticket!r}")
    version = str(plan.get("fixVersion", ""))
    m = re.fullmatch(r"(\d+)\.\d+\.\d+", version)
    if not m:
        err(None, "fixVersion", f"expected <major>.<minor>.<patch>, got {version!r}")
    major = m.group(1) if m else None
    cases = plan.get("cases")
    if not isinstance(cases, list) or not cases:
        err(None, "cases", "no cases to publish")
        return errors

    names = {}
    for idx, c in enumerate(cases):
        n = c.get("n", idx + 1)
        name = str(c.get("name", "")).strip()
        if not name or len(name) > 255:
            err(n, "name", "must be 1–255 characters")
        if re.match(r"^\d+\.\s", name):
            err(n, "name", "drop the draft number from the title")
        if name in names:
            err(n, "name", f"duplicate of case {names[name]}")
        names[name] = n
        objective = str(c.get("objective", ""))
        if not objective.startswith("Catches:"):
            err(n, "objective", "must start with the Catches/Evidence line")
        if c.get("priorityName") not in PRIORITIES:
            err(n, "priorityName", f"one of {PRIORITIES}, got {c.get('priorityName')!r}")
        status = c.get("statusName")
        labels = c.get("labels") or []
        if status not in STATUSES:
            err(n, "statusName", f"one of {STATUSES}, got {status!r}")
        if c.get("openFinding") and status != "Draft":
            err(n, "statusName", "a case whose expected result waits on an open Finding publishes as Draft")
        if status == "Draft" and not c.get("openFinding"):
            err(n, "statusName", "Draft is only for a case with an open Finding; set openFinding or pick the case's real status")
        if "infra-gap" in labels:
            if status != "Needs Automation":
                err(n, "labels", "infra-gap goes with Needs Automation")
            if "Blocked:" not in objective:
                err(n, "objective", "an infra-gap case names what blocks it with Blocked: …")
        elif status == "Needs Automation" and "Lane:" not in objective:
            err(n, "objective", "a Needs Automation case names its lane with Lane: …")
        if status == "Manual Only" and "Manual:" not in objective:
            err(n, "objective", "a Manual Only case gives its reason with Manual: …")
        folder = str(c.get("folderPath", ""))
        if major and not folder.startswith(f"PMM{major}.x "):
            err(n, "folderPath", f"fix version {version} belongs under PMM{major}.x, got {folder!r}")
        if c.get("folderId") is not None and not isinstance(c.get("folderId"), int):
            err(n, "folderId", "an integer, or null for a folder still to be created")
        steps = c.get("steps")
        if not isinstance(steps, list) or not steps:
            err(n, "steps", "no steps")
            continue
        for s_idx, s in enumerate(steps, 1):
            last = s_idx == len(steps)
            for field in ("description", "testData", "expectedResult"):
                value = s.get(field)
                if isinstance(value, str) and value.startswith("- "):
                    err(n, f"steps[{s_idx}].{field}", "strip the leading '- '")
            if not str(s.get("description", "")).strip():
                err(n, f"steps[{s_idx}].description", "empty")
            if not str(s.get("expectedResult", "")).strip() and not last:
                err(n, f"steps[{s_idx}].expectedResult", "only the final Cleanup step may have no expected result")
    return errors


def main():
    parser = argparse.ArgumentParser(
        description="Validate a Zephyr publish plan before any Zephyr write. "
                    "Prints JSON on stdout. Exit 0 when valid, 1 when errors were found, 2 on a usage or read error.",
        epilog="Example: python3 scripts/check_publish_plan.py /tmp/PMM-15379-publish-plan.json")
    parser.add_argument("plan", help="publish plan JSON written at step 10")
    args = parser.parse_args()
    try:
        with open(args.plan, encoding="utf-8") as f:
            plan = json.load(f)
    except OSError as e:
        print(json.dumps({"ok": False, "error": f"cannot read {args.plan}: {e.strerror}"}))
        return 2
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"{args.plan} is not valid JSON: {e}"}))
        return 2
    errors = check(plan)
    print(json.dumps({"ok": not errors, "cases": len(plan.get("cases") or []), "errors": errors}, ensure_ascii=False, indent=1))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
