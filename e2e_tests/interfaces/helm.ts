/** One entry of `helm list --output json`; `revision` is a string in that JSON. */
export interface HelmRelease {
  app_version: string;
  chart: string;
  name: string;
  namespace: string;
  revision: string;
  status: string;
  updated: string;
}

export interface HelmUpgradeOptions {
  /** Server-side dry run: validates against the live release and records no revision. */
  dryRun?: boolean;
  timeout?: string;
}

/** The fields the replica tests read from one document of a rendered manifest. */
export interface RenderedResource {
  kind: string;
  name: string;
  replicas: number;
  serviceType?: string;
}
