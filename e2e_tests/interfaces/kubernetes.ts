export interface KubernetesPod {
  images: string[];
  name: string;
  ready: boolean;
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

export interface KubernetesPodResource {
  metadata: { name: string };
  spec?: { containers?: { image: string }[] };
  status?: {
    conditions?: { status: string; type: string }[];
  };
}
