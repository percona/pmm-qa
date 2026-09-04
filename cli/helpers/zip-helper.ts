import { test } from '@playwright/test';
import AdmZip from 'adm-zip';

/**
 * Read ZIP archive and return AdmZip instance or list of entry names
 *
 * @param   filepath  path to the ZIP file
 * @param   getZip    if true, returns AdmZip instance; otherwise returns array of entry names
 * @return  AdmZip instance or array of entry names
 */
function readZipArchive(filepath: string, getZip = false): AdmZip | string[] {
  try {
    const zip = new AdmZip(filepath);

    if (getZip) return zip;

    return zip.getEntries().map(({ name }) => name);
  } catch (e) {
    throw new Error(`Something went wrong when reading a zip file ${filepath}. ${e}`);
  }
}

/**
 * Get file content from ZIP archive by file name prefix
 *
 * @param   zipPath        path to the ZIP file
 * @param   fileNamePrefix name or prefix of the file to extract from ZIP
 * @return  array of file content lines
 */
export async function getFileContentFromZip(zipPath: string, fileNamePrefix: string): Promise<string> {
  return test.step(`Get file "${fileNamePrefix}" content from ZIP "${zipPath}"`, async () => {
    const zip = readZipArchive(zipPath, true) as AdmZip;
    const zipEntry = zip.getEntry(fileNamePrefix);

    if (!zipEntry) {
      throw new Error(`File ${fileNamePrefix} not found in the ZIP`);
    }

    const fileContent = zipEntry.getData().toString('utf8');

    return fileContent;
  });
}

/**
 * Read ZIP archive and return list of entry names
 *
 * @param   filepath  path to the ZIP file
 * @return  array of entry names in the ZIP archive
 */
export async function readZipEntries(filepath: string): Promise<string[]> {
  return test.step(`Read ZIP entries from "${filepath}"`, async () => {
    const entries = readZipArchive(filepath, false) as string[];
    return entries;
  });
}

/**
 * Read ZIP archive and return list of entry names
 * Alias for {@link readZipEntries} for backward compatibility
 *
 * @param   filepath  path to the ZIP file
 * @return  array of entry names in the ZIP archive
 */
export async function readZipFile(filepath: string): Promise<string[]> {
  return readZipEntries(filepath);
}
