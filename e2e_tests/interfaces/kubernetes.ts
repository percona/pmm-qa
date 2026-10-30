export interface KubernetesPod {
  images: string[];
  name: string;
  ready: boolean;
  /** Summed over the pod's containers. */
  restarts: number;
}

export interface VolumeUsage {
  availableMb: number;
  /** kubelet's formula, the one PMM alerts on; df's own Capacity column divides by used + available instead. */
  percentFull: number;
  sizeMb: number;
  usedMb: number;
}

export interface KubernetesResourceList<T> {
  items: T[];
}

export type KubernetesJobState = 'Complete' | 'Failed' | 'Running';

export interface KubernetesJobResource {
  status?: {
    conditions?: { status: string; type: string }[];
  };
}

export interface KubernetesPodResource {
  metadata: { name: string };
  spec?: { containers?: { image: string }[] };
  status?: {
    conditions?: { status: string; type: string }[];
    containerStatuses?: { restartCount: number }[];
  };
}

export interface KubernetesEventResource {
  message?: string;
}
