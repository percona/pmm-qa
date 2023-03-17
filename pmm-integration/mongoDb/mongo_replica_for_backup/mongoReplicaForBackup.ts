import { executeCommand } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationClientName } from '../../integration-setup';

const MongoReplicaForBackup = async (parameters: SetupParameters) => {
  if (!parameters.ci) {
    // Connect all mongodb instances to integration network
    await executeCommand(`sudo docker network connect ${dockerNetworkName} mongors1`);
    await executeCommand(`sudo docker network connect ${dockerNetworkName} mongors2`);
    await executeCommand(`sudo docker network connect ${dockerNetworkName} mongors3`);
    await executeCommand('sleep 5 ');
    // Connect mongo databases to the client
    await executeCommand(
      `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mongodb \
      --service-name=mongo1 --host=mongors1 --port=27027 --cluster=rs0`,
    );
    await executeCommand(
      `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mongodb \
      --service-name=mongo2 --host=mongors2 --port=27028 --cluster=rs0`,
    );
    await executeCommand(
      `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mongodb \
      --service-name=mongo3 --host=mongors3 --port=27029 --cluster=rs0`,
    );
  }
};

export default MongoReplicaForBackup;
