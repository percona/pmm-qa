import AdmZip from 'adm-zip';
import { expect } from '@playwright/test';

export const readZipArchive = (filepath: string): string[] => {
  const zip = new AdmZip(filepath);

  return zip.getEntries().map(({ entryName }) => entryName);
};

export const seeEntriesInZip = async (filepath: string, entriesArray: string[]): Promise<void> => {
  const entries = readZipArchive(filepath);

  for (const entry of entriesArray) {
    expect(entries, `Zip file: '${filepath}' must include: ${entriesArray}`).toContain(entry);
  }
};

export const dontSeeEntriesInZip = async (filepath: string, entriesArray: string[]): Promise<void> => {
  const entries = readZipArchive(filepath);

  for (const entry of entriesArray) {
    expect(entries, `'${entry}' must not be in ${entries}`).not.toContain(entry);
  }
};
