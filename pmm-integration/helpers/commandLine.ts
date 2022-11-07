import { promisify } from 'util';

const exec = promisify(require('child_process').exec);

export const executeCommand = async (command: string) => {
  await exec(command);
}

export const executeCommandIgnoreErrors = async (command: string) => {
  return exec(command)
  .then((response: any) => response)
  .catch((e: Error) => {});
}