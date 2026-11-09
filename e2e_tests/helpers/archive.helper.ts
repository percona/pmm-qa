import AdmZip from 'adm-zip';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

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

export const extractTarGz = (archive: Buffer, directory: string): { dirs: string[]; files: string[] } => {
  fs.mkdirSync(directory, { recursive: true });
  execFileSync('tar', ['-xzf', '-', '-C', directory], { input: archive });

  return {
    dirs: fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name),
    files: fs
      .readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map(({ name }) => name),
  };
};
