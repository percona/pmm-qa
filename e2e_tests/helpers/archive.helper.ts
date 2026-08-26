import AdmZip from 'adm-zip';

export const readZipArchive = (filepath: string): string[] => {
  const zip = new AdmZip(filepath);

  return zip.getEntries().map(({ entryName }) => entryName);
};

export const getFileLineCount = (source: string | Buffer, fileName: string): number => {
  const zip = new AdmZip(source);
  const entry = zip.getEntry(fileName);

  if (!entry) {
    throw new Error(`File ${fileName} not found in the ZIP`);
  }

  const lines = entry.getData().toString('utf8').split('\n');

  if (lines.at(-1) === '') lines.pop();

  return lines.length;
};
