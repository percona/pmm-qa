import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM cli tests for upgrade', () => {
  const nonClientContainers = [
    'ldap-server',
    'minio',
    'external_pmm',
    'nginx',
    'redis_container',
    'chunk-churn',
    'watchtower',
  ];

  pmmTest(
    'Verify PMM Agents statuses @pre-upgrade @post-upgrade @post-server-upgrade',
    async ({ cliHelper }) => {
      const containers: string[] = cliHelper
        .execSilent(`docker ps --format "{{.Names }}"`)
        .stdout.split('\n')
        .filter((item: string) => item && !nonClientContainers.includes(item));

      for (const container of containers) {
        const pmmAdminStatus: string = cliHelper.execSilent(
          `docker exec ${container} pmm-admin status`,
        ).stdout;
        const pmmAdminList: string = cliHelper.execSilent(`docker exec ${container} pmm-admin list`).stdout;

        expect(
          pmmAdminStatus,
          `Agent status contains wrong status in ${container} container. Error in: ${pmmAdminStatus}`,
        ).not.toMatch(/Waiting|Done|Unknown|Initialization Error|Stopping/);
        expect(
          pmmAdminList,
          `Agent list contains wrong status in ${container} container. Error in: ${pmmAdminList}`,
        ).not.toMatch(/Waiting|Done|Unknown|Initialization Error|Stopping/);
      }
    },
  );

  const versionChecks = [
    { expected: process.env.CLIENT_VERSION, label: 'before', tag: '@pre-upgrade' },
    { expected: process.env.PMM_SERVER_LATEST, label: 'after', tag: '@post-upgrade' },
  ];

  for (const { expected, label, tag } of versionChecks) {
    pmmTest(`Verify PMM client versions ${label} upgrade ${tag}`, async ({ cliHelper }) => {
      if (!expected?.trim()) {
        throw new Error(`An expected client version is required for the ${label}-upgrade check`);
      }

      const containers: string[] = cliHelper
        .execSilent(`docker ps --format "{{.Names }}"`)
        .stdout.split('\n')
        .filter((item) => item && !nonClientContainers.includes(item));

      for (const container of containers) {
        const pmmAdminVersion: string = cliHelper.execSilent(
          `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print \\$3}'"`,
        ).stdout;
        const pmmAgentVersion: string = cliHelper.execSilent(
          `docker exec ${container} sh -lc "pmm-admin status | grep pmm-agent | awk '{print \\$3}'"`,
        ).stdout;

        expect(
          pmmAdminVersion,
          `PMM admin version: ${pmmAdminVersion} does not equal expected PMM client version ${expected} for service ${container},`,
        ).toContain(expected);
        expect(
          pmmAgentVersion,
          `PMM agent version: ${pmmAgentVersion} does not equal expected PMM client version ${expected} for service ${container},`,
        ).toContain(expected);
      }
    });
  }
});
