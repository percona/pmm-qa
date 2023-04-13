import pmm2ClientLocalUpgrade from '../pmmClient/pmm2LocalClientUpgrade';
import SetupParameters from './setupParameters.interface';

const parseFlags = async (args: string[], parameters: SetupParameters) => {
  // eslint-disable-next-line no-restricted-syntax
  for await (const [_index, value] of args.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        parameters.pgsqlVersion = value.split('=')[1];
        break;
      case value.includes('--pdpgsql-version'):
        parameters.pdpgsqlVersion = value.split('=')[1];
        break;
      case value.includes('--mo-version'):
        parameters.moVersion = parseFloat(value.split('=')[1]);
        break;
      case value.includes('--ps-version'):
        parameters.psVersion = parseFloat(value.split('=')[1]);
        break;
      case value.includes('--pmm-client-version'):
        parameters.pmmClientVersion = value.split('=')[1];
        break;
      case value.includes('--upgrade-pmm-client-version'):
        parameters.upgradePmmClientVersion = value.split('=')[1];
        await pmm2ClientLocalUpgrade(parameters);
        break;
      case value.includes('--pmm-server-version'):
        const pmmServerVersion = value.split('=')[1];

        if (pmmServerVersion.length > 0) {
          parameters.pmmServerVersions = {
            versionMajor: parseInt(pmmServerVersion.split('.')[0], 10),
            versionMinor: parseInt(pmmServerVersion.split('.')[1], 10),
            versionPatch: parseInt(pmmServerVersion.split('.')[2], 10),
          };
        }

        parameters.pmmServerVersion = value.split('=')[1];
        break;
      case value.includes('--query-source'):
        parameters.querySource = value.split('=')[1];
        break;
      case value.includes('--ci'):
        parameters.ci = true;
        break;
      case value.includes('--use-socket'):
        parameters.useSocket = true;
        break;
      case value.includes('--rbac'):
        parameters.rbac = true;
        break;
      case value.includes('--pmm-server-docker-tag'):
        parameters.pmmServerDockerTag = value.split('=')[1];
        break;
      case value.includes('--setup-tarball-docker'):
        parameters.setupTarballDocker = true;
        break;
      case value.includes('--pxc-version'):
        parameters.versions.pxcVersion = parseFloat(value.split('=')[1]);
        break;
      case value.includes('--md-version'):
        parameters.versions.mariaDbVersion = parseFloat(value.split('=')[1]);
        break;
      default:
        break;
    }
  }
};

export default parseFlags;
