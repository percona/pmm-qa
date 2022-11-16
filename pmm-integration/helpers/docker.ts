import { executeCommand, executeCommandIgnoreErrors } from './commandLine';

export const stopAndRemoveContainer = async (containerName: string) => {
  await executeCommandIgnoreErrors(`docker stop ${containerName}`);
  await executeCommandIgnoreErrors(`docker rm ${containerName}`);
}

export const recreateNetwork = async (networkName: string) => {
  await executeCommandIgnoreErrors(`docker network rm ${networkName}`)
  await executeCommand(`docker network create ${networkName}`)
}
