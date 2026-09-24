import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  KubernetesNodeResource,
  KubernetesPod,
  KubernetesPodResource,
  KubernetesResourceList,
} from '@interfaces/kubernetes';

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

  /**
   * Evicts only the pods matching `podSelector`, through the Eviction API, so every
   * PodDisruptionBudget is honoured. Leaves the node cordoned - {@link uncordonNode}.
   */
  drainNode = (nodeName: string, podSelector: string, timeout = '5m'): ExecReturn =>
    this.exec(
      `drain ${nodeName} --pod-selector=${podSelector} --ignore-daemonsets --delete-emptydir-data --timeout=${timeout}`,
    );

  /** @param args everything that follows `kubectl --namespace <namespace>` */
  exec = (args: string): ExecReturn =>
    this.cliHelper.execute(`kubectl --namespace ${this.namespace} ${args}`);

  execInPod = (podName: string, command: string, options: ExecInPodOptions = {}): ExecReturn => {
    const container = options.container ? `--container=${options.container} ` : '';
    const args = `exec ${podName} ${container}-- ${command}`;

    return options.silent ? this.execSilent(args) : this.exec(args);
  };

  /** {@link exec} without logging - for reads whose output would flood the report. */
  execSilent = (args: string): ExecReturn =>
    this.cliHelper.execSilent(`kubectl --namespace ${this.namespace} ${args}`);

  /** @param resource `kubectl get` arguments, e.g. `deployment pmm-ha-haproxy` or `pdb --selector=...` */
  getJson = <T>(resource: string): T =>
    JSON.parse(this.execSilent(`get ${resource} --output=json`).assertSuccess().stdout) as T;

  getNodes = (): KubernetesNodeResource[] =>
    this.getJson<KubernetesResourceList<KubernetesNodeResource>>('nodes').items;

  getPodNames = (labelSelector = ''): string[] => this.getPods(labelSelector).map((pod) => pod.name);

  /** @param labelSelector `-l` selector; empty means every pod */
  getPods = (labelSelector = ''): KubernetesPod[] => {
    const selector = labelSelector ? ` --selector=${labelSelector}` : '';
    const podList = this.getJson<KubernetesResourceList<KubernetesPodResource>>(`pods${selector}`);

    return podList.items.map((item) => ({
      images: (item.spec?.containers ?? []).map((container) => container.image),
      name: item.metadata.name,
      nodeName: item.spec?.nodeName,
      ready: item.status?.conditions?.find((condition) => condition.type === 'Ready')?.status === 'True',
      terminating: item.metadata.deletionTimestamp !== undefined,
    }));
  };

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

  scaleDeployment = (name: string, replicas: number): ExecReturn =>
    this.exec(`scale deployment ${name} --replicas=${replicas}`);

  scaleStatefulSet = (name: string, replicas: number): ExecReturn =>
    this.exec(`scale statefulset ${name} --replicas=${replicas}`);

  uncordonNode = (nodeName: string): ExecReturn => this.exec(`uncordon ${nodeName}`);
}
