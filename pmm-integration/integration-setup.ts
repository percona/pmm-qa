import validateArgs from "./helpers/validateArgs";
import { setEnvVariable } from "./helpers/commandLine";
import {  availableSetups, SetupsInterface } from "./availableArgs";

const run = async () => {
  let pgsqlVersion: string | undefined;
  let moVersion: string | undefined;

  const commandLineArgs: string[] = process.argv.slice(2);
  validateArgs(commandLineArgs);

  for await (const [_index, value] of commandLineArgs.entries()) {
    switch (true) {
      case value.includes('--pgsql-version'):
        pgsqlVersion = value.split("=")[1];
        await setEnvVariable('PGSQL_VERSION', pgsqlVersion);
        break
      case value.includes('--mo-version'):
        moVersion = value.split("=")[1];
        await setEnvVariable('MO_VERSION', moVersion);
        break
      default:
        break
    }
  }

  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => setup.arg === value)
    if(setup) {
      await setup.function({pgsqlVersion, moVersion})
    }    
  }
}

run();

export default run;
