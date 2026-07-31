SHELL := /usr/bin/env bash

.PHONY: check syntax lint test

check: syntax lint test

syntax:
	bash -n pmm-framework *.sh lib/*.sh setups/*.sh tests/*.bats tests/helpers/*.bash

lint:
	@command -v shellcheck >/dev/null 2>&1 || { echo "shellcheck is required"; exit 1; }
	shellcheck -x --exclude=SC2030,SC2031,SC2034 pmm-framework *.sh lib/*.sh setups/*.sh tests/*.bats tests/helpers/*.bash

test:
	@command -v bats >/dev/null 2>&1 || { echo "bats is required"; exit 1; }
	bats tests
