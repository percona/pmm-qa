import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
const configurations = [
  {
    bundleState: 'disabled',
    containerName: 'pmm-server-component-alerts-disabled',
    env: '-e PMM_ENABLE_COMPONENT_ALERTS=0',
    name: 'set to 0',
    port: 450,
    ruleUids: [],
  },
  {
    bundleState: 'written',
    containerName: 'pmm-server-component-alerts-default',
    env: '',
    name: 'not set',
    port: 451,
    ruleUids: ['pmm-clickhouse-down', 'pmm-grafana-down', 'pmm-qan-api2-down', 'pmm-victoriametrics-down'],
  },
];

for (const configuration of configurations) {
  pmmTest.describe('Built-in PMM Server alert rules', () => {
    pmmTest.use({ baseURL: `https://127.0.0.1:${configuration.port}/` });

    pmmTest.afterEach(async ({ cliHelper }) => {
      cliHelper.execSilent(`docker rm -f ${configuration.containerName}`);
    });

    pmmTest(
      `PMM-Txxxx - Verify built-in PMM Server alert rules when PMM_ENABLE_COMPONENT_ALERTS is ${configuration.name} @docker-configuration`,
      async ({ api, cliHelper }) => {
        cliHelper
          .execSilent(
            `docker run --detach --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 -e GF_SECURITY_ADMIN_PASSWORD=${adminPassword} ${configuration.env} --publish ${configuration.port}:8443 --name ${configuration.containerName} ${dockerVersion}`,
          )
          .assertSuccess();
        await api.serverApi.waitForReady();

        // The bundle reports "pending" until the provisioner's first render, so an empty rule list
        // only counts once this metric shows the render happened.
        await expect
          .poll(
            () =>
              cliHelper.execSilent(
                `docker exec ${configuration.containerName} curl -s http://127.0.0.1:7773/debug/metrics`,
              ).stdout,
            { timeout: Timeouts.TWO_MINUTES },
          )
          .toMatch(
            new RegExp(
              `pmm_alerting_provisioning_info\\{bundle="components",hash="[^"]*",state="${configuration.bundleState}"\\}`,
            ),
          );

        await expect
          .poll(() => api.alertingApi.getProvisionedRuleUids(), { timeout: Timeouts.TWO_MINUTES })
          .toEqual(configuration.ruleUids);
      },
    );
  });
}
