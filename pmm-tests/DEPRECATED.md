# ⚠️ DEPRECATED: PMM Tests Directory

## This directory is deprecated and in maintenance mode only

**Status**: 🚫 **DEPRECATED - DO NOT USE FOR NEW DEVELOPMENT**

The BATS (Bash Automated Testing System) tests in this directory are **deprecated** and should not be used for new test development.

## What to use instead

For new test development, use the current testing frameworks:

### CLI Testing
- **Framework**: TypeScript/Playwright 
- **Location**: `cli-tests/` directory in [pmm-ui-tests](https://github.com/percona/pmm-ui-tests/tree/v3) repository
- **Documentation**: [Integration & CLI Tests](../docs/integration-cli-tests.md)

### UI Testing  
- **Framework**: Playwright
- **Location**: `playwright-tests/` directory in [pmm-ui-tests](https://github.com/percona/pmm-ui-tests/tree/v3) repository
- **Documentation**: [End-to-End Tests](../docs/e2e-tests.md)

### Infrastructure Setup
- **Framework**: Python/Ansible
- **Location**: `qa-integration/pmm_qa/` directory in [qa-integration](https://github.com/Percona-Lab/qa-integration/tree/v3) repository
- **Documentation**: [Adding New Environments](../docs/adding-new-environments.md)

## Migration Timeline

- **Current Status**: Maintenance mode only - critical bug fixes only
- **New Development**: Use TypeScript/Playwright frameworks listed above
- **Existing Tests**: Will be gradually migrated to new frameworks
- **Future**: This directory will be removed in a future release

## For More Information

See the main documentation: [PMM-QA Testing Documentation](../docs/README.md#important-notice-legacy-tests-deprecation)

---

**Last Updated**: December 2024  
**Deprecation Notice Added**: December 2024 