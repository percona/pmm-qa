export default interface SetupParameters {
  pgsqlVersion?: string;
  moVersion?: string;
  moSetup?: string;
  psVersion?: number;
  pmmClientVersion?: string;
  pmmServerVersion?: string;
  pmmServerVersions?: PMMVersions;
  psmdbTarballURL?: string;
  querySource?: string;
  ci?: boolean;
};

export interface PMMVersions {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
}
