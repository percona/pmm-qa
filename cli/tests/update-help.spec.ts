import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';

const serviceTypes: pmmAdmin.UpdateServiceType[] = ['external', 'external-serverless', 'haproxy', 'mongodb', 'mysql', 'postgresql', 'proxysql', 'valkey'];
const nodeFlagsOfExternalServerless = ['url', 'address', 'host', 'machine-id', 'distro', 'container-id', 'container-name', 'node-model', 'region', 'az'];

test.describe('PMM Client "update" help and validation', { tag: '@help-cli' }, () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('sudo pmm-admin status');
    await result.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
  });

  test('PMM-T2751 - Verify pmm-admin update is listed in help with its subcommands and flags', async ({}) => {
    const root = await cli.exec('sudo pmm-admin --help');
    await root.assertSuccess();
    expect(root.stdout).toMatch(/^\s+update\s+Change a monitored Service in place/m);

    const update = await cli.exec('sudo pmm-admin update --help');
    await update.assertSuccess();
    for (const serviceType of serviceTypes) {
      expect(update.stdout, `update ${serviceType} is not listed`).toMatch(new RegExp(`^\\s+update ${serviceType}\\s{2,}Update `, 'm'));
    }

    for (const serviceType of serviceTypes) {
      const help = await cli.exec(`sudo pmm-admin update ${serviceType} --help`);
      await help.assertSuccess();
      expect(help.stdout, `--service-id is missing from update ${serviceType} --help`).toContain('--service-id=STRING');
      expect(help.stdout, `--dry-run is missing from update ${serviceType} --help`).toContain('--dry-run');
      expect(help.stdout.replace(/\s+/g, ' '), `update ${serviceType} --help does not describe the in-place update`).toContain('Only the flags you pass are changed');
    }
  });

  test('PMM-T2752 - Verify pmm-admin update rejects the flags that only add can set', async ({}) => {
    const rejected: [pmmAdmin.UpdateServiceType, string, string][] = [
      ['mysql', 'svc --create-user', 'create-user'],
      ['external', '--agent-node-id=x', 'agent-node-id'],
      ['external', '--service-node-id=x', 'service-node-id'],
      ['haproxy', 'svc --node-id=x', 'node-id'],
      ...(['mysql', 'postgresql', 'proxysql', 'valkey'] as const).flatMap((serviceType) => ['node-id', 'pmm-agent-id']
        .map((flag): [pmmAdmin.UpdateServiceType, string, string] => [serviceType, `svc --${flag}=x`, flag])),
      ...nodeFlagsOfExternalServerless.map((flag): [pmmAdmin.UpdateServiceType, string, string] => ['external-serverless', `--external-name=svc --${flag}=x`, flag]),
    ];

    for (const [serviceType, args, flag] of rejected) {
      const output = await pmmAdmin.updateService('', serviceType, args);
      await cli.expectFailure(output, `--${flag} cannot be changed by update; remove the Service and add it again`);
    }
  });

  test('PMM-T2753 - Verify pmm-admin update rejects conflicting or invalid selectors and values', async ({}) => {
    const selectorConflict = 'the <name> argument and --service-id or --service-name are both given';
    for (const serviceType of ['mongodb', 'mysql', 'postgresql', 'proxysql', 'valkey', 'haproxy'] as const) {
      await cli.expectFailure(await pmmAdmin.updateService('', serviceType, 'svc --service-id=abc'), selectorConflict);
    }
    // HAProxy has no --service-name flag.
    for (const serviceType of ['mongodb', 'mysql', 'postgresql', 'proxysql', 'valkey'] as const) {
      await cli.expectFailure(await pmmAdmin.updateService('', serviceType, 'svc --service-name=abc'), selectorConflict);
    }

    await cli.expectFailure(
      await pmmAdmin.updateService('', 'mysql', 'svc --disable-tablestats --disable-tablestats-limit=100'),
      'both --disable-tablestats and --disable-tablestats-limit are passed',
    );
    await cli.expectFailure(
      await pmmAdmin.updateService('', 'postgresql', 'svc --query-source=bogus'),
      '--query-source must be one of: pgstatements, pgstatmonitor, none',
    );
    await cli.expectFailure(await pmmAdmin.updateService('', 'valkey', 'svc --disable-collectors=x'), '--disable-collectors is not supported for Valkey');
  });
});
