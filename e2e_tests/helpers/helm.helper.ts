import CliHelper from '@helpers/cli.helper';
import { HelmRelease } from '@interfaces/helm';

/**
 * Namespaced `helm` wrapper. Runs with whatever `KUBECONFIG` the runner has -
 * this never authenticates on its own.
 */
export default class HelmHelper {
  readonly namespace: string;
  private cliHelper = new CliHelper();

  constructor(namespace = 'pmm') {
    this.namespace = namespace;
  }

  assertAvailable = (): void => {
    const result = this.cliHelper.execSilent('helm version --short');

    if (result.code === 0) return;

    throw new Error(
      `helm is not usable, so the Helm upgrade test cannot run.\n` +
        `helm said: ${result.stderr.trim() || '(no stderr)'}`,
    );
  };

  /**
   * @param   chartName  anchored on the version that follows it, so `pmm-ha` does
   *                     not also match the `pmm-ha-dependencies` release
   */
  getRelease = (chartName: string): HelmRelease => {
    const chartPattern = new RegExp(`^${chartName}-\\d`);
    const releases = this.listReleases().filter((release) => chartPattern.test(release.chart));

    if (releases.length !== 1) {
      throw new Error(
        `Expected exactly one Helm release of chart "${chartName}" in namespace "${this.namespace}", got: ${
          releases.length ? releases.map((release) => release.chart).join(', ') : 'none'
        }`,
      );
    }

    return releases[0];
  };

  /** Names of the Deployments `helm template` renders from a local chart directory with the given extra arguments. */
  renderedDeploymentNames = (chartDir: string, args: string): string[] =>
    this.cliHelper
      .execSilent(`helm template op ${chartDir} --namespace ${this.namespace} ${args}`)
      .assertSuccess()
      .stdout.split(/^---\s*$/m)
      .filter((manifest) => /^kind: Deployment\s*$/m.test(manifest))
      .map(
        (manifest) => /^metadata:\n(?:^ {2,}.*\n)*?^ {2}name: *["']?([^"'\s]+)/m.exec(manifest)?.[1] ?? '',
      );

  private listReleases = (): HelmRelease[] =>
    JSON.parse(
      this.cliHelper.execute(`helm list --output json --namespace ${this.namespace}`).assertSuccess().stdout,
    ) as HelmRelease[];
}
