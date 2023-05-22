import os from 'os';
import { executeCommand, executeCommandIgnoreErrors } from '../helpers/commandLine';
import { stopAndRemoveContainer } from '../helpers/docker';
import {
  pmmIntegrationClientName, pmmIntegrationDataMongoVolume, pmmIntegrationDataName, pmmIntegrationServerName,
} from '../integration-setup';

const clearAllSetups = async () => {
  await stopAndRemoveContainer('external_service_container');
  await stopAndRemoveContainer('redis_container');
  const runningContainers: string[] = (await executeCommand('sudo docker container ls -a --format "{{.Names}}"')).stdout.split(
    os.EOL,
  );

  runningContainers.forEach(async (container) => {
    if (
      container.includes('ps_integration')
      || container.includes('pdpgsql-integration')
      || container.includes('pgsql_vacuum_db')
      || container.includes('pgsql_pgss')
      || container.includes('psmdb')
      || container.includes('mongodb_load')
      || container.includes('HAPROXY')
      || container.includes('pgsql_pgsm')
      || container.includes('mongors')
      || container.includes('mo-integration')
      || container.includes('mo-ps-integration')
      || container.includes('haproxy-')
      || container.includes('pxc-')
    ) {
      await stopAndRemoveContainer(container);
    }
  });
  await stopAndRemoveContainer(pmmIntegrationClientName);
  await stopAndRemoveContainer(pmmIntegrationServerName);
  await executeCommandIgnoreErrors(`sudo docker volume rm ${pmmIntegrationDataName}`);
  await executeCommandIgnoreErrors(`sudo docker volume rm ${pmmIntegrationDataMongoVolume}`);
};

export default clearAllSetups;
