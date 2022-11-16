import { exec } from 'child_process';
import { promisify } from 'util';
import SetupParameters from './setupParameters.interface';
import * as core from '@actions/core';

const awaitExec = promisify(exec);

export const executeCommand = async (command: string) => {
  try {
    const response = await awaitExec(command)

    if (response.stdout) {
      console.log(`Command logged response: ${response.stdout}`)
    }
    return response;
  } catch (err: any) {
    throw new Error(err)
  }
}
export const executeAnsiblePlaybook = async (command: string) => {
  let ansibleResponse;
  try {
    await awaitExec(command)
      .then((response) => ansibleResponse = response.stdout)
      .catch((err) => console.log(new String(err.stdout)))
    return ansibleResponse;
  } catch (err: any) {
    throw new Error(err)
  }
}

export const executeCommandIgnoreErrors = async (command: string) => {
  return awaitExec(command)
    .then((response: any) => response)
    .catch((e: Error) => { });
}

export const setEnvVariable = async (variable: string, value: string) => {
  process.env[variable] = value;
}

export const setDefaulEnvVariables = async (parameters: SetupParameters) => {
  if (!parameters.pgsqlVersion) {
    await setEnvVariable('PGSQL_VERSION', '15');
    core.exportVariable('PGSQL_VERSION', '15');
  }

  if (!parameters.moVersion) {
    await setEnvVariable('MO_VERSION', '6.0')
    core.exportVariable('MO_VERSION', '6.0');
  }
}