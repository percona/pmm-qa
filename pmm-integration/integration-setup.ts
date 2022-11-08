import pgsqlVacuumSetup from "./postgres/pgsql-vacuum-setup";
import validateArgs from "./helpers/validateArgs";
import { executeCommand, setEnvVariable } from "./helpers/commandLine";

const run = async () => {

  let pgsqlVersion: string | undefined;

  const myArgs: string[] = process.argv.slice(2);
  validateArgs(myArgs);
  
  for await (const [_index, value] of myArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        pgsqlVersion = value.split("=")[1];
        await setEnvVariable('PGSQL_VERSION', pgsqlVersion);
        break
      default:
        break
    }
  }

  for await (const [_index, value] of myArgs.entries()) {
    switch (value) {
      case '--setup-pgsql-vacuum':
        await pgsqlVacuumSetup({pgsqlVersion})
        break
        case '--setup-pmm-pgss-integration':
          await executeCommand('chmod +x ./postgres/setup_pmm_pgss_integration.sh');
          console.log(await executeCommand('./postgres/setup_pmm_pgss_integration.sh'));
      default:
        break
    }
  } 
}

run();

export default run;