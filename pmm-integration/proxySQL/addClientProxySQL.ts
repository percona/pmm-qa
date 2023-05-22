import SetupParameters from '../helpers/setupParameters.interface';

const addClientProxySQL = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} ProxySQL database(s), with version ${parameters.proxySQLVersion}.`);
  for (let index: number = 0; index < numberOfClients; index++) {
    const containerName = `proxySql-${index}`;
    const port = 42100 + index;
  }
};

export default addClientProxySQL;
