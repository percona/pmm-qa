import * as core from '@actions/core';
import { executeAnsiblePlaybook, executeCommand, executeCommandIgnoreErrors } from '../../helpers/commandLine';
import SetupParameters from '../../helpers/setupParameters.interface';

const setup_pmm_pgsm_integration = async (parameters: SetupParameters) => {
  console.log('Install Ansible');
  await executeCommand('sudo yum install -y ansible');
  const pmmServerContainer = await executeCommand(
    'echo $(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep \'pmm-server\' | awk \'{print $3}\')',
  );

  console.log('Create Network');
  await executeCommandIgnoreErrors('sudo docker network create pmm-qa');
  await executeCommandIgnoreErrors(`sudodocker network connect ${pmmServerContainer}`);
  console.log('Run Ansible Playbook.');
  console.log(
    await executeAnsiblePlaybook(
      'ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml',
    ),
  );
};

export default setup_pmm_pgsm_integration;
