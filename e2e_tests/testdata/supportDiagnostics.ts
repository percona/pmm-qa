import { SupportDiagnosticsExecution } from '@interfaces/supportDiagnostics';

export const supportDiagnosticsIncident = {
  case_ref: null,
  closed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  created_by: 'admin',
  failed_run_count: 0,
  id: 'f131f240-73b8-400c-b139-c4cdac275abd',
  last_activity_at: null,
  name: 'Mocked incident',
  run_count: 0,
  updated_at: null,
};

export const logExtractorFilename = 'mongodb_log_extractor.sh';

export const logExtractorTitle = 'MongoDB Log Extractor';

export const supportDiagnosticsCatalog = [
  {
    category: 'SERVER_CRASHED_RESTART_SUCCESSFUL',
    category_label: 'Server crashed - Restart Successful',
    category_root: 'MongoDB',
    parent_category: 'CRASHES',
    parent_category_label: 'Crashes',
    snippet_count: 1,
    snippets: [
      {
        description:
          'This script extracts a portion of the MongoDB log containing the time of the original crash and any restart attempts.',
        name: logExtractorFilename,
        sudo: 'always',
        title: logExtractorTitle,
      },
    ],
  },
];

export const supportDiagnosticsHosts = [
  { address: '127.0.0.1', can_elevate: false, id: 'pmm-server', name: 'pmm-server' },
];

export const logExtractorSchema = {
  per_snippet: [
    {
      fields: [
        {
          default: null,
          description: "The moment to centre the extracted window on, read in the executor host's time zone.",
          destructive: null,
          forbidden: null,
          help_placement: null,
          label: 'Issue Time',
          name: 'time',
          parent: null,
          required: true,
          requires: null,
          type: 'datetime',
        },
        {
          default: 30,
          description: 'The number of minutes before and after to include.',
          destructive: null,
          forbidden: null,
          ge: 1,
          help_placement: null,
          label: 'Minutes',
          le: null,
          name: 'minutes',
          parent: null,
          required: false,
          requires: null,
          step: 1,
          type: 'integer',
        },
        {
          default: null,
          description:
            "The path to your MongoDB log file. Read from the running server's config when left empty.",
          destructive: null,
          forbidden: null,
          help_placement: null,
          label: 'Log file path',
          max_length: null,
          min_length: null,
          name: 'log-file',
          parent: null,
          pattern: null,
          placeholder: '/var/log/mongodb/mongod.log',
          required: false,
          requires: null,
          sensitive: false,
          type: 'string',
        },
        {
          choices: [
            {
              disabled: null,
              disabled_reason: null,
              label: 'Print to the terminal',
              value: 'stdout',
            },
            {
              disabled: null,
              disabled_reason: null,
              label: 'Write the output to a file named by the timestamp',
              value: 'file',
            },
          ],
          default: 'stdout',
          description: 'Where to send the output',
          destructive: null,
          forbidden: null,
          help_placement: null,
          label: 'Output destination',
          name: 'output',
          parent: null,
          required: false,
          requires: null,
          type: 'choice',
        },
      ],
      snippet_filename: 'mongodb_log_extractor.sh',
    },
  ],
  shared: [
    {
      allow_custom: null,
      default: null,
      depends_on: null,
      description: null,
      destructive: null,
      forbidden: null,
      help_placement: null,
      label: 'Execution Host',
      name: 'executor_host',
      parent: null,
      required: true,
      requires: null,
      target_service: null,
      type: 'host',
    },
  ],
};

export const finishedExecutions: SupportDiagnosticsExecution[] = [
  {
    args_withheld: false,
    created_at: '2026-01-01T00:00:00Z',
    failure_reason: "Step 'run-script' failed.",
    finished_at: '2026-01-01T00:00:10Z',
    has_logs: false,
    id: '20c9bf6c-2e04-4952-a41d-20fb8f389609',
    masked_args: '--summarize /tmp',
    snippet_filename: 'disk_usage.sh',
    snippet_title: 'Disk Usage',
    started_at: '2026-01-01T00:00:00Z',
    task_history_id: 1,
    task_status: 'failed',
  },
  {
    args_withheld: false,
    created_at: '2026-01-01T00:01:00Z',
    failure_reason: "Step 'run-script' failed.",
    finished_at: '2026-01-01T00:01:10Z',
    has_logs: false,
    id: 'd9bff28e-9f9f-4f61-9e01-2ad8dc99892b',
    masked_args: '--summarize /tmp',
    snippet_filename: 'disk_usage.sh',
    snippet_title: 'Disk Usage',
    started_at: '2026-01-01T00:01:00Z',
    task_history_id: 2,
    task_status: 'failed',
  },
];
