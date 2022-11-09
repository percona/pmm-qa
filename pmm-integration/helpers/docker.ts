import { executeCommandIgnoreErrors } from './commandLine';

export const stopAndRemoveContainer = async (containerName: string) => {
  await executeCommandIgnoreErrors(`docker stop ${containerName}`);
  await executeCommandIgnoreErrors(`docker rm ${containerName}`);
}
