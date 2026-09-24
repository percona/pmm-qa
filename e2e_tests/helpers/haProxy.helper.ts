import K8sHelper from '@helpers/k8s.helper';
import { Timeouts } from '@helpers/timeouts';
import {
  KubernetesDeploymentResource,
  KubernetesNodeResource,
  KubernetesPodDisruptionBudgetResource,
  KubernetesResourceList,
} from '@interfaces/kubernetes';
import { expect } from '@playwright/test';

export const haProxyPodSelector = 'app.kubernetes.io/name=haproxy';
/** The `pmm-ha` chart default for `haproxy.replicaCount`. */
export const defaultHaProxyReplicas = 3;

const isSchedulable = (node: KubernetesNodeResource): boolean =>
  !node.spec?.unschedulable &&
  !(node.spec?.taints ?? []).some((taint) => taint.effect === 'NoSchedule' || taint.effect === 'NoExecute') &&
  node.status?.conditions?.find((condition) => condition.type === 'Ready')?.status === 'True';

/** The HAProxy Deployment the `pmm-ha` chart fronts PMM Server with. */
export default class HaProxyHelper {
  constructor(private k8sHelper: K8sHelper = new K8sHelper()) {}

  deployment = (): KubernetesDeploymentResource => {
    const deployments = this.k8sHelper.getJson<KubernetesResourceList<KubernetesDeploymentResource>>(
      `deployments --selector=${haProxyPodSelector}`,
    ).items;

    if (deployments.length !== 1) {
      throw new Error(
        `Expected exactly one Deployment matching "${haProxyPodSelector}", got: ${
          deployments.map((deployment) => deployment.metadata.name).join(', ') || 'none'
        }`,
      );
    }

    return deployments[0];
  };

  disruptionBudget = (): KubernetesPodDisruptionBudgetResource => {
    const budgets = this.k8sHelper
      .getJson<KubernetesResourceList<KubernetesPodDisruptionBudgetResource>>('pdb')
      .items.filter((budget) => budget.spec.selector?.matchLabels?.['app.kubernetes.io/name'] === 'haproxy');

    if (budgets.length !== 1) {
      throw new Error(
        `Expected exactly one PodDisruptionBudget selecting HAProxy pods, got: ${
          budgets.map((budget) => budget.metadata.name).join(', ') || 'none'
        }`,
      );
    }

    return budgets[0];
  };

  /** Restores `replicas` and uncordons `cordonedNodes`, so a run killed mid-test does not leak into the next. */
  ensureReplicas = async (
    replicas: number = defaultHaProxyReplicas,
    cordonedNodes: string[] = [],
  ): Promise<void> => {
    this.k8sHelper.assertReachable();

    for (const nodeName of cordonedNodes) this.k8sHelper.uncordonNode(nodeName).assertSuccess();

    if (this.deployment().spec.replicas !== replicas) this.scale(replicas);

    await this.waitForReadyPods(replicas);
  };

  /** Running HAProxy pods per schedulable node, zero included, so an empty node counts against the spread. */
  podsPerNode = (): Record<string, number> => {
    const counts = Object.fromEntries(this.schedulableNodes().map((nodeName) => [nodeName, 0]));

    for (const pod of this.k8sHelper.getPods(haProxyPodSelector)) {
      if (pod.nodeName && !pod.terminating) counts[pod.nodeName] = (counts[pod.nodeName] ?? 0) + 1;
    }

    return counts;
  };

  /** `kubectl drain --pod-selector` spans every namespace, so pin it to this release. */
  releasePodSelector = (): string => {
    const release = this.deployment().metadata.labels?.['app.kubernetes.io/instance'];

    if (!release) throw new Error('The HAProxy Deployment carries no app.kubernetes.io/instance label');

    return `${haProxyPodSelector},app.kubernetes.io/instance=${release}`;
  };

  scale = (replicas: number): void => {
    this.k8sHelper.scaleDeployment(this.deployment().metadata.name, replicas).assertSuccess();
  };

  schedulableNodes = (): string[] =>
    this.k8sHelper
      .getNodes()
      .filter(isSchedulable)
      .map((node) => node.metadata.name)
      .sort();

  /** Exactly `replicas` pods, every one Ready: a scale-up that leaves a pod Pending never gets there. */
  waitForReadyPods = async (replicas: number, timeout: Timeouts = Timeouts.FIVE_MINUTES): Promise<void> => {
    await expect
      .poll(
        () => {
          const pods = this.k8sHelper.getPods(haProxyPodSelector).filter((pod) => !pod.terminating);

          return { pods: pods.length, ready: pods.filter((pod) => pod.ready).length };
        },
        { message: `HAProxy must run exactly ${replicas} Ready pods`, timeout },
      )
      .toEqual({ pods: replicas, ready: replicas });
  };
}
