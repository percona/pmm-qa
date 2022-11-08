import { exec } from 'child_process';
import { promisify } from 'util';

const awaitExec = promisify(exec);

export const executeCommand = async (command: string) => {
  return awaitExec(command, { env: process.env });
}

export const executeCommandIgnoreErrors = async (command: string) => {
  return awaitExec(command)
  .then((response: any) => response)
  .catch((e: Error) => {});
}

export const setEnvVariable = async (variable: string, value: string) => {
  process.env[variable] = value;
}
