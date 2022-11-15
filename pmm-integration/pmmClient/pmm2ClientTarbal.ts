import fs from 'fs';
import url from "url";
import path from "path";
import https, { request } from 'https';
import { unzip } from 'node:zlib';
import decompress from "decompress";
import { ClientRequest, IncomingMessage } from 'http';
import { executeCommand } from '../helpers/commandLine';

const setup_pmm_client_tarball = async (tarballURL: string) => {

    var parsed = url.parse(tarballURL);
    const clientFileName = path.basename(parsed.pathname!)
    const pathToPmmClient = `${path.resolve(__dirname)}/tarball/bin`

    const file = fs.createWriteStream(clientFileName);
    await getTarball(tarballURL, file);
    await decompress(clientFileName, 'pmmClient/tarball/', { strip: 1 })
    await executeCommand(`echo "export PATH=$PATH:${pathToPmmClient}"`)
    await executeCommand(`echo $PATH`)
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