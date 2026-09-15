SHELL := /usr/bin/env bash

# `bash -n` parses only its first file argument -- the rest become positional
# parameters -- so syntax loops instead of passing a list. .bats files are
# excluded from it because `@test "..." {` is not valid bash; shellcheck reads
# them fine. $(wildcard) drops a pattern that matches nothing, which a literal
# `*.sh` would otherwise hand to shellcheck as a filename.
BASH_SOURCES := pmm-framework $(wildcard *.sh lib/*.sh setups/*.sh tests/helpers/*.bash)
LINT_SOURCES := $(BASH_SOURCES) $(wildcard tests/*.bats)

.PHONY: check syntax lint test

check: syntax lint test

syntax:
	@for f in $(BASH_SOURCES); do bash -n "$$f" || exit 1; done
	@echo "bash -n: $(words $(BASH_SOURCES)) files ok"

lint:
	@command -v shellcheck >/dev/null 2>&1 || { echo "shellcheck is required"; exit 1; }
	shellcheck -x --exclude=SC2030,SC2031,SC2034 $(LINT_SOURCES)

test:
	@command -v bats >/dev/null 2>&1 || { echo "bats is required"; exit 1; }
	bats tests
