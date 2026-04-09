# PMM CLI tests

Percona Monitoring and Management CLI automated tests.

## Getting Started

- Open the `cli` folder in terminal.
- Install Node.js 18+ and make sure `npx` is available.
- Install dependencies: `npm ci`.
- Install Playwright browsers: `npx playwright install`.

## Running tests

Run commands from the `cli` folder.

- Run all tests: `npx playwright test`
- Run by a single tag: `npx playwright test --grep @client-docker`
- Run by multiple tags: `npx playwright test --grep "@generic|@unregister"`
- Show report: `npx playwright show-report`

Playwright `--grep` syntax reference: [Playwright CLI](https://playwright.dev/docs/test-cli)

## Available tags

- `@help`
- `@server-only`
- `@client-docker`
- `@generic`
- `@unregister`
- `@service-removal`
- `@ps`
- `@mysql`
- `@mysql-conf-file`
- `@pdpgsql`
- `@psmdb`
- `@psmdb-shard`
- `@haproxy`
- `@proxysql`
- `@mongoDb`

## Contributing

_coming soon_

