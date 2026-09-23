import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';
import { HelmRelease, HelmUpgradeOptions, RenderedResource } from '@interfaces/helm';

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

  /** `PMM_HA_CHART` is a chart directory or `repo/pmm-ha`; `PMM_HA_CHART_VERSION` pins a published one. */
  static chartFromEnv = (): string => {
    const chart = process.env.PMM_HA_CHART;

    if (!chart) {
      throw new Error(
        'PMM_HA_CHART is not set: point it at the pmm-ha chart under test, ' +
          'e.g. ~/percona-helm-charts/charts/pmm-ha or percona/pmm-ha',
      );
    }

    const version = process.env.PMM_HA_CHART_VERSION;

    return version ? `${chart} --version ${version}` : chart;
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

  /** Resources of a `--output json` release, one per YAML document of its manifest. */
  static renderedResources = (releaseJson: string): RenderedResource[] =>
    ((JSON.parse(releaseJson) as { manifest: string }).manifest ?? '')
      .split(/^---$/m)
      .map((document) => ({
        kind: /^kind: (\S+)$/m.exec(document)?.[1] ?? '',
        name: /^ {2}name: (\S+)$/m.exec(document)?.[1] ?? '',
        replicas: Number(/^ {2}replicas: (\d+)$/m.exec(document)?.[1] ?? Number.NaN),
        serviceType: /^ {2}type: (\S+)$/m.exec(document)?.[1],
      }))
      .filter((resource) => resource.kind);

  /**
   * Always `--reuse-values`: without it Helm rebuilds values from chart defaults,
   * which silently resets `replicas` and the HAProxy Service type.
   */
  upgrade = (
    release: string,
    chart: string,
    values: Record<string, number | string>,
    options: HelmUpgradeOptions = {},
  ): ExecReturn => {
    const sets = Object.entries(values)
      .map(([key, value]) => `--set ${key}=${value}`)
      .join(' ');
    const mode = options.dryRun
      ? '--dry-run=server --output json'
      : `--wait --timeout ${options.timeout ?? '15m'}`;

    return this.cliHelper.execSilent(
      `helm upgrade ${release} ${chart} --namespace ${this.namespace} --reuse-values ${sets} ${mode}`,
    );
  };

  private listReleases = (): HelmRelease[] =>
    JSON.parse(
      this.cliHelper.execute(`helm list --output json --namespace ${this.namespace}`).assertSuccess().stdout,
    ) as HelmRelease[];
}
