New setup that will create start and integrate PMM2 with selected databases. Can be used locally or in CI.

New Integration setup prerequisite:

    - Installed ansible, nodejs, and docker.

Basic how to use integration setup:

    sudo npx ts-node ./integration-setup.ts --selected-flag

for example:

    sudo npx ts-node ./integration-setup.ts --setup-pmm-ps-integration

If you left all other flags like database version or pmm version empty the latest or dev-latest version fill be used.

All available flags are present in file:

    availableArgs.ts
