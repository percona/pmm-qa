export interface KubernetesPod {
  images: string[];
  name: string;
  /** False while the pod is terminating: kubelet keeps its Ready condition until the containers exit. */
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
  metadata: { deletionTimestamp?: string; name: string; ownerReferences?: { kind: string }[]; uid: string };
  spec?: { containers?: { image: string }[] };
  status?: {
    conditions?: { status: string; type: string }[];
    containerStatuses?: { restartCount: number }[];
  };
}

export interface KubernetesEventResource {
  message?: string;
}
