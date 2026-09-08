export interface KubernetesPod {
  containersReady: number;
  containersTotal: number;
  initContainers: string[];
  name: string;
  phase: string;
  ready: boolean;
  /** Epoch millis of the transition into Ready; `undefined` while the pod is not ready. */
  readySince?: number;
  restarts: number;
  uid: string;
}

export interface KubernetesResourceList<T> {
  items: T[];
}

export interface KubernetesPodResource {
  metadata: { name: string; uid: string };
  spec?: {
    initContainers?: { name: string }[];
  };
  status?: {
    conditions?: { lastTransitionTime?: string; status: string; type: string }[];
    containerStatuses?: { ready: boolean; restartCount: number }[];
    phase?: string;
  };
}
