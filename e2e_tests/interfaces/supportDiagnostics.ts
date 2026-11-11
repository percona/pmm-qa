export interface SupportDiagnosticsExecution {
  args_withheld: boolean;
  created_at: string;
  failure_reason: string | null;
  finished_at: string | null;
  has_logs: boolean;
  id: string;
  masked_args: string;
  snippet_filename: string;
  snippet_title: string;
  started_at: string;
  task_history_id: number;
  task_status: string;
}

export interface SupportDiagnosticsBatchRequest {
  executor_host: string;
  items: { args: Record<string, number | string>; snippet_filename: string }[];
  shared_args: Record<string, never>;
  sudo: boolean;
}
