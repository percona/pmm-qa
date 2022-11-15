import { exec } from 'child_process';
import { promisify } from 'util';

const awaitExec = promisify(exec);

export const executeCommand = async (command: string) => {
  const response = await awaitExec(command, { env: process.env });

  console.log(command)
  if (response.stdout) {
    console.log(`Command logged: ${response.stdout}`)
  }
  if (response.stderr) {
    console.log(`Command logged error : ${response.stderr}`)
  }


  return response;
}

export const executeCommandIgnoreErrors = async (command: string) => {
  return awaitExec(command)
    .then((response: any) => response)
    .catch((e: Error) => { });
}

export const setEnvVariable = async (variable: string, value: string) => {
  process.env[variable] = value;
}
