import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationClientName, pmmIntegrationDataMongoVolume } from '../integration-setup';

const addClientPsMoDB = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} Percona Server MongoDB's with version ${parameters.versions.psMoVersion}`);
  const port = 37017;
  const password = 'GRgrO9301RuF';
  const timeStamp = Date.now();

  await executeCommand(`sudo docker pull percona/percona-server-mongodb:${parameters.versions.psMoVersion}`);

  for (let index = 0; index < numberOfClients; index++) {
    const clientPort = port + index;
    const containerName = `mo-ps-integration-${index}-${timeStamp}`;
    let volumeLocation;
    let serviceAddress;
    let prefix;

    if (parameters.ci) {
      volumeLocation = '/tmp/';
      serviceAddress = `127.0.0.1:${clientPort}`;
      prefix = 'sudo';
    } else {
      volumeLocation = pmmIntegrationDataMongoVolume;
      serviceAddress = `${containerName}:27017`;
      prefix = `sudo sudo docker exec -u 0 ${pmmIntegrationClientName} `;
    }

    await executeCommand(`${prefix} mkdir -p /tmp/mo-ps-integration-${clientPort}/`);
    await executeCommand(`${prefix} chmod -R 0777 /tmp/mo-ps-integration-${clientPort}`);

    await executeCommand(
      `sudo sudo docker run -d -p ${clientPort}:27017 \
      -v ${volumeLocation}:/tmp/ \
      --network="${dockerNetworkName}" \
      -e MONGO_INITDB_ROOT_USERNAME=mongoadmin \
      -e MONGO_INITDB_ROOT_PASSWORD=${password} \
      -e UMASK=0777 \
      --name ${containerName} percona/percona-server-mongodb:${parameters.versions.psMoVersion} \
      --unixSocketPrefix /tmp/mo-ps-integration-${clientPort}
      --profile 2`,
    );
    await executeCommand('sleep 20');

    if (parameters.versions.psMoVersion && parseFloat(parameters.versions.psMoVersion) >= 5) {
      await executeCommand(`sudo docker cp ./mongoDb/mongodb_user_setup.js ${containerName}:/`);
      await executeCommand(`sudo docker exec -u 0  ${containerName} mongosh -u mongoadmin -p ${password} mongodb_user_setup.js`);
    } else {
      await executeCommand(`sudo docker cp ./mongoDb/mongodb_user_setup.js ${containerName}:/`);
      await executeCommand(`sudo docker exec -u 0  ${containerName} mongo -u mongoadmin -p ${password} mongodb_user_setup.js`);
    }

    if (parameters.useSocket) {
      await executeCommand(`${prefix} chmod -R 0777 /tmp/mo-ps-integration-${clientPort}/mongodb-27017.sock`);
      if (parameters.metricsMode) {
        await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --metrics-mode=${parameters.metricsMode} \
        --environment=modb-prod ${containerName} --socket=/tmp/mo-ps-integration-${clientPort}/mongodb-27017.sock --debug`);
      } else {
        await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --environment=modb-prod ${containerName} \
        --socket=/tmp/mo-ps-integration-${clientPort}/mongodb-27017.sock --debug`);
      }
    } else if (parameters.metricsMode) {
      await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --metrics-mode=${parameters.metricsMode} \
        --environment=modb-prod ${containerName} --debug ${serviceAddress}
        `);
    } else {
      await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --environment=modb-prod ${containerName} --debug ${serviceAddress}
        `);
    }
  }
};

export default addClientPsMoDB;
