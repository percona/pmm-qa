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
    console.log(`The command ${command} was run successfully with result: ${stdout}`);
  } else {
    throw new Error(`The command ${command} failed with error: ${stderr}`);
  }


  return { stdout, stderr };
}

export const executeAnsiblePlaybook = async (command: string) => {
  console.log(`Ansible command ${command} run`);
  const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: true });
  console.log(`The ansible playbook ${command} was run with result: ${stdout}`);
  if (code !== 0) {
    console.log(stdout)
    throw new Error(`The command ${command} failed with error: ${stderr}`);
  }
};

export const executeCommandIgnoreErrors = async (command: string) => {
  const { stdout, stderr, code } = shell.exec(command.replace(/(\r\n|\n|\r)/gm, ''), { silent: true });
  if (code === 0) {
    console.log(`The command ${command} was run successfully with result: ${stdout}`);
  } else {
    console.log(`The command ${command} failed with error: ${stderr}`);
  }

  return { stdout, stderr };
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
    core.exportVariable('PGSQL_VERSION', '15');
    parameters.pgsqlVersion = '15';
  }

  if (!parameters.moVersion) {
    core.exportVariable('MO_VERSION', '6.0');
    parameters.moVersion = '6.0';
  }

  if (!parameters.moSetup) {
    core.exportVariable('MO_SETUP', 'regular');
    parameters.moSetup = 'regular';
  }
  
  if (!parameters.psVersion) {
    core.exportVariable('PS_VERSION', '8.0');
    parameters.psVersion = parseFloat('8.0');
  }

  if (!parameters.pmmClientVersion) {
    core.exportVariable('CLIENT_VERSION', 'dev-latest');
    parameters.pmmClientVersion = 'dev-latest';
  }

  if (!parameters.pmmServerVersion) {
    parameters.pmmServerVersion = 'dev-latest';
  }

  if(!parameters.psmdbTarballURL) {
    parameters.psmdbTarballURL = '';
    core.exportVariable('PSMDB_TARBALL', '');
  }

  if(!parameters.querySource) {
    parameters.querySource = "perfschema";
  }

  if(!parameters.ci) {
    parameters.ci = false;
  }
}

export const installAnsible = async () => {
  await executeCommand('sudo apt-get update -y')
  await executeCommand('sudo apt-get install -y ansible')
};