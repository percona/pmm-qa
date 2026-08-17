export interface KubernetesPod {
  containersReady: number;
  containersTotal: number;
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
}

export interface KubernetesResourceList<T> {
  items: T[];
}

export interface KubernetesPodResource {
  metadata: { name: string };
  status?: {
    conditions?: { status: string; type: string }[];
    containerStatuses?: { ready: boolean; restartCount: number }[];
    phase?: string;
  };
}
