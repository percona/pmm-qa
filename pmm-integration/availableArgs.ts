import { executeAnsiblePlaybook, executeCommand, installAnsibleInCI } from "./helpers/commandLine";
import SetupParameters from "./helpers/setupParameters.interface";
import pgsqlVacuumSetup from "./postgres/pgsql-vacuum-setup";
import * as core from '@actions/core';
import installDockerCompose from "./otherConfigs/installDockerCompose";
import clearAllSetups from "./otherConfigs/clearAllSetups";
import addClientPs from './mysql/addClientPs/addClientPs'

export interface SetupsInterface {
  arg: string;
  description: string;
  function: (parameters: SetupParameters, client?: string) => Promise<void>;
}

export const availableSetups: SetupsInterface[] = [
  {
    arg: '--addclient',
    description: 'Use this do setup postgres for vacuum monitoring tests',
    function: async (parameters: SetupParameters, client: string = "") => {
      let commandLineValue = client.split("=")[1];
      let selectedDB = commandLineValue.split(',')[0];
      let numberOfDbs: number = parseInt(commandLineValue.split(',')[1]);
      switch (true) {
        case selectedDB.includes('ps'):
          await addClientPs(parameters, numberOfDbs);
          break
        default:
          break
      }

    },
  },
  {
    arg: '--setup-pgsql-vacuum',
    description: 'Use this do setup postgres for vacuum monitoring tests',
    function: async (parameters: SetupParameters) => {
      await pgsqlVacuumSetup(parameters);
      core.exportVariable('INTEGRATION_FLAG', '@pgsql_vacuum');
    },
  },
  {
    arg: '--setup-pmm-pgsm-integration',
    description: 'Use this option to setup PMM-Client with PGSM for integration testing',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci)
      await executeAnsiblePlaybook(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml -e="PGSQL_VERSION=${parameters.pgsqlVersion} CLIENT_VERSION=${parameters.pmmClientVersion}"`)
      core.exportVariable("INTEGRATION_FLAG", "@pgsm-pmm-integration");
    },
  },
  {
    arg: '--setup-pmm-pgss-integration',
    description: 'Use this option to setup PMM-Client with PG Stat Statements for Integration Testing',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci)
      await executeAnsiblePlaybook(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./postgres/pgsql_pgss_setup/pgsql_pgss_setup.yml -e="PGSQL_VERSION=${parameters.pgsqlVersion} CLIENT_VERSION=${parameters.pmmClientVersion}"`)
      core.exportVariable("INTEGRATION_FLAG", "@pgss-pmm-integration");
    },
  },
  {
    arg: '--setup-pmm-psmdb-integration',
    description: 'Use this option for Percona MongoDB setup with PMM2',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci)
      await executeCommand('chmod +x ./mongoDb/mongo_psmdb_setup/setup_pmm_psmdb_integration.sh');
      await executeCommand('./mongoDb/mongo_psmdb_setup/setup_pmm_psmdb_integration.sh');
      await executeCommand(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./mongoDb/mongo_psmdb_setup/psmdb_setup.yml -e="CLIENT_VERSION=${parameters.pmmClientVersion} PSMDB_TARBALL=${parameters.psmdbTarballURL}  PSMDB_VERSION=${parameters.moVersion} PSMDB_SETUP=${parameters.moSetup}"`);
      core.exportVariable('INTEGRATION_FLAG', '@pmm-psmdb-integration');
    },
  },
  {
    arg: '--setup-pmm-haproxy-integration',
    description: 'Use this option for Haproxy setup with PMM2',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci)
      await executeCommand('chmod +x ./otherConfigs/haproxy/pmm-haproxy-setup.sh');
      console.log(await executeCommand('./otherConfigs/haproxy/pmm-haproxy-setup.sh'));
      console.log(await executeCommand('sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./otherConfigs/haproxy/haproxy_setup.yml'));
      core.exportVariable('INTEGRATION_FLAG', '@pmm-haproxy-integration');
    }
  },
  {
    arg: '--setup-pmm-ps-integration',
    description: 'Use this option for percona-server and PMM using dbdeployer',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci)
      await executeCommand('chmod +x ./mysql/pmm_ps_integration/pmm_ps_integration.sh');
      await executeCommand('./mysql/pmm_ps_integration/pmm_ps_integration.sh');
      await executeAnsiblePlaybook(`sudo ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ./mysql/pmm_ps_integration/ps_pmm_setup.yml -e="PS_VERSION=${parameters.psVersion} CLIENT_VERSION=${parameters.pmmClientVersion}"`);
      core.exportVariable('INTEGRATION_FLAG', '@pmm-ps-integration');
    },
  },
  {
    arg: '--mongo-replica-for-backup',
    description: 'Use this option to setup MongoDB Replica Set and PBM for each replica member on client node',
    function: async (parameters: SetupParameters) => {
      await installDockerCompose();
      await executeCommand('chmod +x ./mongoDb/mongo_replica_for_backup/setup_mongo_replica_for_backup.sh');
      await executeCommand('./mongoDb/mongo_replica_for_backup/setup_mongo_replica_for_backup.sh');
      core.exportVariable('INTEGRATION_FLAG', '@fb');
    },
  },
  {
    arg: '--clear-all-setups',
    description: 'Use this to clear your local env of any integration setups.',
    function: async (parameters: SetupParameters) => {
      await clearAllSetups();
    },
  }
];

export const availableConstMap = new Map<string, string>([
  ['--pgsql-version', 'Pass Postgre SQL server version Info'],
  ['--mo-version', 'Pass MongoDB Server version info'],
  ['--mo-setup', 'Pass MongoDB Server type info'],
  ['--ps-version', 'Pass Percona Server version info'],
  ['--setup-pmm-client-tarball', 'Sets up pmm client from provided tarball'],
  ['--pmm-client-version', 'Version of pmm client to use, default dev-latest'],
  ['--query-source', 'Query Source for MySql options are perfschema or slowlog'],
  ['--ci', 'Use this when using in ci (Jenkins, Github Action)']
  
]);

export const availableSetupMap = new Map(
  availableSetups.map((object) => {
    return [object.arg, object.description];
  })
);

export const availableArgsMap = new Map<string, string>([...availableConstMap, ...availableSetupMap]);

const availableCommandsLineArgs: string[] = Array.from(availableArgsMap.keys());

export default availableCommandsLineArgs;
