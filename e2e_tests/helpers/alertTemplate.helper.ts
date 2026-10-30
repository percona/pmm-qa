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

export interface OverridableTemplateOptions {
  boolParam?: boolean;
  expression?: string;
  singleExpression?: boolean;
}

const memoryQuery =
  '100 * (1 - avg by (node_name) (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))';

// A memory template with an overridable `threshold`; the options produce the shapes PMM must refuse.
export const overridableTemplate = (
  name: string,
  {
    boolParam = false,
    expression = '$A > [[ .threshold ]]',
    singleExpression = false,
  }: OverridableTemplateOptions = {},
) => `templates:
  - name: ${name}
    version: 1
    summary: ${name}
${
  singleExpression
    ? `    expr: |-
      ${memoryQuery} > [[ .threshold ]]`
    : `    queries:
      - ref_id: A
        expr: |-
          ${memoryQuery}
    expressions:
      - ref_id: C
        type: math
        expression: "${expression}"
    condition: C`
}
    params:
      - name: threshold
        summary: Memory used percentage
${
  boolParam
    ? `        type: bool
        value: true`
    : `        unit: "%"
        type: float
        range: [0, 100]
        value: 90`
}
        overridable: true
    for: 1m
    severity: warning
    annotations:
      summary: Node memory usage high ({{ $labels.node_name }})
      description: '{{ $labels.node_name }} memory usage is above [[ .threshold ]]%.'
`;
