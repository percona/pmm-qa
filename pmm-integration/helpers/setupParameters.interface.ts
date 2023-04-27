export default interface SetupParameters {
  pgsqlVersion?: string;
  pdpgsqlVersion?: string;
  moVersion?: string;
  psMoVersion?: string;
  moSetup?: string;
  psVersion?: string;
  pmmClientVersion?: string;
  upgradePmmClientVersion?: string;
  pmmServerVersion?: string;
  pmmServerVersions?: PMMVersions;
  psmdbTarballURL?: string;
  querySource?: string;
  metricsMode?: string;
  ci?: boolean;
  useSocket?: boolean;
  rbac?: boolean;
  pmmServerDockerTag?: string;
  setupTarballDocker?: boolean;
  versions: Versions;
}

export interface PMMVersions {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
}

export interface Versions {
  pxcVersion?: number;
}
