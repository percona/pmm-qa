import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  KubernetesPod,
  KubernetesPodResource,
  KubernetesResourceList,
  KubernetesRoute,
  KubernetesRouteResource,
  KubernetesService,
  KubernetesServiceResource,
} from '@interfaces/kubernetes';
import { Timeouts } from '@helpers/timeouts';

interface ExecInPodOptions {
  container?: string;
  /** Skip logging - kubectl warns about defaulted containers on every call. */
  silent?: boolean;
}

interface LogOptions {
  container?: string;
  sinceSeconds?: number;
  tailLines?: number;
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

  getLogs = (podName: string, options: LogOptions = {}): string => {
    const container = options.container ? ` --container=${options.container}` : '';
    const since = options.sinceSeconds ? ` --since=${options.sinceSeconds}s` : '';
    const tail = options.tailLines ? ` --tail=${options.tailLines}` : '';

    return this.execSilent(`logs ${podName}${container}${since}${tail}`).assertSuccess().stdout;
  };

  getPodNames = (labelSelector = ''): string[] => this.getPods(labelSelector).map((pod) => pod.name);

  /** @param labelSelector `-l` selector; empty means every pod */
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

  /**
   * OpenShift Routes, empty on a cluster that has no such resource type - on ROSA
   * a Route, not a cloud load balancer, is what publishes a service externally.
   */
  getRoutes = (labelSelector = ''): KubernetesRoute[] => {
    const selector = labelSelector ? ` --selector=${labelSelector}` : '';
    const result = this.execSilent(`get routes.route.openshift.io${selector} --output=json`);

    if (result.code !== 0) return [];

    const routeList = JSON.parse(result.stdout) as KubernetesResourceList<KubernetesRouteResource>;

    return routeList.items.map((item) => ({
      host: item.spec?.host ?? '',
      name: item.metadata.name,
      serviceName: item.spec?.to?.name ?? '',
    }));
  };

  getSecretValue = (secretName: string, key: string): string => {
    const encoded = this.execSilent(`get secret ${secretName} --output=jsonpath={.data.${key}}`)
      .assertSuccess()
      .stdout.trim();

    return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  };

  /** Services with their externally reachable addresses, so a test can tell which one fronts the public URL. */
  getServices = (labelSelector = ''): KubernetesService[] => {
    const selector = labelSelector ? ` --selector=${labelSelector}` : '';
    const result = this.execSilent(`get services${selector} --output=json`).assertSuccess();
    const serviceList = JSON.parse(result.stdout) as KubernetesResourceList<KubernetesServiceResource>;

    return serviceList.items.map((item) => ({
      loadBalancerAddresses: (item.status?.loadBalancer?.ingress ?? [])
        .flatMap((ingress) => [ingress.hostname, ingress.ip])
        .filter((address): address is string => Boolean(address)),
      name: item.metadata.name,
      type: item.spec?.type ?? 'ClusterIP',
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

  scaleStatefulSet = (name: string, replicas: number): ExecReturn =>
    this.exec(`scale statefulset ${name} --replicas=${replicas}`);

  waitForPodReady = (podName: string, timeout: Timeouts = Timeouts.FIVE_MINUTES): ExecReturn =>
    this.exec(`wait --for=condition=Ready pod/${podName} --timeout=${K8sHelper.toSeconds(timeout)}`);

  waitForPodsReady = (labelSelector = '', timeout: Timeouts = Timeouts.FIVE_MINUTES): ExecReturn => {
    const selector = labelSelector ? `--selector=${labelSelector}` : '--all';

    return this.exec(`wait --for=condition=Ready pod ${selector} --timeout=${K8sHelper.toSeconds(timeout)}`);
  };

  private static toSeconds = (timeout: Timeouts): string => `${timeout / Timeouts.ONE_SECOND}s`;
}
