import { executeAnsiblePlaybook, executeCommand, setEnvVariable } from "./helpers/commandLine";
import SetupParameters from "./helpers/setupParameters.interface";
import pgsqlVacuumSetup from "./postgres/pgsql-vacuum-setup";
import setup_pmm_pgsm_integration from "./postgres/pgsql_pgsm_setup/setup_pmm_pgsm_integration";
import * as core from '@actions/core';

export interface SetupsInterface {
  arg: string;
  description: string;
  function: (parameters: SetupParameters) => Promise<void>;
}

export const availableSetups: SetupsInterface[] = [
  {
    arg: '--setup-pgsql-vacuum',
    description: 'Use this do setup postgres for vacuum monitoring tests',
    function: async (parameters: SetupParameters) => {
      await pgsqlVacuumSetup(parameters);
      await setEnvVariable('INTEGRATION_FLAG', '@pgsql_vacuum');
      core.exportVariable('INTEGRATION_FLAG', '@pgsql_vacuum');
    },
  },
  {
    arg: '--setup-pmm-pgsm-integration',
    description: 'Use this option to setup PMM-Client with PGSM for integration testing',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./postgres/pgsql_pgsm_setup/setup_pmm_pgsm_integration.sh');
      //await setup_pmm_pgsm_integration(parameters)
      await executeCommand('sudo ./postgres/pgsql_pgsm_setup/setup_pmm_pgsm_integration.sh');
      await executeAnsiblePlaybook(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml -e="PGSQL_VERSION=${parameters.pgsqlVersion}"`)
      await setEnvVariable("INTEGRATION_FLAG", "@pgsm-pmm-integration");
    },
  },
  {
    arg: '--setup-pmm-pgss-integration',
    description: 'Use this option to setup PMM-Client with PG Stat Statements for Integration Testing',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./postgres/pgsql_pgss_setup/setup_pmm_pgss_integration.sh');
      await executeCommand('./postgres/pgsql_pgss_setup/setup_pmm_pgss_integration.sh');
      await executeAnsiblePlaybook(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgss_setup/pgsql_pgss_setup.yml -e="PGSQL_VERSION=${parameters.pgsqlVersion}"`)
      await setEnvVariable("INTEGRATION_FLAG", "@pgss-pmm-integration");
    },
  },
  {
    arg: '--setup-pmm-psmdb-integration',
    description: 'Use this option for Percona MongoDB setup with PMM2',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./mongoDb/mongo_psmdb_setup/setup_pmm_psmdb_integration.sh');
      await executeCommand('./mongoDb/mongo_psmdb_setup/setup_pmm_psmdb_integration.sh');
      await executeCommand('sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./mongoDb/mongo_psmdb_setup/psmdb_setup.yml');
      await setEnvVariable("INTEGRATION_FLAG", "@pmm-psmdb-integration");
    },
  },
  {
    arg: '--setup-pmm-haproxy-integration',
    description: 'Use this option for Haproxy setup with PMM2',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./otherConfigs/haproxy/pmm-haproxy-setup.sh');
      console.log(await executeCommand('./otherConfigs/haproxy/pmm-haproxy-setup.sh'));
      console.log(await executeCommand('ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./otherConfigs/haproxy/haproxy_setup.yml'));
      await setEnvVariable('INTEGRATION_FLAG', '@pmm-haproxy-integration');
      core.exportVariable('INTEGRATION_FLAG', '@pmm-haproxy-integration');
    }
  },
  {
    arg: '--setup-pmm-ps-integration',
    description: 'Use this option for percona-server and PMM using dbdeployer',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./mysql/pmm_ps_integration/pmm_ps_integration.sh');
      await executeCommand('./mysql/pmm_ps_integration/pmm_ps_integration.sh');
      await executeAnsiblePlaybook(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./mysql/pmm_ps_integration/ps_pmm_setup.yml -e="PS_VERSION=${parameters.psVersion}"`);
      await setEnvVariable("INTEGRATION_FLAG", "@pmm-ps-integration");
    },
  }
];

export const availableConstMap = new Map<string, string>([
  ['--pgsql-version', 'Pass Postgre SQL server version Info'],
  ['--mo-version', 'Pass MongoDB Server version info'],
  ['--setup-pmm-client-tarball', 'Sets up pmm client from provided tarball'],
]);

export const availableSetupMap = new Map(
  availableSetups.map((object) => {
    return [object.arg, object.description];
  })
);

export const availableArgsMap = new Map<string, string>([...availableConstMap, ...availableSetupMap]);

const availableCommandsLineArgs: string[] = Array.from(availableArgsMap.keys());

export default availableCommandsLineArgs;
