import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const operators = ['victoria-metrics-operator', 'altinity-clickhouse-operator', 'pg-operator'];
const deploymentNames = (manifests: string): string[] =>
  manifests
    .split(/^---\s*$/m)
    .filter((manifest) => /^kind: Deployment\s*$/m.test(manifest))
    .map((manifest) => /^metadata:\n(?:^ {2,}.*\n)*?^ {2}name: *["']?([^"'\s]+)/m.exec(manifest)?.[1] ?? '');

pmmTest(
  'PMM-T2500 - Verify pmm-ha-dependencies renders only the operators left enabled @ha-argocd @ha-flux',
  async ({ cliHelper }) => {
    const chartDir = process.env.PMM_HA_DEPS_CHART_DIR ?? '';

    // eslint-disable-next-line playwright/no-skipped-test -- the chart directory comes from the GitOps pipelines.
    pmmTest.skip(
      !chartDir,
      'PMM_HA_DEPS_CHART_DIR is not set, so there is no pmm-ha-dependencies chart to render',
    );

    await pmmTest.step('Build the chart dependencies', async () => {
      cliHelper.execute(`helm dependency build ${chartDir}`).assertSuccess();
    });

    for (const operator of operators) {
      await pmmTest.step(`Render with ${operator}.enabled=false`, async () => {
        const deployments = deploymentNames(
          cliHelper
            .execSilent(`helm template op ${chartDir} --namespace pmm --set ${operator}.enabled=false`)
            .assertSuccess().stdout,
        );

        expect(
          operators.filter((candidate) => deployments.some((name) => name.includes(candidate))),
          `Rendered Deployments: ${deployments.join(', ') || 'none'}`,
        ).toEqual(operators.filter((candidate) => candidate !== operator));
      });
    }
  },
);
