import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';
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

  private listReleases = (): HelmRelease[] =>
    JSON.parse(
      this.cliHelper.execute(`helm list --output json --namespace ${this.namespace}`).assertSuccess()
        .stdout,
    ) as HelmRelease[];
}
