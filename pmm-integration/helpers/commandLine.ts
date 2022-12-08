import { ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import SetupParameters from './setupParameters.interface';
import * as core from '@actions/core';
import shell from 'shelljs';
import * as dotenv from 'dotenv'

const awaitExec = promisify(exec);

dotenv.config()

export const executeCommand = async (command: string) => {
  const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: true });
  if (code === 0) {
    `The command ${command} was run successfully with result: ${stdout}`;
  } else {
    throw new Error(`The command ${command} failed with error: ${stderr}`);
  }


  return { stdout, stderr };
}

export const executeAnsiblePlaybook = async (command: string) => {
  console.log(`Ansible command ${command} run`);
  const { stdout, stderr } = await executeCommand(command)
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
};

export const executeCommandIgnoreErrors = async (command: string) => {
  return awaitExec(command)
    .then((response: any) => response)
    .catch((e: Error) => { });
}

export const setEnvVariable = async (variable: string, value: string) => {
  if(process.env.CI) {
    console.log(`Setting up github action env variable ${variable} with the value: ${value}`);
    core.exportVariable(variable, value);
  } else {
    console.log(`Setting up local action env variable ${variable} with the value: ${value}`);
    process.env[variable] = value;
  }
  
}

export const setDefaultEnvVariables = async (parameters: SetupParameters) => {
  if (!parameters.pgsqlVersion) {
      await setEnvVariable('PGSQL_VERSION', '15');
      parameters.pgsqlVersion = '14';
  }

  if (!parameters.moVersion) {
      await setEnvVariable('MO_VERSION', '6.0')
      parameters.moVersion = '6.0';
  }
}

export const installAnsible = async () => {
  await executeCommand('sudo apt-get update -y')
  await executeCommand('sudo apt-get install -y ansible')
};