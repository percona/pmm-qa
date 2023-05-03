import SetupParameters from './setupParameters.interface';

const setDefaultVariables = async (parameters: SetupParameters) => {
  if (!parameters.pgsqlVersion) {
    parameters.pgsqlVersion = '15.0';
  }

  if (!parameters.pdpgsqlVersion) {
    parameters.pdpgsqlVersion = '15';
  }

  if (!parameters.moVersion) {
    parameters.moVersion = '6.0';
  }

  if (!parameters.psMoVersion) {
    parameters.psMoVersion = '6.0';
  }

  if (!parameters.moSetup) {
    parameters.moSetup = 'regular';
  }

  if (!parameters.psVersion) {
    parameters.psVersion = '8.0';
  }

  if (!parameters.pmmClientVersion) {
    parameters.pmmClientVersion = 'dev-latest';
  }

  if (!parameters.pmmServerVersion) {
    parameters.pmmServerVersion = 'dev-latest';
  }

  if (!parameters.psmdbTarballURL) {
    parameters.psmdbTarballURL = '';
  }

  if (!parameters.querySource) {
    parameters.querySource = 'perfschema';
  }

  if (!parameters.ci) {
    parameters.ci = false;
  }

  if (!parameters.versions?.pxcVersion) {
    parameters.versions.pxcVersion = parseFloat('8.0');
  }

  if (!parameters.versions.msVersion) parameters.versions.msVersion = '8.0';

  if (!parameters.serverPort) parameters.serverPort = 80;

  if (!parameters.secureServerPort) parameters.secureServerPort = 443;
};

export default setDefaultVariables;
