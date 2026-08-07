import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';
import { KubernetesPod, KubernetesPodResource, KubernetesResourceList } from '@interfaces/kubernetes';
import { Timeouts } from '@helpers/timeouts';

interface LogOptions {
  container?: string;
  tailLines?: number;
}

/**
 * Thin wrapper around the `kubectl` CLI for tests that need to inspect or
 * disturb the cluster a PMM deployment runs on (HA above all).
 *
 * Every command is namespaced and executed through {@link CliHelper}, so the
 * cluster is reached with whatever `KUBECONFIG` the runner already has - the
 * helper never authenticates on its own. Use {@link isAvailable} to skip
 * cluster-level checks when the job runs without cluster access.
 */
export default class K8sHelper {
  readonly namespace: string;
  private cliHelper = new CliHelper();

  constructor(namespace = process.env.PMM_K8S_NAMESPACE || 'pmm') {
    this.namespace = namespace;
  }

  deletePod = (podName: string): ExecReturn => this.exec(`delete pod ${podName} --wait=false`);

  /**
   * Run a namespaced `kubectl` subcommand and return a handy {@link ExecReturn}.
   *
   * @param   args  everything that follows `kubectl --namespace <namespace>`
   */
  exec = (args: string): ExecReturn =>
    this.cliHelper.execute(`kubectl --namespace ${this.namespace} ${args}`);

  execInPod = (podName: string, command: string, container?: string): ExecReturn =>
    this.exec(`exec ${podName} ${container ? `-c ${container} ` : ''}-- ${command}`);

  /**
   * Same as {@link exec} but without logging - use it for `-o json` reads whose
   * output would otherwise flood the report.
   */
  execSilent = (args: string): ExecReturn =>
    this.cliHelper.execSilent(`kubectl --namespace ${this.namespace} ${args}`);

  getLogs = (podName: string, options: LogOptions = {}): string => {
    const container = options.container ? ` --container=${options.container}` : '';
    const tail = options.tailLines ? ` --tail=${options.tailLines}` : '';

    return this.execSilent(`logs ${podName}${container}${tail}`).assertSuccess().stdout;
  };

  getPodNames = (labelSelector = ''): string[] => this.getPods(labelSelector).map((pod) => pod.name);

  /**
   * Pods in the namespace, flattened to the fields tests actually assert on.
   *
   * @param   labelSelector   `-l` selector, empty means every pod in the namespace
   */
  getPods = (labelSelector = ''): KubernetesPod[] => {
    const selector = labelSelector ? ` --selector=${labelSelector}` : '';
    const result = this.execSilent(`get pods${selector} --output=json`).assertSuccess();
    const podList = JSON.parse(result.stdout) as KubernetesResourceList<KubernetesPodResource>;

    return podList.items.map((item) => {
      const containerStatuses = item.status?.containerStatuses ?? [];
      const readyCondition = item.status?.conditions?.find((condition) => condition.type === 'Ready');

      return {
        containersReady: containerStatuses.filter((status) => status.ready).length,
        containersTotal: containerStatuses.length,
        name: item.metadata.name,
        phase: item.status?.phase ?? 'Unknown',
        ready: readyCondition?.status === 'True',
        restarts: containerStatuses.reduce((total, status) => total + status.restartCount, 0),
      };
    });
  };

  getSecretValue = (secretName: string, key: string): string => {
    const encoded = this.execSilent(`get secret ${secretName} --output=jsonpath={.data.${key}}`)
      .assertSuccess()
      .stdout.trim();

    return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  };

  /**
   * Whether the runner can talk to the namespace at all. HA jobs may run
   * UI-only (no `kubeconfig_artifact_url` workflow input), and cluster-level tests are
   * skipped in that case instead of failing the run.
   */
  isAvailable = (): boolean => this.execSilent('get pods --output=name').code === 0;

  waitForPodReady = (podName: string, timeout: Timeouts = Timeouts.FIVE_MINUTES): ExecReturn =>
    this.exec(`wait --for=condition=Ready pod/${podName} --timeout=${K8sHelper.toSeconds(timeout)}`);

  waitForPodsReady = (labelSelector = '', timeout: Timeouts = Timeouts.FIVE_MINUTES): ExecReturn => {
    const selector = labelSelector ? `--selector=${labelSelector}` : '--all';

    return this.exec(`wait --for=condition=Ready pod ${selector} --timeout=${K8sHelper.toSeconds(timeout)}`);
  };

  private static toSeconds = (timeout: Timeouts): string => `${timeout / Timeouts.ONE_SECOND}s`;
}
