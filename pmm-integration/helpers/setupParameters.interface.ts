export default interface SetupParameters {
  pgsqlVersion?: string;
  pdpgsqlVersion?: string;
  moVersion?: number;
  moSetup?: string;
  psVersion?: number;
  proxySQLVersion?: number;
  pmmClientVersion?: string;
  pmmServerVersion?: string;
  pmmServerVersions?: PMMVersions;
  pmmServerPassword?: string;
  pmmServerIp?: string;
  psmdbTarballURL?: string;
  querySource?: string;
  metricsMode?: string;
  ci?: boolean;
  useSocket?: boolean;
  rbac?: boolean;
  pmmServerDockerTag?: string;
}

export interface PMMVersions {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
}
