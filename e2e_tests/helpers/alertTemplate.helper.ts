import fs from 'node:fs';

export const normalizeTemplate = (yaml: string) => yaml.replaceAll(/ +(?= )/g, '');

export const readTemplateFile = (path: string) => {
  const content = fs.readFileSync(path, 'utf8');
  const templates = content
    .split(/^(?= {2}- name: )/m)
    .slice(1)
    .map((chunk) => ({
      name: chunk.match(/^ {2}- name: (.+)$/m)?.[1] ?? '',
      summary: chunk.match(/^ {4}summary: (.+)$/m)?.[1] ?? '',
      yaml: `templates:\n${chunk.trimEnd()}\n`,
    }));

  return { content, templates };
};
