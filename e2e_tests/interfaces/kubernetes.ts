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

export interface KubernetesStatefulSetResource {
  spec: {
    replicas: number;
    serviceName: string;
    template: { spec: { containers: { env?: { name: string; value?: string }[]; name: string }[] } };
  };
}
