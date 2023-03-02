import { executeCommand } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import { dockerNetworkName, pmmIntegrationClientName, pmmIntegrationDataMongoVolume } from '../integration-setup';

const addClientMoDB = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} MongoDB's with version ${parameters.moVersion}`);
  const port = 27017;
  const password = 'GRgrO9301RuF';
  const timeStamp = Date.now();

  await executeCommand(`docker pull mongo:${parameters.moVersion}`);

  for (let index = 0; index < numberOfClients; index++) {
    const clientPort = port + index;
    const containerName = `mo-integration-${timeStamp}-${index}`;
    let volumeLocation;

    if (parameters.ci) {
      volumeLocation = '/tmp/';
    } else {
      volumeLocation = pmmIntegrationDataMongoVolume;
    }

    const prefix = parameters.ci ? 'sudo ' : `sudo docker exec  -u 0 ${pmmIntegrationClientName} `;

    await executeCommand(`${prefix} mkdir -p /tmp/mo-integration-${clientPort}/`);
    await executeCommand(`${prefix} chmod -R 0777 /tmp/mo-integration-${clientPort}`);

    await executeCommand(
      `sudo docker run -d -p ${clientPort}:27017 \
      -v ${volumeLocation}:/tmp/ \
      --network="${dockerNetworkName}" \
      -e MONGO_INITDB_ROOT_USERNAME=mongoadmin \
      -e MONGO_INITDB_ROOT_PASSWORD=${password} \
      -e UMASK=0777 \
      --name ${containerName} mongo:${parameters.moVersion} \
      --unixSocketPrefix /tmp/mo-integration-${clientPort}
      --profile 2`,
    );
    await executeCommand('sleep 20');

    await executeCommand(`sudo docker logs ${containerName}`);

    if (parameters.moVersion && parameters.moVersion >= 5) {
      await executeCommand(`sudo docker cp ./mongoDb/mongodb_user_setup.js ${containerName}:/`);
      await executeCommand(`sudo docker exec -u 0  ${containerName} mongosh -u mongoadmin -p ${password} mongodb_user_setup.js`);
    } else {
      await executeCommand(`sudo docker cp ./mongoDb/mongodb_user_setup.js ${containerName}:/`);
      await executeCommand(`sudo docker exec -u 0  ${containerName} mongo -u mongoadmin -p ${password} mongodb_user_setup.js`);
    }

    if (parameters.useSocket) {
      await executeCommand(`${prefix} chmod -R 0777 /tmp/mo-integration-${clientPort}/mongodb-27017.sock`);
      if (parameters.metricsMode) {
        await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --metrics-mode=${parameters.metricsMode} \
        --environment=modb-prod ${containerName} --socket=/tmp/mo-integration-${clientPort}/mongodb-27017.sock --debug`);
      } else {
        await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --environment=modb-prod ${containerName} \
        --socket=/tmp/mo-integration-${clientPort}/mongodb-27017.sock --debug`);
      }
    } else if (parameters.metricsMode) {
      await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --metrics-mode=${parameters.metricsMode} \
        --environment=modb-prod ${containerName} --debug ${containerName}:27017
        `);
    } else {
      await executeCommand(`${prefix} pmm-admin add mongodb --cluster=${containerName} \
        --username=mongoadmin --password=${password} --environment=modb-prod ${containerName} --debug ${containerName}:27017
        `);
    }
  }
};

export default addClientMoDB;
