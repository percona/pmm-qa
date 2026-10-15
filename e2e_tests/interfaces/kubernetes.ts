export interface KubernetesPod {
  images: string[];
  name: string;
  ready: boolean;
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
  };
}
