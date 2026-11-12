export enum AdvisorCheckResultStatus {
  error = 'ADVISOR_CHECK_RESULT_STATUS_ERROR',
  failed = 'ADVISOR_CHECK_RESULT_STATUS_FAILED',
  notRun = 'ADVISOR_CHECK_RESULT_STATUS_NOT_RUN',
  ok = 'ADVISOR_CHECK_RESULT_STATUS_OK',
  pending = 'ADVISOR_CHECK_RESULT_STATUS_PENDING',
}

export enum AdvisorCheckTechnology {
  mongodb = 'ADVISOR_CHECK_TECHNOLOGY_MONGODB',
  mysql = 'ADVISOR_CHECK_TECHNOLOGY_MYSQL',
  postgresql = 'ADVISOR_CHECK_TECHNOLOGY_POSTGRESQL',
}

export enum AdvisorRunStatus {
  aborted = 'ADVISOR_RUN_STATUS_ABORTED',
  completed = 'ADVISOR_RUN_STATUS_COMPLETED',
  interrupted = 'ADVISOR_RUN_STATUS_INTERRUPTED',
  queued = 'ADVISOR_RUN_STATUS_QUEUED',
  running = 'ADVISOR_RUN_STATUS_RUNNING',
}

export enum AdvisorScheduleEmailMode {
  custom = 'ADVISOR_SCHEDULE_EMAIL_MODE_CUSTOM',
  off = 'ADVISOR_SCHEDULE_EMAIL_MODE_OFF',
  settings = 'ADVISOR_SCHEDULE_EMAIL_MODE_SETTINGS',
}

export enum AdvisorTriggeredBy {
  scheduler = 'ADVISOR_CHECK_TRIGGERED_BY_SCHEDULER',
  user = 'ADVISOR_CHECK_TRIGGERED_BY_USER',
}

export interface AdvisorCheckQuery {
  parameters?: Record<string, string>;
  query?: string;
  type: string;
}

export interface AdvisorCheckDefinition {
  category: string;
  description: string;
  name: string;
  queries: AdvisorCheckQuery[];
  script: string;
  summary: string;
  technology: AdvisorCheckTechnology;
}

export interface AdvisorCheck extends AdvisorCheckDefinition {
  disabled_service_ids: string[];
  enabled: boolean;
  user_defined: boolean;
}

export interface AdvisorRun {
  check_names: string[];
  checks_count: number;
  errors_count: number;
  findings_count: number;
  finished_at?: string;
  id: string;
  planned_checks_count: number;
  planned_services_count: number;
  schedule_id: string;
  schedule_name: string;
  scheduled_for?: string;
  service_ids: string[];
  services_count: number;
  started_at: string;
  status: AdvisorRunStatus;
  triggered_by: AdvisorTriggeredBy;
  waited_for_run: AdvisorRunReference | null;
}

export interface AdvisorRunReference {
  run_id: string;
  schedule_name: string;
  started_at: string;
  triggered_by: AdvisorTriggeredBy;
}

export interface AdvisorScheduleInput {
  check_names: string[];
  days_of_week: number[];
  email_addresses: string[];
  email_mode: AdvisorScheduleEmailMode;
  email_severities: string[];
  enabled: boolean;
  name: string;
  service_ids: string[];
  time_of_day: string;
}

export interface AdvisorSchedule extends AdvisorScheduleInput {
  last_run: AdvisorRun | null;
  next_run_at: string | null;
  schedule_id: string;
}

export interface AdvisorTargetService {
  service_id: string;
  service_name: string;
  technology: AdvisorCheckTechnology;
}

export type AdvisorTestTarget = Pick<AdvisorTargetService, 'service_id' | 'service_name'>;

export interface AdvisorInsight {
  az: string;
  category: string;
  check_name: string;
  cluster: string;
  description: string;
  environment: string;
  id: string;
  labels: Record<string, string>;
  node_name: string;
  outcome: string;
  read_more_url: string;
  region: string;
  replication_set: string;
  run_id: string;
  service_id: string;
  service_name: string;
  severity: string;
  status: AdvisorCheckResultStatus;
  summary: string;
}

export interface PaginatedResponse<T> {
  results?: T[];
  total_items: number;
  total_pages: number;
}
