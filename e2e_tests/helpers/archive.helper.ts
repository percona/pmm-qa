import AdmZip from 'adm-zip';

export const readZipArchive = (filepath: string): string[] => {
  const zip = new AdmZip(filepath);

  return zip.getEntries().map(({ entryName }) => entryName);
};
