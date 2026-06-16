#!/usr/bin/env python3
"""Generate README sections maintained from repository source files."""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "qa-integration" / "README.md"
DATABASE_OPTIONS = ROOT / "qa-integration" / "pmm_qa" / "scripts" / "database_options.py"
E2E_README = ROOT / "e2e_tests" / "README.md"
E2E_TESTS = ROOT / "e2e_tests" / "tests"
CLI_README = ROOT / "cli" / "README.md"
CLI_TESTS = ROOT / "cli" / "tests"

SETUPS_START = "<!-- DB-SETUPS-START -->"
SETUPS_END = "<!-- DB-SETUPS-END -->"
VARIANTS_START = "<!-- DB-VARIANTS-START -->"
VARIANTS_END = "<!-- DB-VARIANTS-END -->"
E2E_TAGS_START = "<!-- E2E-TAGS-START -->"
E2E_TAGS_END = "<!-- E2E-TAGS-END -->"
CLI_TAGS_START = "<!-- CLI-TAGS-START -->"
CLI_TAGS_END = "<!-- CLI-TAGS-END -->"
TAG_PATTERN = re.compile(r"(?<!@)@[A-Za-z0-9][A-Za-z0-9_-]*\b(?!/)")
PLAYWRIGHT_TAG_PATTERN = re.compile(
    r"tag\s*:\s*(?:'(?P<single>@[A-Za-z0-9][A-Za-z0-9_-]*)'|\"(?P<double>@[A-Za-z0-9][A-Za-z0-9_-]*)\"|\[(?P<array>.*?)\])",
    re.S,
)

TOPOLOGY = {
    "MYSQL": {"default_topology": "single node", "setup_type": {"replication": "async replication", "gr": "group replication"}},
    "PS": {"default_topology": "single node", "setup_type": {"replication": "async replication", "gr": "group replication"}},
    "PXC": {"default_topology": "fixed 3-node PXC with ProxySQL", "setup_type": {}},
    "PGSQL": {"default_topology": "single pg_stat_statements setup", "setup_type": {"replication": "primary/replica"}},
    "PDPGSQL": {"default_topology": "single node", "setup_type": {"replication": "primary/replica", "patroni": "Patroni setup"}},
    "PSMDB": {
        "default_topology": "pss replica set",
        "setup_type": {"psa": "PSA replica set", "shards": "sharded setup", "sharding": "sharded setup"},
    },
    "VALKEY": {"default_topology": "cluster", "setup_type": {"sentinel": "sentinel setup", "sentinels": "sentinel setup"}},
    "PROXYSQL": {"default_topology": "package selector used by PXC", "setup_type": {}},
    "HAPROXY": {"default_topology": "fixed HAProxy setup", "setup_type": {}},
}

VARIANTS = {
    "SSL_MYSQL": "TLS/SSL MySQL setup.",
    "SSL_PDPGSQL": "TLS/SSL PostgreSQL or Percona Distribution for PostgreSQL setup.",
    "SSL_PSMDB": "TLS/SSL PSMDB setup.",
    "MLAUNCH_PSMDB": "mlaunch-based PSMDB setup.",
    "MLAUNCH_MODB": "mlaunch-based MongoDB setup.",
    "SSL_MLAUNCH": "TLS/SSL mlaunch MongoDB/PSMDB setup.",
    "DOCKERCLIENTS": "Docker client image setup helper.",
    "BUCKET": "MinIO bucket setup helper for backup/object-storage scenarios.",
}


def load_database_options() -> dict:
    tree = ast.parse(DATABASE_OPTIONS.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "database_options":
                    return ast.literal_eval(node.value)
    raise RuntimeError(f"Cannot find database_options in {DATABASE_OPTIONS}")


def versions_for(database_options: dict, key: str) -> list[str]:
    versions = [version for version in database_options.get(key, {}).get("versions", []) if version]
    return versions or ["default"]


def compact_string_arrays(json_text: str) -> str:
    pattern = re.compile(r"\[\n(?P<items>(?:\s+\"[^\"]+\",?\n)+)\s+\]")

    def compact(match: re.Match[str]) -> str:
        items = [line.strip().rstrip(",") for line in match.group("items").splitlines()]
        return f"[{', '.join(items)}]"

    return pattern.sub(compact, json_text)


def build_setups(database_options: dict) -> str:
    setups = {
        key: {"versions": versions_for(database_options, key), **metadata}
        for key, metadata in TOPOLOGY.items()
    }
    setups["EXTERNAL"] = {
        "versions": {
            "redis_exporter": database_options["EXTERNAL"]["REDIS"]["versions"],
            "node_process_exporter": database_options["EXTERNAL"]["NODEPROCESS"]["versions"],
        },
        "default_topology": "external exporter setup",
        "setup_type": {},
    }
    return f"```json\n{compact_string_arrays(json.dumps(setups, indent=2))}\n```"


def build_variants_table(database_options: dict) -> str:
    rows = [
        "| Setup key       | Purpose                                                          | Versions                                    |",
        "| --------------- | ---------------------------------------------------------------- | ------------------------------------------- |",
    ]
    for key, purpose in VARIANTS.items():
        versions = versions_for(database_options, key)
        version_text = "n/a" if versions == ["default"] else ", ".join(f"`{version}`" for version in versions)
        rows.append(f"| {f'`{key}`':<15} | {purpose:<64} | {version_text:<43} |")
    return "\n".join(rows)


def discover_e2e_tags() -> list[str]:
    tags = set()
    for test_file in E2E_TESTS.rglob("*.ts"):
        for line in test_file.read_text(encoding="utf-8").splitlines():
            if line.lstrip().startswith(("import ", "export ")):
                continue
            tags.update(TAG_PATTERN.findall(line))
    return sorted(tags, key=str.lower)


def build_e2e_tags() -> str:
    tags = discover_e2e_tags()
    if not tags:
        raise RuntimeError(f"Cannot find e2e tags in {E2E_TESTS}")
    return "\n".join(f"- `{tag}`" for tag in tags)


def discover_cli_tags() -> list[str]:
    tags = set()
    for test_file in CLI_TESTS.rglob("*.ts"):
        content = test_file.read_text(encoding="utf-8")
        for match in PLAYWRIGHT_TAG_PATTERN.finditer(content):
            if match.group("single"):
                tags.add(match.group("single"))
            elif match.group("double"):
                tags.add(match.group("double"))
            elif match.group("array"):
                tags.update(TAG_PATTERN.findall(match.group("array")))
    return sorted(tags, key=str.lower)


def build_cli_tags() -> str:
    tags = discover_cli_tags()
    if not tags:
        raise RuntimeError(f"Cannot find CLI tags in {CLI_TESTS}")
    return "\n".join(f"- `{tag}`" for tag in tags)


def replace_section(content: str, start_marker: str, end_marker: str, replacement: str) -> str:
    pattern = re.compile(rf"{re.escape(start_marker)}.*?{re.escape(end_marker)}", re.S)
    updated, count = pattern.subn(f"{start_marker}\n\n{replacement}\n\n{end_marker}", content)
    if count != 1:
        raise RuntimeError(f"Expected exactly one section between {start_marker} and {end_marker}")
    return updated


def build_generated_readmes() -> dict[Path, str]:
    database_options = load_database_options()
    content = README.read_text(encoding="utf-8")
    content = replace_section(content, SETUPS_START, SETUPS_END, build_setups(database_options))
    content = replace_section(content, VARIANTS_START, VARIANTS_END, build_variants_table(database_options))

    e2e_content = E2E_README.read_text(encoding="utf-8")
    e2e_content = replace_section(e2e_content, E2E_TAGS_START, E2E_TAGS_END, build_e2e_tags())

    cli_content = CLI_README.read_text(encoding="utf-8")
    cli_content = replace_section(cli_content, CLI_TAGS_START, CLI_TAGS_END, build_cli_tags())
    return {
        README: content,
        E2E_README: e2e_content,
        CLI_README: cli_content,
    }


def check_generated_readmes(generated_readmes: dict[Path, str]) -> None:
    stale_readmes = [
        readme.relative_to(ROOT).as_posix()
        for readme, generated_content in generated_readmes.items()
        if readme.read_text(encoding="utf-8") != generated_content
    ]
    if stale_readmes:
        readme_list = "\n".join(f"- {readme}" for readme in stale_readmes)
        raise RuntimeError(f"Generated README sections are stale. Run support_scripts/generate_readme.py.\n{readme_list}")


def generate() -> None:
    generated_readmes = build_generated_readmes()
    for readme, generated_content in generated_readmes.items():
        readme.write_text(generated_content, encoding="utf-8")
    print("README generated sections updated")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 2 or (len(sys.argv) == 2 and sys.argv[1] != "--check"):
            raise RuntimeError("Usage: support_scripts/generate_readme.py [--check]")
        if len(sys.argv) == 2:
            check_generated_readmes(build_generated_readmes())
            print("README generated sections are up to date")
        else:
            generate()
    except Exception as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
