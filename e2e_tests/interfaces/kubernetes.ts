export interface KubernetesPod {
  containersReady: number;
  containersTotal: number;
  images: string[];
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
  spec?: { containers?: { image: string }[] };
  status?: {
    conditions?: { status: string; type: string }[];
    containerStatuses?: { ready: boolean; restartCount: number }[];
    phase?: string;
  };
}
