import { executeAnsiblePlaybook, executeCommand, executeCommandIgnoreErrors } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';

const setup_pmm_pgsm_integration = async (parameters: SetupParameters) => {
    const pmmServerContainer = await executeCommand(`echo $(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')`)
    await executeCommandIgnoreErrors('docker network create pmm-qa')
    pmmServerContainer?.stdout.trim().split(' ').forEach(async (container) => {
        await executeCommandIgnoreErrors(`docker network connect ${container}`)
    })
    await executeAnsiblePlaybook('ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml')
}

export default setup_pmm_pgsm_integration;
