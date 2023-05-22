import * as core from '@actions/core';
import { executeAnsiblePlaybook, executeCommand, installAnsibleInCI } from './helpers/commandLine';
import SetupParameters from './helpers/setupParameters.interface';
import pgsqlVacuumSetup from './postgres/pgsql-vacuum-setup';
import installDockerCompose from './otherConfigs/installDockerCompose';
import clearAllSetups from './otherConfigs/clearAllSetups';
import addClientPs from './mysql/addClientPs/addClientPs';
import addClientPdPgsql from './postgres/addClientPdPgsql';
import pmmServerSetup from './pmmServer/pmmServerSetup';
import MongoReplicaForBackup from './mongoDb/mongo_replica_for_backup/mongoReplicaForBackup';
import addClientMoDB from './mongoDb/addClientMoDB';
import addClientHaProxy from './haProxy/addClientHaProxy';
import addClientPxc from './otherConfigs/addClientPxc';
import addClientPsMoDB from './mongoDb/addClientPsMoDB';

export interface SetupsInterface {
  arg: string;
  description: string;
  function: (parameters: SetupParameters, client?: string) => Promise<void>;
}

export const availableSetups: SetupsInterface[] = [
  {
    arg: '--addclient',
    description: 'Use this do setup databases valid valid values are: ps, pdpgsql, modb, haproxy, pxc. Example: --addClient=ps,1',
    function: async (parameters: SetupParameters, client: string = '') => {
      const commandLineValue = client.split('=')[1];
      const selectedDB = commandLineValue.split(',')[0];
      const numberOfDbs: number = parseInt(commandLineValue.split(',')[1], 10);

      switch (true) {
        case selectedDB === 'ps':
          return addClientPs(parameters, numberOfDbs);
        case selectedDB === 'pdpgsql':
          return addClientPdPgsql(parameters, numberOfDbs);
        case selectedDB === 'modb':
          return addClientMoDB(parameters, numberOfDbs);
        case selectedDB === 'psmodb':
          return addClientPsMoDB(parameters, numberOfDbs);
        case selectedDB === 'haproxy':
          return addClientHaProxy(parameters, numberOfDbs);
        case selectedDB === 'pxc':
          return addClientPxc(parameters, numberOfDbs);
        default:
          break;
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
      await installAnsibleInCI(parameters.ci);
      await executeAnsiblePlaybook(
        `sudo ansible-playbook --connection=local --inventory 127.0.0.1 \
         --limit 127.0.0.1 ./postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml \
         -e="PGSQL_VERSION=${parameters.pgsqlVersion} CLIENT_VERSION=${parameters.pmmClientVersion}"`,
      );
      core.exportVariable('INTEGRATION_FLAG', '@pgsm-pmm-integration');
    },
  },
  {
    arg: '--setup-pmm-pgss-integration',
    description: 'Use this option to setup PMM-Client with PG Stat Statements for Integration Testing',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci);
      await executeAnsiblePlaybook(
        `sudo ansible-playbook --connection=local --inventory 127.0.0.1 \
         --limit 127.0.0.1 ./postgres/pgsql_pgss_setup/pgsql_pgss_setup.yml \
         -e="PGSQL_VERSION=${parameters.pgsqlVersion} CLIENT_VERSION=${parameters.pmmClientVersion}"`,
      );
      core.exportVariable('INTEGRATION_FLAG', '@pgss-pmm-integration');
    },
  },
  {
    arg: '--setup-pmm-psmdb-integration',
    description: 'Use this option for Percona MongoDB setup with PMM2',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci);
      await executeCommand('chmod +x ./mongoDb/mongo_psmdb_setup/setup_pmm_psmdb_integration.sh');
      await executeCommand('./mongoDb/mongo_psmdb_setup/setup_pmm_psmdb_integration.sh');
      await executeCommand(
        `sudo ansible-playbook --connection=local --inventory 127.0.0.1 \
         --limit 127.0.0.1 ./mongoDb/mongo_psmdb_setup/psmdb_setup.yml \
         -e="CLIENT_VERSION=${parameters.pmmClientVersion} PSMDB_TARBALL=${parameters.psmdbTarballURL} \
          PSMDB_VERSION=${parameters.moVersion} PSMDB_SETUP=${parameters.moSetup}"`,
      );
      core.exportVariable('INTEGRATION_FLAG', '@pmm-psmdb-integration');
    },
  },
  {
    arg: '--setup-pmm-ps-integration',
    description: 'Use this option for percona-server and PMM using dbdeployer',
    function: async (parameters: SetupParameters) => {
      await installAnsibleInCI(parameters.ci);
      await executeCommand('chmod +x ./mysql/pmm_ps_integration/pmm_ps_integration.sh');
      await executeCommand('./mysql/pmm_ps_integration/pmm_ps_integration.sh');
      await executeAnsiblePlaybook(
        `sudo ansible-playbook --connection=local \
        --inventory 127.0.0.1, --limit 127.0.0.1 ./mysql/pmm_ps_integration/ps_pmm_setup.yml \
         -e="PS_VERSION=${parameters.psVersion} CLIENT_VERSION=${parameters.pmmClientVersion}"`,
      );
      core.exportVariable('INTEGRATION_FLAG', '@pmm-ps-integration');
    },
  },
  {
    arg: '--mongo-replica-for-backup',
    description: 'Use this option to setup MongoDB Replica Set and PBM for each replica member on client node',
    function: async (parameters: SetupParameters) => {
      if (parameters.ci) {
        await installDockerCompose();
      }

      await executeCommand('chmod +x ./mongoDb/mongo_replica_for_backup/setup_mongo_replica_for_backup.sh');
      await executeCommand('./mongoDb/mongo_replica_for_backup/setup_mongo_replica_for_backup.sh');
      await MongoReplicaForBackup(parameters);
      core.exportVariable('INTEGRATION_FLAG', '@fb');
    },
  },
  {
    arg: '--setup-docker-pmm-server',
    description: 'Use this to setup pmm server in docker container.',
    function: async (parameters: SetupParameters) => {
      await pmmServerSetup(parameters);
    },
  },
  {
    arg: '--clear-all-setups',
    description: 'Use this to clear your local env of any integration setups.',
    function: async (parameters: SetupParameters) => {
      await clearAllSetups();
    },
  },
];

export const availableConstMap = new Map<string, string>([
  ['--pgsql-version', 'Pass Postgres SQL server version Info'],
  ['--pdpgsql-version', 'Pass Percona Distribution Postgres SQL server version Info'],
  ['--pxc-version', 'Pass Percona XtraDB Cluster version info'],
  ['--mo-version', 'Pass MongoDB Server version info'],
  ['--mo-setup', 'Pass MongoDB Server type info'],
  ['--psmo-version', 'Pass Percona Server MongoDB version info'],
  ['--ps-version', 'Pass Percona Server version info'],
  ['--setup-pmm-client-tarball', 'Sets up pmm client from provided tarball'],
  ['--pmm-server-version', 'Version of pmm server to use, default dev-latest'],
  ['--pmm-client-version', 'Version of pmm client to use, default dev-latest'],
  ['--query-source', 'Query Source for MySql options are perfschema or slowlog'],
  ['--ci', 'Use this when using in ci (Jenkins, Github Action)'],
  ['--use-socket', 'Use DB Socket for PMM Client Connection (MongoDb)'],
  ['--rbac', 'Use this to allow Access Control'],
  ['--pmm-server-docker-tag', 'Use this tag to select different docker tag, useful for RC and Release testing.'],
  ['--setup-tarball-docker', 'Use this flag in local setup when you do not want to use pmm client container.'],
  ['--upgrade-pmm-client-version', 'Use this tag to upgrade locally installed pmm client version.'],
]);

export const availableSetupMap = new Map(availableSetups.map((object) => [object.arg, object.description]));

export const availableArgsMap = new Map<string, string>([...availableConstMap, ...availableSetupMap]);

const availableCommandsLineArgs: string[] = Array.from(availableArgsMap.keys());

export default availableCommandsLineArgs;
