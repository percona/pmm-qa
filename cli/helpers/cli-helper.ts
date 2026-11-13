import { expect, test } from '@playwright/test';
import ExecReturn from '@support/types/exec-return.class';
import shell from 'shelljs';
import { performance } from 'node:perf_hooks';

/**
 * Shell(sh) echo().to() wrapper to use in tests with handy logs creation
 *
 * @param   pathToFile  path to the file including file name
 * @param   content     content {@code string} to insert as file content
 * @param   stepTitle   optional custom test step label
 */
export async function createFile(pathToFile: string, content: string, stepTitle: string | null = null) {
  const stepName = stepTitle || `Create "${pathToFile}" file with content:\n"${content}"`;

  await test.step(stepName, async () => {
    console.log(`echo: "${content}" >> ${pathToFile}`);
    shell.echo(content).to(pathToFile);
  });
}

/**
 * Shell(sh) exec() wrapper to use outside of {@link test}
 * returns handy {@link ExecReturn} object.
 *
 * @param       command   sh command to execute
 * @return      {@link ExecReturnClass} instance
 */
export function execute(command: string): ExecReturn {
  console.log(`exec: "${command}"`);
  const start = performance.now();
  const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: false });
  const durationMs = performance.now() - start;
  if (stdout.length > 0) console.log(`Out: "${stdout}"`);
  if (stderr.length > 0) console.log(`Error: "${stderr}"`);
  return new ExecReturn(command, code, stdout, stderr, durationMs);
}

/**
 * Shell(sh) exec() wrapper to return handy {@link ExecReturn} object.
 *
 * @param       command   sh command to execute
 * @return      {@link ExecReturnClass} instance
 */
export async function exec(command: string): Promise<ExecReturn> {
  return test.step(`Run "${command}" command`, async () => {
    return execute(command);
  });
}

/**
 * Silent Shell(sh) exec() wrapper to return handy {@link ExecReturn} object.
 * Provides no logs to skip huge outputs.
 *
 * @param       command   sh command to execute
 * @return      {@link ExecReturnClass} instance
 */
export async function execSilent(command: string): Promise<ExecReturn> {
  const { stdout, stderr, code } = await test.step(`Run "${command}" command`, async () => {
    return shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: false });
  });

  return new ExecReturn(command, code, stdout, stderr);
}

/**
 * Scrape all metrics from exporter found by Service Name
 * **Note** will not work for versions earlier 2.29.0
 * as "port" was not included in pmm-admin output
 *
 * @param   serviceName         name of the service to search for the exporter
 * @param   agentUser           username to authenticate to exporter
 * @param   agentPassword       password for specified username to authenticate to exporter
 * @param   dockerContainer     Optional! docker container name to scrape metrics from
 */
export async function getMetrics(
  serviceName: string,
  agentUser: string,
  agentPassword: string,
  dockerContainer: string | null = null,
): Promise<string> {
  const output = await test.step(
    `Scraping "${serviceName}" metrics${dockerContainer ? `in "${dockerContainer}" container` : ''}`,
    async () => {
      const prefix = dockerContainer ? `docker exec ${dockerContainer} ` : '';
      const adminList = (await execute(`${prefix || 'sudo '}pmm-admin list`).assertSuccess()).getStdOutLines();
      const serviceId: string = adminList.find((item) => item.includes(serviceName))
        ?.trim()
        .split(' ')
        .pop() ?? ''; // Get the last item in the split result

      if (!serviceId) {
        throw new Error(`Failed to find '${serviceName}' service is in pmm-admin list output:\n${adminList}`);
      }

      const listenPort = adminList.filter((item) => item.includes(serviceId))
        .find((item: string) => item.includes('_exporter'))!
        .split(' ').filter((item) => item.trim().length > 0)
        .at(-1) ?? '';

      if (!listenPort) {
        throw new Error(`Failed to find port of '${serviceId}' exporter is in pmm-admin list output:\n${adminList}`);
      }

      return execute(`${prefix}curl -s "http://${agentUser}:${agentPassword}@127.0.0.1:${listenPort}/metrics"`);
    },
  );

  await output.assertSuccess();
  // TODO: parse into map(k => v) or json
  return output.stdout;
}

/**
 * Execute command and verify output contains expected content
 * Wrapper around {@link execute} that automatically asserts success and optionally verifies output
 *
 * @param   command         sh command to execute
 * @param   expectedOutput  optional string or array of strings to verify in command output
 * @return  command stdout as string
 */
export async function executeAndVerify(command: string, expectedOutput?: string | string[]): Promise<string> {
  return test.step(`Run "${command}" command and verify output contains "${expectedOutput}"`, async () => {
    const output = await execute(command);
    await output.assertSuccess();
    if (expectedOutput) {
      if (Array.isArray(expectedOutput)) {
        await output.outContainsMany(expectedOutput);
      } else {
        await output.outContains(expectedOutput);
      }
    }
    return output.stdout;
  });
}

/**
 * Assert a command failed and its stdout or stderr contains the expected message
 *
 * @param   output    result of the failed command
 * @param   message   expected error message
 */
export async function expectFailure(output: ExecReturn, message: string) {
  expect(output.code, `"${output.command}" should fail`).not.toEqual(0);
  expect(`${output.stdout}${output.stderr.text}`).toContain(message);
}

/**
 * Quote a value as one shell word, so spaces, $, & or ' in it reach the command unchanged
 *
 * @param   value   value to quote
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Run change agent commands, then assert what PMM Server stored, re-applying the change until it sticks.
 * A status report that pmm-agent sends while an agent restarts can overwrite a change saved at the same moment,
 * so a change that succeeded can be silently reverted (PMM-15835).
 * Each retry restarts the agent, so an assertion on runtime state must wait for the restart within itself.
 *
 * @param   commands          change agent commands to run
 * @param   expectedOutput    strings every command's output must contain
 * @param   persisted         assertion on the stored state; throws while the change is missing
 * @param   timeout           milliseconds to keep re-applying
 */
export async function execUntilPersisted(
  commands: string[],
  expectedOutput: string[],
  persisted: () => Promise<void>,
  timeout = 60_000,
) {
  await expect(async () => {
    for (const command of commands) {
      const output = await exec(command);
      await output.assertSuccess();

      for (const value of expectedOutput) {
        await output.outContains(value);
      }
    }

    await persisted();
  }).toPass({ intervals: [5_000], timeout });
}
