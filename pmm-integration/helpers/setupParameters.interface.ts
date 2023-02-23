export default interface SetupParameters {
  pgsqlVersion?: string;
  pdpgsqlVersion?: string;
  moVersion?: string;
  moSetup?: string;
  psVersion?: number;
  pmmClientVersion?: string;
  pmmServerVersion?: string;
  pmmServerVersions?: PMMVersions;
  psmdbTarballURL?: string;
  querySource?: string;
  metricsMode?: string;
  ci?: boolean;
  rbac?: boolean;
};

export interface PMMVersions {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
}
