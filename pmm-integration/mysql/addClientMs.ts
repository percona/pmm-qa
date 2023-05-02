import { executeCommand, executeCommandLogResponse } from '../helpers/commandLine';
import SetupParameters from '../helpers/setupParameters.interface';
import {
  dockerNetworkName,
  pmmIntegrationClientName,
  pmmIntegrationDataName,
  pmmIntegrationServerName,
} from '../integration-setup';

const addClientMs = async (parameters: SetupParameters, numberOfClients: number) => {
  console.log(`Installing ${numberOfClients} MySql version ${parameters.versions.msVersion}`);
  const timeStamp = Date.now();
  const ms_port: number = 33306;
  const ms_password = 'GRgrO9301RuF';
  let response: string = '';
  const containerNameFormat = (index: number) => `ms-integration-${index}-${parameters.versions.msVersion?.replace('.', '-')}-${timeStamp}`;

  await executeCommandLogResponse(`sudo docker pull mysql:${parameters.versions.msVersion}`, response);
  // Start requested number of Percona Server containers
  for (let index = 0; index < numberOfClients; index++) {
    const containerName = containerNameFormat(index);
    const slowLogName = `ms_${index}_slowlog.log`;

    if (parameters.querySource === 'slowlog') {
      if (parameters.ci) {
        await executeCommandLogResponse(`sudo mkdir /var/log/${containerName}/`, response);
        await executeCommandLogResponse(`sudo touch /var/log/${containerName}/${slowLogName}`, response);
        await executeCommandLogResponse(`sudo chmod 777 /var/log/${containerName}/${slowLogName}`, response);
      } else {
        await executeCommandLogResponse(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} mkdir /var/log/${containerName}/`,
          response,
        );
        await executeCommandLogResponse(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} touch /var/log/${containerName}/${slowLogName}`,
          response,
        );
        await executeCommandLogResponse(
          `sudo docker exec -u 0 ${pmmIntegrationClientName} chmod 777 /var/log/${containerName}/${slowLogName}`,
          response,
        );
      }
    }

    let volumeLocation;

    if (parameters.ci) {
      volumeLocation = `/var/log/${containerName}/`;
    } else {
      volumeLocation = pmmIntegrationDataName;
    }

    await executeCommandLogResponse(
      `sudo docker run -d --name ${containerName} -v ${volumeLocation}:/var/log/${containerName}/ -p ${ms_port + index}:3306 
      -e MYSQL_ROOT_PASSWORD=${ms_password} -e UMASK=0777 mysql:${parameters.versions.msVersion}
       --character-set-server=utf8 --default-authentication-plugin=mysql_native_password --collation-server=utf8_unicode_ci`,
      response,
    );
  }

  await executeCommandLogResponse('sleep 30', response);

  for (let index = 0; index < numberOfClients; index++) {
    const containerName = containerNameFormat(index);
    const slowLogName = `ms_${index}_slowlog.log`;
    /*
        await executeCommandLogResponse(
          `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e "SET GLOBAL userstat=1;"`,
          response,
        ); */

    await executeCommandLogResponse(
      `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e "SET GLOBAL innodb_monitor_enable=all;"`,
      response,
    );
    /*
    await executeCommandLogResponse(
      `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
      "ALTER USER 'root'@'localhost' IDENTIFIED BY '${ms_password}';"`,
      response,
    );
    // WITH mysql_native_password
*/
    if (parameters.querySource !== 'perfschema') {
      await executeCommandLogResponse(
        `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e "SET GLOBAL slow_query_log='ON';"`,
        response,
      );
      await executeCommandLogResponse(`sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
      "SET GLOBAL long_query_time=0;"`, response);
      await executeCommandLogResponse(
        `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
        "SET GLOBAL log_slow_rate_limit=1;"`, response,
      );
      await executeCommandLogResponse(
        `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
        "SET GLOBAL log_slow_admin_statements=ON;"`, response,
      );
      await executeCommandLogResponse(
        `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
        "SET GLOBAL log_slow_slave_statements=ON;"`, response,
      );
      if (parseFloat(parameters.versions.msVersion!) < 8) {
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e \
          "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"`,
        );
        await executeCommand(
          `sudo docker exec ${containerName} mysql -u root -p${ms_password} -e "SET GLOBAL query_response_time_stats=ON;"`,
        );
      }

      await executeCommand(
        `sudo docker exec ${containerName} mysql -u root -p${ms_password} \
        -e "SET GLOBAL slow_query_log_file='/var/log/${containerName}/${slowLogName}';"`,
      );
      // Connect MySql to the PMM-Client with query source slowlog.
      await executeCommand(`sudo docker network connect ${dockerNetworkName} ${containerName}`);
      if (parameters.ci) {
        await executeCommand(
          `sudo pmm-admin add mysql --query-source=slowlog --size-slow-logs=1GiB --username=root \
          --password=${ms_password} ${containerName} --host=127.0.0.1 --port=${ms_port + index}`,
        );
      } else {
        await executeCommand(
          `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mysql --query-source=slowlog \
          --size-slow-logs=1GiB --username=root --password=${ms_password} ${containerName} \
          --host=${containerName} --port=3306`,
        );
      }
    } else {
      // Connect MySql to the PMM-Client with query source perfschema.
      await executeCommand(`sudo docker network connect ${dockerNetworkName} ${containerName}`);
      if (parameters.ci) {
        await executeCommand(
          `sudo pmm-admin add mysql --query-source=perfschema --username=root --password=${ms_password} \
          ${containerName} --host=127.0.0.1 --port=${ms_port + index}`,
        );
      } else {
        await executeCommand(
          `sudo docker exec ${pmmIntegrationClientName} pmm-admin add mysql --query-source=perfschema \
          --username=root --password=${ms_password} ${containerName} --host=${containerName} --port=3306`,
        );
      }
    }
  }
};

export default addClientMs;
