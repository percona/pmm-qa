export interface KubernetesPod {
  images: string[];
  name: string;
  nodeName?: string;
  ready: boolean;
  terminating: boolean;
}

export interface KubernetesResourceList<T> {
  items: T[];
}

interface KubernetesLabelSelector {
  matchLabels?: Record<string, string>;
}

export interface KubernetesPodAntiAffinityTerm {
  labelSelector?: KubernetesLabelSelector;
  topologyKey: string;
}

export interface KubernetesTopologySpreadConstraint {
  labelSelector?: KubernetesLabelSelector;
  maxSkew: number;
  topologyKey: string;
  whenUnsatisfiable: string;
}

export interface KubernetesPodSpec {
  affinity?: {
    podAntiAffinity?: {
      preferredDuringSchedulingIgnoredDuringExecution?: unknown[];
      requiredDuringSchedulingIgnoredDuringExecution?: KubernetesPodAntiAffinityTerm[];
    };
  };
  containers?: { image: string }[];
  nodeName?: string;
  topologySpreadConstraints?: KubernetesTopologySpreadConstraint[];
}

export interface KubernetesPodResource {
  metadata: { deletionTimestamp?: string; name: string };
  spec?: KubernetesPodSpec;
  status?: {
    conditions?: { status: string; type: string }[];
  };
}

export interface KubernetesDeploymentResource {
  metadata: { labels?: Record<string, string>; name: string };
  spec: { replicas: number; template: { spec: KubernetesPodSpec } };
}

export interface KubernetesNodeResource {
  metadata: { name: string };
  spec?: { taints?: { effect: string; key: string }[]; unschedulable?: boolean };
  status?: { conditions?: { status: string; type: string }[] };
}

export interface KubernetesPodDisruptionBudgetResource {
  metadata: { name: string };
  spec: {
    maxUnavailable?: number | string;
    minAvailable?: number | string;
    selector?: KubernetesLabelSelector;
  };
  status?: { currentHealthy?: number; disruptionsAllowed?: number; expectedPods?: number };
}
