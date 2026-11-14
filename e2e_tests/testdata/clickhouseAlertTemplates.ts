export const qanTemplate = { name: 'pmm_qan_slow_queries', summary: 'QAN slow queries' };

export const qanAlertLabels = [
  'service_name',
  'service_id',
  'service_type',
  'node_name',
  'node_id',
  'node_type',
  'node_model',
  'machine_id',
  'container_id',
  'container_name',
  'environment',
  'cluster',
  'replication_set',
  'region',
  'az',
  'severity',
];

export const userTemplate = {
  name: 'qa_qan_query_count',
  summary: 'QA QAN query count',
  yaml: `templates:
  - name: qa_qan_query_count
    version: 1
    summary: QA QAN query count
    queries:
      - ref_id: A
        datasource: clickhouse
        expr: |-
          SELECT $__toTime AS time, service_name, node_name, sum(num_queries) AS queries
          FROM pmm.metrics
          WHERE period_start >= $__fromTime AND period_start <= $__toTime
          GROUP BY service_name, node_name
    expressions:
      - ref_id: B
        type: reduce
        reducer: sum
        expression: $A
      - ref_id: C
        type: math
        expression: "$B > [[ .threshold ]]"
    condition: C
    params:
      - name: threshold
        summary: Queries in the last 5 minutes
        type: float
        value: 0
    for: 1m
    severity: info
    annotations:
      summary: Queries on {{ $labels.service_name }}
      description: '{{ $labels.service_name }} ran {{ $values.B.Value }} queries.'
`,
};

const replaceOnce = (yaml: string, from: string, to: string) => {
  if (!yaml.includes(from)) throw new Error(`"${from}" is not in the template`);

  return yaml.replace(from, () => to);
};

export const unsupportedReducer = {
  change: 'an unsupported reducer',
  edit: (yaml: string) => replaceOnce(yaml, 'reducer: sum', 'reducer: avg'),
  message:
    "template expression B has unsupported reducer 'avg', want one of sum, mean, min, max, count, last, median",
};

export const rejectedClickHouseTemplates = [
  {
    change: 'math on the ClickHouse query',
    edit: (yaml: string) =>
      replaceOnce(yaml, 'expression: "$B > [[ .threshold ]]"', 'expression: "$A > [[ .threshold ]]"'),
    message: 'template expression C uses ClickHouse query $A directly; reduce it first',
  },
  {
    change: 'the ClickHouse query as the condition',
    edit: (yaml: string) => replaceOnce(yaml, 'condition: C', 'condition: A'),
    message:
      'template condition A is a ClickHouse query; add a reduce expression over it and use that instead',
  },
  unsupportedReducer,
  {
    change: 'a ref ID with a dash',
    edit: (yaml: string) => replaceOnce(yaml, '- ref_id: A\n', '- ref_id: A-1\n'),
    message:
      "template query ref_id 'A-1' must start with a letter or underscore and contain only letters, digits and underscores",
  },
  {
    change: 'a reduce over an expression',
    edit: (yaml: string) => replaceOnce(yaml, '        expression: $A\n', '        expression: $A + 1\n'),
    message: 'template expression B must reduce a single step, e.g. `$A`',
  },
  {
    change: 'an unknown datasource',
    edit: (yaml: string) => replaceOnce(yaml, 'datasource: clickhouse', 'datasource: loki'),
    message: "template query A: unhandled query datasource 'loki', want 'metrics' or 'clickhouse'",
  },
  {
    change: 'a string parameter in the SQL',
    edit: (yaml: string) =>
      replaceOnce(
        replaceOnce(
          yaml,
          'GROUP BY service_name, node_name',
          "AND service_name = '[[ .svc ]]'\n          GROUP BY service_name, node_name",
        ),
        '    params:\n',
        '    params:\n      - name: svc\n        summary: Service\n        type: string\n        value: x\n',
      ),
    message: "template query A uses string parameter 'svc'; ClickHouse queries take only float parameters",
  },
  {
    change: 'the description reading the ClickHouse query',
    edit: (yaml: string) => replaceOnce(yaml, '{{ $values.B.Value }}', '{{ $values.A.Value }}'),
    message:
      "'description' reads $values.A, but ClickHouse query results are not in $values; read the reduce expression over it instead",
  },
  {
    change: 'an overridable parameter in the SQL',
    edit: (yaml: string) =>
      replaceOnce(
        replaceOnce(
          yaml,
          'GROUP BY service_name, node_name',
          'GROUP BY service_name, node_name\n          HAVING queries > [[ .threshold ]]',
        ),
        '        value: 0\n',
        '        value: 0\n        overridable: true\n',
      ),
    message: "overridable parameter 'threshold' is used in query A, but can only be used in expressions",
  },
];

export const rejectedName = (index: number) => `qa_qan_bad_${index}`;

// The list shows summaries, so each refused template gets its own to tell it apart.
export const refusedTemplate = (index: number, edit: (yaml: string) => string) =>
  replaceOnce(
    replaceOnce(edit(userTemplate.yaml), `name: ${userTemplate.name}`, `name: ${rejectedName(index)}`),
    `summary: ${userTemplate.summary}`,
    `summary: ${rejectedName(index)}`,
  );
