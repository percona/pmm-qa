# candidate: sep-pmm-fb-harness — Second MySQL target needs the entrypoint's hardcoded service name made overridable

- Added: 2026-09-23
- Applies to: the SEP pmm-fb compose harness
- Evidence: Adding a second backup-capable MySQL node to the pmm-fb harness registered its PMM node fine but died with `Service with name "sep-mysql" already exists` then `pmm-admin add mysql failed`, exit 1. The entrypoint sets SERVICE_NAME to a fixed literal with no environment override, while the node name is already parameterised, so two MySQL targets cannot coexist as shipped.
- Proposed change: Record that running a second MySQL target against this harness requires the entrypoint's service-name assignment to read an environment override (defaulting to the current literal); note it as an upstream gap to raise against the harness rather than a local workaround, since each new target otherwise needs a patched entrypoint copy.
