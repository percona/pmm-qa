export default interface SetupParameters {
  pgsqlVersion?: string;
  moVersion?: string;
  moSetup?: string;
  psVersion?: number;
  pmmClientVersion?: string;
  pmmServerVersion?: string;
  psmdbTarballURL?: string;
  querySource?: string;
  ci?: boolean;
};
