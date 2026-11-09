export const rejectedTemplates = [
  {
    message: 'in expression C must be the whole right-hand side of a comparison',
    name: 'test_dt_bad1',
    options: { expression: '$A > [[ .threshold ]] * 2' },
    shape: 'a scaled threshold',
  },
  {
    message: 'in expression C must be the whole right-hand side of a comparison',
    name: 'test_dt_bad2',
    options: { expression: '[[ .threshold ]] < $A' },
    shape: 'the threshold on the left-hand side',
  },
  {
    message: "overridable parameter 'threshold' requires the queries and expressions template form",
    name: 'test_dt_bad3',
    options: { singleExpression: true },
    shape: 'a single expr',
  },
  {
    message: 'an overridable parameter must be of type float, got bool',
    name: 'test_dt_bad4',
    options: { boolParam: true },
    shape: 'a bool parameter',
  },
];

export const thresholdTemplates = [
  'test_node_memory_multi',
  'test_dt_ok2',
  ...rejectedTemplates.map(({ name }) => name),
];
