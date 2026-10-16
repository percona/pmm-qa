import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';
import { Timeouts } from '@helpers/timeouts';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  KubernetesEventResource,
  KubernetesJobResource,
  KubernetesJobState,
  KubernetesPod,
  KubernetesPodResource,
  KubernetesResourceList,
} from '@interfaces/kubernetes';

// A `kubectl exec` into a pod being deleted can stall for good, and the call is
// synchronous: it would block the whole worker, Playwright's own timeouts included.
const kubectlTimeout = Timeouts.TWO_MINUTES;

interface ExecInPodOptions {
  container?: string;
  /** Skip logging - kubectl warns about defaulted containers on every call. */
  silent?: boolean;
}

/**
 * Namespaced `kubectl` wrapper. Runs with whatever `KUBECONFIG` the runner has -
 * this never authenticates on its own.
 */
export default class K8sHelper {
  readonly namespace: string;
  private cliHelper = new CliHelper();

  constructor(namespace = 'pmm') {
    this.namespace = namespace;
  }

  /** Through a file: {@link CliHelper} flattens a command onto one line, so a manifest cannot go on stdin. */
  apply = (manifest: object): ExecReturn => {
    const dir = mkdtempSync(join(tmpdir(), 'k8s-'));
    const file = join(dir, 'manifest.json');

    try {
      writeFileSync(file, JSON.stringify(manifest));

      return this.exec(`apply --filename=${file}`);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  };

  /**
   * Fails with kubectl's own error rather than skipping - a skipped cluster test
   * reports a green run that proved nothing.
   */
  assertReachable = (): void => {
    const result = this.execSilent('get pods --output=name');

    if (result.code === 0) return;

    throw new Error(
      `Namespace "${this.namespace}" is not reachable, so the cluster tests cannot run.\n` +
        `Kubeconfig: ${process.env.KUBECONFIG ?? join(homedir(), '.kube', 'config')}\n` +
        `kubectl said: ${result.stderr.trim() || '(no stderr)'}`,
    );
  };

  deletePod = (podName: string): ExecReturn => this.exec(`delete pod ${podName} --wait=false`);

  /** @param args everything that follows `kubectl --namespace <namespace>` */
  exec = (args: string): ExecReturn =>
    this.cliHelper.execute(`kubectl --namespace ${this.namespace} ${args}`, kubectlTimeout);

  execInPod = (podName: string, command: string, options: ExecInPodOptions = {}): ExecReturn => {
    const container = options.container ? `--container=${options.container} ` : '';
    const args = `exec ${podName} ${container}-- ${command}`;

    return options.silent ? this.execSilent(args) : this.exec(args);
  };

  /** {@link exec} without logging - for reads whose output would flood the report. */
  execSilent = (args: string): ExecReturn =>
    this.cliHelper.execSilent(`kubectl --namespace ${this.namespace} ${args}`, kubectlTimeout);

  getEventMessages = (objectName: string): string[] =>
    (
      JSON.parse(
        this.execSilent(
          `get events --field-selector=involvedObject.name=${objectName} --output=json`,
        ).assertSuccess().stdout,
      ) as KubernetesResourceList<KubernetesEventResource>
    ).items.map((event) => event.message ?? '');

  getJobState = (name: string): KubernetesJobState => {
    const job = JSON.parse(
      this.execSilent(`get job ${name} --output=json`).assertSuccess().stdout,
    ) as KubernetesJobResource;
    const finished = job.status?.conditions?.find(
      (condition) => condition.status === 'True' && ['Complete', 'Failed'].includes(condition.type),
    );

    return (finished?.type as KubernetesJobState | undefined) ?? 'Running';
  };

  /** @param kind any kubectl resource kind, e.g. `deployment` or `cronjob` */
  getNames = (kind: string, labelSelector: string): string[] =>
    this.execSilent(`get ${kind} --selector=${labelSelector} --output=jsonpath={.items[*].metadata.name}`)
      .assertSuccess()
      .stdout.trim()
      .split(/\s+/)
      .filter(Boolean);

  getNodeNames = (): string[] =>
    this.execSilent('get nodes --output=jsonpath={.items[*].metadata.name}')
      .assertSuccess()
      .stdout.trim()
      .split(/\s+/)
      .filter(Boolean);

  getPodNames = (labelSelector = ''): string[] => this.getPods(labelSelector).map((pod) => pod.name);

  /** @param labelSelector `-l` selector; empty means every pod */
  getPods = (labelSelector = ''): KubernetesPod[] => {
    const selector = labelSelector ? ` --selector=${labelSelector}` : '';
    const result = this.execSilent(`get pods${selector} --output=json`).assertSuccess();
    const podList = JSON.parse(result.stdout) as KubernetesResourceList<KubernetesPodResource>;

    return podList.items.map((item) => ({
      images: (item.spec?.containers ?? []).map((container) => container.image),
      name: item.metadata.name,
      ready: item.status?.conditions?.find((condition) => condition.type === 'Ready')?.status === 'True',
      restarts: (item.status?.containerStatuses ?? []).reduce((sum, status) => sum + status.restartCount, 0),
    }));
  };

  getSecretValue = (name: string, key: string): string =>
    Buffer.from(
      this.execSilent(`get secret ${name} --output=jsonpath={.data.${key}}`).assertSuccess().stdout.trim(),
      'base64',
    ).toString();

  /** @param labelSelector `-l` selector; empty means every StatefulSet */
  getStatefulSetNames = (labelSelector = ''): string[] => {
    const selector = labelSelector ? ` --selector=${labelSelector}` : '';
    const result = this.execSilent(
      `get statefulsets${selector} --output=jsonpath={.items[*].metadata.name}`,
    ).assertSuccess();

    return result.stdout.trim().split(/\s+/).filter(Boolean);
  };

  getStatefulSetReplicas = (name: string): number =>
    Number(
      this.execSilent(`get statefulset ${name} --output=jsonpath={.spec.replicas}`)
        .assertSuccess()
        .stdout.trim(),
    );

  scaleStatefulSet = (name: string, replicas: number): ExecReturn =>
    this.exec(`scale statefulset ${name} --replicas=${replicas}`);
}
