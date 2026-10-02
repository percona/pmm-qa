import { expect, test } from '@helpers/test';
import * as cli from '@helpers/cli-helper';

const adminUrl = 'https://admin:admin@localhost';
const unknownAgentId = '00000000-0000-4000-8000-000000000000';
const viewer = { login: `pmm-t2339-viewer-${Date.now()}`, password: 'Viewer-pass-2339' };
const freshUser = { login: `pmm-t2340-user-${Date.now()}`, password: 'Fresh-pass-2340' };
const createdUserIds: number[] = [];

const createUser = async (user: { login: string, password: string }) => {
  const body = JSON.stringify({
    name: user.login,
    login: user.login,
    password: user.password,
  });
  const output = await cli.exec(`curl -sk -u admin:admin -H 'Content-Type: application/json' -X POST https://127.0.0.1/graph/api/admin/users -d '${body}'`);
  await output.assertSuccess();
  const { id } = JSON.parse(output.stdout) as { id: number };
  expect(id, `Grafana did not create user ${user.login}: ${output.stdout}`).toBeTruthy();
  createdUserIds.push(id);
};

const agentSetup = (username: string, password: string, nodeName: string) => cli.exec(
  // A listen port nothing serves makes setup register without touching the running pmm-agent.
  `sudo pmm-agent setup --config-file=/tmp/${nodeName}.yaml --listen-port=7779 --server-address=localhost:443 `
  + `--server-username=${username} --server-password=${password} --server-insecure-tls 127.0.0.1 generic ${nodeName}`,
);

test.describe('pmm-admin and pmm-agent PMM Server connection errors', { tag: '@generic' }, () => {
  test.beforeAll(async () => {
    await createUser(viewer);
    await createUser(freshUser);
  });

  test.afterAll(async () => {
    for (const id of createdUserIds) {
      await cli.exec(`curl -sk -u admin:admin -X DELETE https://127.0.0.1/graph/api/admin/users/${id}`);
    }
  });

  test('PMM-T2337 - Verify pmm-admin TLS certificate error suggests --server-insecure-tls and the flag lets the command succeed', async () => {
    const failed = await cli.exec(`sudo pmm-admin inventory list nodes --server-url='${adminUrl}'`);

    await failed.exitCodeEquals(1);
    await failed.outContainsMany([
      'tls: failed to verify certificate',
      'PMM Server TLS certificate could not be verified: it is either self-signed or not valid for host \'localhost\'.',
      'Re-run the command with --server-insecure-tls',
    ]);

    const passed = await cli.exec(`sudo pmm-admin inventory list nodes --server-url='${adminUrl}' --server-insecure-tls`);

    await passed.assertSuccess();
    await passed.outContains('Nodes list.');
  });

  test('PMM-T2338 - Verify pmm-admin --json output carries no connection hint', async () => {
    const tlsError = await cli.exec(`sudo pmm-admin --json inventory list nodes --server-url='${adminUrl}'`);

    await tlsError.exitCodeEquals(1);
    expect(JSON.parse(tlsError.stdout), 'TLS failure should be printed as a JSON string').toContain('tls: failed to verify certificate');
    await tlsError.outNotContains('--server-insecure-tls');

    const apiError = await cli.exec(`sudo pmm-admin --json inventory change agent node-exporter ${unknownAgentId} --enable `
      + `--server-url='https://${viewer.login}:${viewer.password}@localhost' --server-insecure-tls`);

    await apiError.exitCodeEquals(1);
    expect(JSON.parse(apiError.stdout), 'API error JSON should keep only code and error').toEqual({ code: 403, error: 'Access denied' });
  });

  test('PMM-T2339 - Verify pmm-admin and pmm-agent setup report insufficient permissions for a Viewer user', async () => {
    // nginx checks the role before the request reaches the API, so the agent does not have to exist.
    const admin = await cli.exec(`sudo pmm-admin inventory change agent node-exporter ${unknownAgentId} --enable `
      + `--server-url='https://${viewer.login}:${viewer.password}@localhost' --server-insecure-tls`);

    await admin.exitCodeEquals(1);
    await admin.outContains('Access denied. Please check that your PMM user has sufficient permissions.');
    await admin.outNotContains('Please check username and password');

    const agent = await agentSetup(viewer.login, viewer.password, 'pmm-t2339-node');

    await agent.exitCodeEquals(1);
    await agent.outContains('Failed to register pmm-agent on PMM Server: Access denied\nPlease check that your PMM user has sufficient permissions.');
    await agent.outNotContains('Please check username and password');
  });

  test('PMM-T2340 - Verify pmm-admin and pmm-agent setup point at PMM Server logs when authentication fails internally', async () => {
    // PMM Server caches a successful login for a minute, which would hide the stopped Grafana from
    // credentials used recently; freshUser has never logged in.
    const freshUrl = `https://${freshUser.login}:${freshUser.password}@localhost`;

    await cli.exec('docker exec pmm-server supervisorctl stop grafana');
    try {
      const admin = await cli.exec(`sudo pmm-admin inventory list nodes --server-url='${freshUrl}' --server-insecure-tls`);

      await admin.exitCodeEquals(1);
      await admin.outContains('Internal server error. Please check PMM Server logs.');
      await admin.outNotContains('Internal server error..');
      await admin.outNotContains('Please check username and password');

      const agent = await agentSetup(freshUser.login, freshUser.password, 'pmm-t2340-node');

      await agent.exitCodeEquals(1);
      await agent.outContains('Failed to register pmm-agent on PMM Server: Internal server error.\nPlease check PMM Server logs.');
      await agent.outNotContains('Please check username and password');
    } finally {
      await cli.exec('docker exec pmm-server supervisorctl start grafana');
      await expect(async () => {
        const status = await cli.exec('curl -sk -o /dev/null -w \'%{http_code}\' -u admin:admin https://127.0.0.1/v1/inventory/nodes');
        expect(status.stdout, 'PMM Server API did not authenticate again after Grafana start').toBe('200');
      }).toPass({ intervals: [2_000], timeout: 120_000 });
    }
  });

  test('PMM-T2341 - Verify pmm-admin does not print the password of a malformed --server-url', async () => {
    const malformed = [
      { url: 'https://admin:hunter2@', password: 'hunter2' },
      { url: 'admin:hunter2@localhost:443', password: 'hunter2' },
      { url: 'https:/admin:hunter2@localhost', password: 'hunter2' },
      { url: 'https://admin:hun/ter2@localhost:443', password: 'hun/ter2' },
    ];

    for (const { url, password } of malformed) {
      await test.step(`--server-url='${url}'`, async () => {
        const output = await cli.exec(`sudo pmm-admin inventory list nodes --server-url='${url}'`);

        expect(output.code, `pmm-admin accepted --server-url='${url}'`).not.toEqual(0);
        expect.soft(`${output.stdout}${output.stderr.text}`, `pmm-admin printed the password of '${url}'`).not.toContain(password);
      });
    }
  });
});
