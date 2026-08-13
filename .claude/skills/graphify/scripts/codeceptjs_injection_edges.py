"""Add CodeceptJS runtime-DI file edges to a Graphify AST extraction."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_javascript
import tree_sitter_typescript

_MAX_SOURCE_BYTES = 5_000_000
_PROVIDER_RE = re.compile(
    r"\btype\s+([A-Za-z_$][\w$]*)\s*=\s*typeof\s+import\s*"
    r"\(\s*(['\"])([^'\"]+)\2\s*\)\s*;?",
    re.MULTILINE,
)
_JS_SUFFIXES = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"}
_CODECEPT_CALLBACKS = {"Scenario", "Before", "After", "BeforeSuite", "AfterSuite", "Background"}
_PARSERS: dict[str, Parser] = {}


def _absolute(root: Path, source_file: str | Path) -> Path:
    path = Path(source_file)
    return path.resolve() if path.is_absolute() else (root / path).resolve()


def _read_small(path: Path) -> str | None:
    try:
        if path.stat().st_size > _MAX_SOURCE_BYTES:
            return None
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return None


def _injections(path: Path) -> list[tuple[str, str]]:
    text = _read_small(path)
    if text is None:
        return []
    source = text.encode("utf-8")
    suffix = path.suffix.lower()
    parser_key = "tsx" if suffix == ".tsx" else "typescript" if suffix in {
        ".ts", ".mts", ".cts",
    } else "javascript"
    if parser_key not in _PARSERS:
        language = (
            tree_sitter_typescript.language_tsx() if parser_key == "tsx"
            else tree_sitter_typescript.language_typescript() if parser_key == "typescript"
            else tree_sitter_javascript.language()
        )
        _PARSERS[parser_key] = Parser(Language(language))

    found: dict[str, str] = {}

    def node_text(node) -> str:
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def add_pattern(pattern) -> None:
        if pattern is None or pattern.type != "object_pattern":
            return
        for child in pattern.children:
            key = None
            if child.type == "shorthand_property_identifier_pattern":
                key = child
            elif child.type == "pair_pattern":
                key = child.child_by_field_name("key")
                if key is None and child.named_children:
                    key = child.named_children[0]
            elif child.type == "object_assignment_pattern":
                key = child.child_by_field_name("left")
                if key is None and child.named_children:
                    key = child.named_children[0]
            if key is not None:
                found.setdefault(node_text(key), f"L{key.start_point[0] + 1}")

    def is_inject_call(node) -> bool:
        if node is None or node.type != "call_expression":
            return False
        callee = node.child_by_field_name("function")
        return callee is not None and callee.type == "identifier" and node_text(callee) == "inject"

    def is_codecept_callback(node) -> bool:
        if node is None:
            return False
        if node.type in ("identifier", "property_identifier"):
            return node_text(node) in _CODECEPT_CALLBACKS
        if node.type != "member_expression":
            return False
        prop = node.child_by_field_name("property")
        if prop is not None and node_text(prop) in _CODECEPT_CALLBACKS:
            return True
        obj = node.child_by_field_name("object")
        return prop is not None and node_text(prop) in {"skip", "only"} and is_codecept_callback(obj)

    def callback_pattern(func):
        params = func.child_by_field_name("parameters")
        if params is not None:
            return next(
                (child for child in params.named_children if child.type == "object_pattern"),
                None,
            )
        param = func.child_by_field_name("parameter")
        return param if param is not None and param.type == "object_pattern" else None

    def walk(node) -> None:
        if node.type == "variable_declarator" and is_inject_call(
            node.child_by_field_name("value")
        ):
            add_pattern(node.child_by_field_name("name"))
        elif node.type == "call_expression" and is_codecept_callback(
            node.child_by_field_name("function")
        ):
            args = node.child_by_field_name("arguments")
            if args is not None:
                for arg in args.named_children:
                    if arg.type in {"arrow_function", "function_expression", "function"}:
                        add_pattern(callback_pattern(arg))
        for child in node.named_children:
            walk(child)

    walk(_PARSERS[parser_key].parse(source).root_node)
    return list(found.items())


def _file_nodes(root: Path, *graphs: dict) -> dict[Path, tuple[str, str]]:
    nodes: dict[Path, tuple[str, str]] = {}
    for graph in graphs:
        for node in graph.get("nodes", []):
            source_file = node.get("source_file")
            basename = str(source_file or "").replace("\\", "/").rsplit("/", 1)[-1]
            if source_file and node.get("label") == basename:
                nodes.setdefault(_absolute(root, source_file), (node["id"], str(source_file)))
    return nodes


def enrich(ast: dict, root: Path, existing: dict | None = None) -> int:
    """Mutate ``ast`` with exact CodeceptJS file dependencies; return edge count."""
    root = root.resolve()
    existing = existing or {}
    file_nodes = _file_nodes(root, ast, existing)

    steps_files = {path for path in file_nodes if path.name.lower() == "steps.d.ts"}
    common_steps = root / "steps.d.ts"
    if common_steps.is_file():
        steps_files.add(common_steps.resolve())

    registries: list[tuple[Path, dict[str, Path]]] = []
    for steps_file in sorted(steps_files):
        text = _read_small(steps_file)
        if text is None:
            continue
        providers: dict[str, Path] = {}
        for match in _PROVIDER_RE.finditer(text):
            provider = (steps_file.parent / match.group(3)).resolve()
            try:
                provider.relative_to(root)
            except ValueError:
                continue
            providers[match.group(1)] = provider
        if "steps_file" in providers:
            providers.setdefault("I", providers["steps_file"])
        if providers:
            registries.append((steps_file.parent.resolve(), providers))

    edges = ast.setdefault("edges", [])
    seen = {
        (edge.get("source"), edge.get("target"), edge.get("relation"))
        for edge in edges
    }
    added = 0
    ast_sources = {
        _absolute(root, node["source_file"])
        for node in ast.get("nodes", [])
        if node.get("source_file")
        and Path(str(node["source_file"])).suffix.lower() in _JS_SUFFIXES
    }
    for caller in sorted(ast_sources):
        source = file_nodes.get(caller)
        if source is None:
            continue
        scopes = []
        for scope, providers in registries:
            try:
                caller.relative_to(scope)
            except ValueError:
                continue
            scopes.append((scope, providers))
        if not scopes:
            continue
        providers = max(scopes, key=lambda item: len(item[0].parts))[1]
        for name, location in _injections(caller):
            provider = providers.get(name)
            target = file_nodes.get(provider) if provider else None
            if target is None or target[0] == source[0]:
                continue
            key = (source[0], target[0], "imports_from")
            if key in seen:
                continue
            seen.add(key)
            edges.append({
                "source": source[0],
                "target": target[0],
                "relation": "imports_from",
                "context": "codeceptjs_injection",
                "confidence": "EXTRACTED",
                "confidence_score": 1.0,
                "source_file": source[1],
                "source_location": location,
                "weight": 1.0,
            })
            added += 1
    return added


def main(argv: list[str]) -> int:
    if len(argv) not in (3, 4):
        print("usage: codeceptjs_injection_edges.py AST_JSON ROOT [GRAPH_JSON]", file=sys.stderr)
        return 2
    ast_path, root = Path(argv[1]), Path(argv[2])
    ast = json.loads(ast_path.read_text(encoding="utf-8"))
    existing = {}
    if len(argv) == 4 and Path(argv[3]).is_file():
        existing = json.loads(Path(argv[3]).read_text(encoding="utf-8"))
    added = enrich(ast, root, existing)
    temporary = ast_path.with_suffix(ast_path.suffix + ".tmp")
    temporary.write_text(json.dumps(ast, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, ast_path)
    if added:
        print(f"CodeceptJS DI: added {added} dependency edge(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
