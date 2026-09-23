SHELL := /usr/bin/env bash

# `bash -n` only parses its first file argument, so syntax has to loop. .bats is
# excluded from it -- `@test "..." {` is not valid bash; shellcheck reads it fine.
BASH_SOURCES := pmm-framework build-images images/pxc/pmm-pxc $(wildcard *.sh lib/*.sh setups/*.sh tests/helpers/*.bash)
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
