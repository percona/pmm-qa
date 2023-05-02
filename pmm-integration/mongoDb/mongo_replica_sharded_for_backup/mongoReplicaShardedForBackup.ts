import { executeCommand } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationClientName } from '../../integration-setup';
import setupCluster from '../mongo_replica_for_backup/setupCluster';

const mongoReplicaShardedForBackup = async (parameters: SetupParameters, numberOfNodes: number = 3) => {
  console.log('Setting up Mongo with sharded replica set and backup.');
  const prefix = parameters.ci ? 'sudo' : `sudo docker exec -u 0 ${pmmIntegrationClientName}`;
  const dockerTag = `percona/percona-server-mongodb:${parameters.moVersion}`;
  const containerNameSet101 = (index: number) => `mo-replica-set-101-integration-${index}`;
  const containerNameSet201 = (index: number) => `mo-replica-set-201-integration-${index}`;
  const containerNameSetConfiguration = (index: number) => `mo-replica-set-configuration-integration-${index}`;
  const containerNameMaster = 'mo-replica-set-mongos';
  let mongoPortSet101 = 57017;
  let mongoPortSet201 = 57117;
  let mongoPortSetConfiguration = 57217;
  const mongoPortMaster = 57317;

  for (let index = 0; index < numberOfNodes; index++) {
    mongoPortSet101 += index;

    await executeCommand(
      `sudo sudo docker run -d -p ${mongoPortSet101}:27017 \
      --network="${dockerNetworkName}" \
      --name ${containerNameSet101(index)} ${dockerTag} \
      /usr/bin/mongod --replSet rs0 \
      --bind_ip_all \
      --profile 2 
      `,
    );
  }


  await executeCommand('sleep 5');

  await executeCommand(`sudo docker cp ./mongoDb/mongo_replica_sharded_for_backup/setup-replica_cluser_101.js 
    ${containerNameSet101(0)}:/`);

  await executeCommand(`sudo docker cp ./mongoDb/mongo_replica_sharded_for_backup/setupReplicaUsers.js 
    ${containerNameSet101(0)}:/`);

  await executeCommand(`sudo docker exec -u 0 ${containerNameSet101(0)} mongosh setup-replica_cluser_101.js`);
  await executeCommand(`sudo docker exec -u 0 ${containerNameSet101(0)} mongosh setupReplicaUsers.js`);

  for (let index = 0; index < numberOfNodes; index++) {
    mongoPortSet201 += index;

    await executeCommand(
      `sudo sudo docker run -d -p ${mongoPortSet201}:27017 \
      --network="${dockerNetworkName}" \
      --name ${containerNameSet201(index)} ${dockerTag} \
      /usr/bin/mongod --replSet rs1 \
      --bind_ip_all \
      --profile 2 
      `,
    );
  }

  await executeCommand(`sudo docker cp ./mongoDb/mongo_replica_sharded_for_backup/setup-replica_cluser_201.js 
  ${containerNameSet201(0)}:/`);

  await executeCommand(`sudo docker cp ./mongoDb/mongo_replica_sharded_for_backup/setupReplicaUsers.js 
  ${containerNameSet201(0)}:/`);

  await executeCommand(`sudo docker exec -u 0 ${containerNameSet201(0)} mongosh setup-replica_cluser_201.js`);
  await executeCommand(`sudo docker exec -u 0 ${containerNameSet201(0)} mongosh setupReplicaUsers.js`);

  for (let index = 0; index < numberOfNodes; index++) {
    mongoPortSetConfiguration += index;

    await executeCommand(
      `sudo sudo docker run -d -p ${mongoPortSetConfiguration}:27017 \
      --network="${dockerNetworkName}" \
      --name ${containerNameSetConfiguration(index)} ${dockerTag} \
      /usr/bin/mongod --replSet rsConfig \
      --bind_ip_all \
      --profile 2 
      `,
    );
  }

  await executeCommand(`sudo docker cp ./mongoDb/mongo_replica_sharded_for_backup/setup-replica_cluser_config.js
  ${containerNameSetConfiguration(0)}:/`);

  await executeCommand(`sudo docker exec -u 0 ${containerNameSetConfiguration(0)} mongosh setup-replica_cluser_config.js`);

  await executeCommand(
    `sudo sudo docker run -d -p ${mongoPortMaster}:27017 \
    --network="${dockerNetworkName}" \
    --name ${containerNameMaster} ${dockerTag} \
    /usr/bin/mongos --configdb rsConfig/mongo-replica-set-configuration-integration-0:27017,mongo-replica-set-configuration-integration-1:27017,mongo-replica-set-configuration-integration-2:27017 \
    /usr/bin/mongod --keyFile=/etc/keyfile \
    --bind_ip_all \
    --profile 2 
    `,
  );

  for (let index = 0; index < numberOfNodes; index++) {
    await executeCommand(`sudo docker exec -u 0 ${containerNameSet101(index)} \
    /bin/bash -c "percona-release enable pbm release && yum -y install percona-backup-mongodb"`);
    await executeCommand(`sudo docker exec -d -u 0 ${containerNameSet101(index)} \
    /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27017" pbm-agent'`);

    // Connect mongo databases to the client
    await executeCommand(
      `${prefix} pmm-admin add mongodb --service-name=${containerNameSet101(index)} \
      --host=${parameters.ci ? '127.0.0.1' : containerNameSet101(index)} --port=${parameters.ci ? mongoPortSet101 : 27017} --cluster=rs0`,
    );
  }

  for (let index = 0; index < numberOfNodes; index++) {
    await executeCommand(`sudo docker exec -u 0 ${containerNameSet201(index)} \
    /bin/bash -c "percona-release enable pbm release && yum -y install percona-backup-mongodb"`);
    await executeCommand(`sudo docker exec -d -u 0 ${containerNameSet201(index)} \
    /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27017" pbm-agent'`);

    await executeCommand(`sudo docker exec -u 0 ${containerNameMaster} mongosh 'db.runCommand({"addShard": ["rs0/mo-replica-set-101-integration-0:27017", "mo-replica-set-101-integration-1:27017", "mo-replica-set-101-integration-0:27017"]})'`);
    await executeCommand(`sudo docker exec -u 0 ${containerNameMaster} mongosh 'db.runCommand({"addShard": ["rs1/mo-replica-set-201-integration-0:27017", "mo-replica-set-201-integration-1:27017", "mo-replica-set-201-integration-0:27017"]})'`);

    // Connect mongo databases to the client
    await executeCommand(
      `${prefix} pmm-admin add mongodb --service-name=${containerNameSet201(index)} \
      --host=${parameters.ci ? '127.0.0.1' : containerNameSet201(index)} --port=${parameters.ci ? mongoPortSet201 : 27017} --cluster=rs1`,
    );
  }
};

export default mongoReplicaShardedForBackup;
