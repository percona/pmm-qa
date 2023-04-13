import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { pmmIntegrationClientName, pmmIntegrationDataName } from '../integration-setup';

const addClientMd = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} MariaDB with version ${parameters.versions.mariaDbVersion}`);
  const timeStamp = Date.now();
  const ps_port: number = 53306;
  const ps_password = 'GRgrO9301RuF';

  await executeCommand(`sudo docker pull mariadb:${parameters.versions.mariaDbVersion}`);
  for (let index = 0; index < numberOfClients; index++) {
    const containerName = `md-integration-${timeStamp}-${index}`;

    if (parameters.querySource === 'slowlog') {
      if (parameters.ci) {
        await executeCommand(`sudo mkdir /var/log/${containerName}/`);
        await executeCommand(`sudo touch /var/log/${containerName}/md_${index}_slowlog.log`);
        await executeCommand(`sudo chmod 777 /var/log/${containerName}/md_${index}_slowlog.log`);
      } else {
        await executeCommand(`sudo docker exec -u 0 ${pmmIntegrationClientName} mkdir /var/log/${containerName}/`);
        await executeCommand(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} touch /var/log/${containerName}/md_${index}_slowlog.log`,
        );
        await executeCommand(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} chmod 777 /var/log/${containerName}/md_${index}_slowlog.log`,
        );
      }
    }

    let volumeLocation;

    if (parameters.ci) {
      volumeLocation = `/var/log/${containerName}/`;
    } else {
      volumeLocation = pmmIntegrationDataName;
    }
  }
};

export default addClientMd;
