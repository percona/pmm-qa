import fs from 'fs';
import url from "url";
import path from "path";
import https from 'https';
import decompress from "decompress";
import { executeCommand } from '../helpers/commandLine';
import { stopAndRemoveContainer } from '../helpers/docker';

const setup_pmm_client_tarball = async (tarballURL: string) => {

    // Set up system variables
    const containerName = "ubuntuBase"
    const parsed = url.parse(tarballURL);
    const clientFileName = path.basename(parsed.pathname!)

    // Remove old containers from previous runs.
    await stopAndRemoveContainer(containerName);

    // Download and decompress pmm client.
    const file = fs.createWriteStream(clientFileName);
    await getTarball(tarballURL, file);
    await decompress(clientFileName, 'pmmClient/pmm2Client/', { strip: 1 })

    // Run empty base ubuntu container
    await executeCommand(`docker run -d -e PATH=/pmm2Client/bin:$PATH --name=${containerName} phusion/baseimage:focal-1.2.0`);

    // Copy pmm client into docker container
    await executeCommand(`docker cp ./pmmClient/. ${containerName}:/`)

    // Test that pmm client is running
    await executeCommand(`docker exec ${containerName} pmm-admin --version`)
}


const getTarball = (address: string, file: fs.WriteStream): Promise<string> => {
    return new Promise((resolve, reject) => {
        https.get(address, (response) => {
            response.pipe(file)
                .on('finish', () => {
                    resolve("");
                })
                .on('error', () => {
                    reject("Error during the download");
                });
        });
    });
}

export default setup_pmm_client_tarball;     