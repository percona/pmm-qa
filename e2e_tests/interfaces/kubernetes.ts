export interface KubernetesPod {
  images: string[];
  name: string;
  ready: boolean;
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
