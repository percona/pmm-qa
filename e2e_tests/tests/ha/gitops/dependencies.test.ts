import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const operators = ['victoria-metrics-operator', 'altinity-clickhouse-operator', 'pg-operator'];

pmmTest(
  'PMM-T2500 - Verify pmm-ha-dependencies renders only the operators left enabled @ha-argocd',
  async ({ cliHelper, helmHelper }) => {
    const chartDir = process.env.PMM_HA_DEPS_CHART_DIR ?? '';

    // eslint-disable-next-line playwright/no-skipped-test -- the chart directory comes from the Argo CD pipeline.
    pmmTest.skip(
      !chartDir,
      'PMM_HA_DEPS_CHART_DIR is not set, so there is no pmm-ha-dependencies chart to render',
    );

    await pmmTest.step('Build the chart dependencies', async () => {
      cliHelper.execute(`helm dependency build ${chartDir}`).assertSuccess();
    });

    for (const operator of operators) {
      await pmmTest.step(`Render with ${operator}.enabled=false`, async () => {
        const deployments = helmHelper.renderedDeploymentNames(chartDir, `--set ${operator}.enabled=false`);

        expect(
          operators.filter((candidate) => deployments.some((name) => name.includes(candidate))),
          `Rendered Deployments: ${deployments.join(', ') || 'none'}`,
        ).toEqual(operators.filter((candidate) => candidate !== operator));
      });
    }
  },
);
