import { executeCommand } from "./helpers/commandLine";
import SetupParameters from "./helpers/setupParameters.interface";
import pgsqlVacuumSetup from "./postgres/pgsql-vacuum-setup";

export interface SetupsInterface {
  arg: string;
  description: string;
  function: (parameters: SetupParameters) => Promise<void>
}

export const availableSetups: SetupsInterface[] = [
  {
    arg: '--setup-pgsql-vacuum',
    description: 'Use this do setup postgres for vacuum monitoring tests',
    function: async (parameters: SetupParameters) => await pgsqlVacuumSetup(parameters),
  },
  {
    arg: '--setup-pmm-pgsm-integration',
    description: 'Use this option to setup PMM-Client with PGSM for integration testing',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./postgres/pgsql_pgsm_setup/setup_pmm_pgsm_integration.sh');
      console.log(await executeCommand('./postgres/pgsql_pgsm_setup/setup_pmm_pgsm_integration.sh'));
    },
  },
  {
    arg: '--setup-pmm-pgss-integration',
    description: 'Use this option to setup PMM-Client with PG Stat Statements for Integration Testing',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./postgres/pgsql_pgss_setup/setup_pmm_pgss_integration.sh');
      console.log(await executeCommand('./postgres/pgsql_pgss_setup/setup_pmm_pgss_integration.sh'));
    },
  },
  {
    arg: '--setup-pmm-psmdb-integration',
    description: 'Use this option for Percona MongoDB setup with PMM2',
    function: async (parameters: SetupParameters) => {
      await executeCommand('chmod +x ./postgres/pgsql_psmdb_setup/setup_pmm_psmdb_integration.sh');
      console.log(await executeCommand('./postgres/pgsql_psmdb_setup/setup_pmm_psmdb_integration.sh'));
    },
  }
];

export const availableConstMap = new Map<string, string>([
    ["--pgsql-version", "Pass Postgre SQL server version Info"],
    ["--mo-version", "Pass MongoDB Server version info"]
]);

export const availableSetupMap = new Map(
  availableSetups.map(object => {
    return [object.arg, object.description];
  }),
);

export const availableArgsMap = new Map<string, string>([...availableConstMap, ...availableSetupMap]);

const availableCommandsLineArgs: string[] =  Array.from( availableArgsMap.keys() );

export default availableCommandsLineArgs;
