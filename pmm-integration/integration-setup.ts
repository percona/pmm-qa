import validateArgs from "./helpers/validateArgs";
import { executeCommand, setEnvVariable } from "./helpers/commandLine";
import { availableSetups, SetupsInterface } from "./availableArgs";
import setup_pmm_client_tarball from "./pmmClient/pmm2ClientTarbal";

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
      case value.includes('--setup-pmm-client-tarball'):
        let tarballURL = value.split("=")[1];
        await setup_pmm_client_tarball(tarballURL)
        break;
      default:
        break
    }
  }
  /*
    await executeCommand(`docker run -d --restart always \
     -e PERCONA_TEST_PLATFORM_ADDRESS=https://check-dev.percona.com:443 \
     --publish 8080:80 --publish 8443:443 \
     --name pmm-server-integration percona/pmm-server:latest`);
  */
  for await (const [_index, value] of commandLineArgs.entries()) {
    const setup: SetupsInterface | undefined = availableSetups.find((setup) => setup.arg === value)
    if (setup) {
      await setup.function({ pgsqlVersion, moVersion })
    }
  }
}

run();

export default run;
