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
  ];

  pmmTest(
    'Verify PMM Agents statuses @pre-upgrade @post-upgrade @post-client-upgrade',
    async ({ cliHelper }) => {
      const containers: string[] = cliHelper
        .execSilent(`docker ps --format "{{.Names }}"`)
        .stdout.split('\n')
        .filter((item) => item && !nonClientContainers.includes(item));

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

  pmmTest('Verify PMM client versions before upgrade @pre-upgrade', async ({ cliHelper }) => {
    const containers: string[] = cliHelper
      .execSilent(`docker ps --format "{{.Names }}"`)
      .stdout.split('\n')
      .filter((item) => item && !nonClientContainers.includes(item));

    for (const container of containers) {
      const pmmAdminVersion: string = cliHelper.execSilent(
        `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      ).stdout;
      const pmmAgentVersion: string = cliHelper.execSilent(
        `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      ).stdout;

      expect(
        pmmAdminVersion,
        `PMM admin version: ${pmmAdminVersion} does not equal expected PMM client version ${process.env.CLIENT_VERSION} for service ${container},`,
      ).toContain(process.env.CLIENT_VERSION);
      expect(
        pmmAgentVersion,
        `PMM agent version: ${pmmAdminVersion} does not equal expected PMM client version ${process.env.CLIENT_VERSION} for service ${container},`,
      ).toContain(process.env.CLIENT_VERSION);
    }
  });

  pmmTest('Verify PMM client versions after upgrade @post-client-upgrade', async ({ cliHelper }) => {
    const containers: string[] = cliHelper
      .execSilent(`docker ps --format "{{.Names }}"`)
      .stdout.split('\n')
      .filter((item) => item && !nonClientContainers.includes(item));

    for (const container of containers) {
      const pmmAdminVersion: string = cliHelper.execSilent(
        `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      ).stdout;
      const pmmAgentVersion: string = cliHelper.execSilent(
        `docker exec ${container} sh -lc "pmm-admin status | grep pmm-admin | awk '{print $3}'"`,
      ).stdout;

      expect(
        pmmAdminVersion,
        `PMM admin version: ${pmmAdminVersion} does not equal expected PMM client version ${process.env.PMM_SERVER_LATEST} for service ${container},`,
      ).toContain(process.env.PMM_SERVER_LATEST);
      expect(
        pmmAgentVersion,
        `PMM agent version: ${pmmAdminVersion} does not equal expected PMM client version ${process.env.PMM_SERVER_LATEST} for service ${container},`,
      ).toContain(process.env.PMM_SERVER_LATEST);
    }
  });
});
