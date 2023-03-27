import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';

const pmm2ClientLocalUpgrade = async (parameters: SetupParameters) => {
  let downloadUrl = '';

  if (parameters.pmmClientVersion?.includes('http')) {
    // eslint-disable-next-line max-len
    downloadUrl = `https://downloads.percona.com/downloads/pmm2/${parameters.pmmClientVersion}/binary/tarball/pmm2-client-${parameters.pmmClientVersion}.tar.gz`;
  } else {
    downloadUrl = parameters.pmmClientVersion!;
  }

  await executeCommand(`wget -O pmm2-client.tar.gz --progress=dot:giga ${downloadUrl}`);
  await executeCommand('tar -zxpf pmm2-client.tar.gz');
  await executeCommand('rm -r pmm2-client.tar.gz');
  const clientLocation = (await executeCommand('ls -1td pmm2-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1')).stdout;

  console.log(`Client location is: ${clientLocation}`);
  await executeCommand(`mv ${clientLocation} pmm2-client`);
  await executeCommand('mv pmm2-client /usr/local/bin');
  await executeCommand('pushd /usr/local/bin/pmm2-client');
  await executeCommand('bash -x ./install_tarball -u');
  console.log(await executeCommand('pmm-admin --version'));
};

export default pmm2ClientLocalUpgrade;
