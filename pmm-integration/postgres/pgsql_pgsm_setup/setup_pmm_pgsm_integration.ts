import { executeAnsiblePlaybook, executeCommand, executeCommandIgnoreErrors, setEnvVariable } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';
import * as core from '@actions/core';

const setup_pmm_pgsm_integration = async (parameters: SetupParameters) => {

    await setEnvVariable("PGSQL_PGSM_CONTAINER", `pgsql_pgsm_${process.env['PGSQL_VERSION']}`);
    core.exportVariable('PGSQL_PGSM_CONTAINER', `pgsql_pgsm_${process.env['PGSQL_VERSION']}`);

    await setEnvVariable("PMM_SERVER_IP", `127.0.0.1`);
    core.exportVariable('PMM_SERVER_IP', `127.0.0.1`);

    await setEnvVariable("CLIENT_VERSION", `dev-latest`);
    core.exportVariable('CLIENT_VERSION', `dev-latest`);


    const pmmServerContainer = await executeCommand(`echo $(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')`)
    await executeCommandIgnoreErrors('docker network create pmm-qa')
    await executeCommandIgnoreErrors(`docker network connect ${pmmServerContainer}`)
    console.log(await executeCommand('ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml'))

}

export default setup_pmm_pgsm_integration;
