import { executeCommand } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationClientName } from '../../integration-setup';

const mongoReplicaForBackup = async (parameters: SetupParameters, numberOfNodes: number = 3) => {
  console.log('Setting up Mongo with replica set and backup.');
  const prefix = parameters.ci ? 'sudo' : `sudo docker exec -u 0 ${pmmIntegrationClientName}`;
  let mo_port = 47017;
  const containerName = (index: number) => `mo-replica-integration-${index}`;
  const dockerTag = `percona/percona-server-mongodb:${parameters.moVersion}`;

  for (let index = 0; index < numberOfNodes; index++) {
    mo_port += index;

    await executeCommand(
      `sudo sudo docker run -d -p ${mo_port}:27017 \
      --network="${dockerNetworkName}" \
      --name ${containerName(index)} ${dockerTag} \
      /usr/bin/mongod --replSet rs0 \
      --bind_ip_all \
      --profile 2 
      `,
    );
  }

  await executeCommand('sleep 5');
  await executeCommand(`sudo docker cp ./mongoDb/mongo_replica_for_backup/setup-replica.js ${containerName(0)}:/`);
  await executeCommand(`sudo docker exec -u 0 ${containerName(0)} mongosh setup-replica.js`);

  for (let index = 0; index < numberOfNodes; index++) {
    await executeCommand(`sudo docker exec -u 0 ${containerName(index)} \
    /bin/bash -c "percona-release enable pbm release && yum -y install percona-backup-mongodb"`);
    await executeCommand(`sudo docker exec -d -u 0 ${containerName(index)} \
    /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27017" pbm-agent'`);

    // Connect mongo databases to the client
    await executeCommand(
      `${prefix} pmm-admin add mongodb --service-name=${containerName(index)} \
      --host=${parameters.ci ? '127.0.0.1' : containerName(index)} --port=${parameters.ci ? mo_port : 27017} --cluster=rs0`,
    );
  }
};

export default mongoReplicaForBackup;
