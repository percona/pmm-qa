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
