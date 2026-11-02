import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import {
  AdvisorCheck,
  AdvisorCheckDefinition,
  AdvisorCheckTechnology,
  AdvisorInsight,
  AdvisorRun,
  AdvisorRunStatus,
  AdvisorSchedule,
  AdvisorScheduleEmailMode,
  AdvisorScheduleInput,
  AdvisorTargetService,
  AdvisorTestTarget,
  PaginatedResponse,
} from '@interfaces/advisors';

export default class AdvisorsApi {
  // Every run of this check yields three warnings per MySQL service, whatever that database's state.
  readonly customCheckScript =
    'def check_context(docs, context):\n' +
    '    return [{"summary": "Finding " + str(i), "description": "Created by a UI test.", "severity": "warning"} ' +
    'for i in range(3)]\n';
  // The 4 s CPU limit of pmm-managed-starlark ends this script, so a run spends about 4 s on it.
  readonly endlessCheckScript =
    'def check_context(docs, context):\n    for i in range(1000000000):\n        pass\n    return []\n';
  readonly erroringCheckScript = 'def check_context(docs, context):\n    fail("QA failure")\n';
  readonly passingCheckScript = 'def check_context(docs, context):\n    return []\n';

  constructor(private request: APIRequestContext) {}

  changeCheck = async (name: string, change: { enable: boolean; service_ids?: string[] }) => {
    const response = await this.request.post(apiEndpoints.advisors.batchChange, {
      data: { params: [{ name, ...change }] },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);
  };

  createCustomCheck = async (overrides: Partial<AdvisorCheckDefinition> = {}): Promise<AdvisorCheck> => {
    const name = overrides.name ?? AdvisorsApi.customCheckName();
    const response = await this.request.post(apiEndpoints.advisors.checks, {
      data: {
        check: {
          category: 'QA',
          description: 'Created by a UI test.',
          queries: [{ query: 'vector(1)', type: 'METRICS_INSTANT' }],
          script: this.customCheckScript,
          summary: `QA check ${name}`,
          technology: AdvisorCheckTechnology.mysql,
          ...overrides,
          name,
        },
      },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { check: AdvisorCheck }).check;
  };

  createSchedule = async (overrides: Partial<AdvisorScheduleInput> = {}): Promise<AdvisorSchedule> => {
    const response = await this.request.post(apiEndpoints.advisors.schedules, {
      data: AdvisorsApi.scheduleInput(overrides),
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { schedule: AdvisorSchedule }).schedule;
  };

  static customCheckName = () => `custom_qa_${Date.now()}_${Math.floor(Math.random() * 1_000)}`;

  deleteCheck = async (name: string) => {
    const response = await this.requestDeleteCheck(name);

    expect([200, 404], await response.text()).toContain(response.status());
  };

  deleteSchedule = async (scheduleId: string) => {
    const response = await this.request.delete(`${apiEndpoints.advisors.schedules}/${scheduleId}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect([200, 404], await response.text()).toContain(response.status());
  };

  findCheck = async (name: string): Promise<AdvisorCheck | undefined> => {
    const response = await this.request.get(`${apiEndpoints.advisors.checks}/${name}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    if (response.status() === 404) return undefined;

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { check: AdvisorCheck }).check;
  };

  // The first finding gets firstSeverity and the rest are warnings.
  static findingsScript = (count: number, firstSeverity = 'warning') =>
    'def check_context(docs, context):\n' +
    '    return [{"summary": "Finding " + str(i), "description": "Created by a UI test.", ' +
    `"severity": "${firstSeverity}" if i == 0 else "warning"} for i in range(${count})]\n`;

  findSchedule = async (name: string): Promise<AdvisorSchedule | undefined> =>
    (await this.listSchedules()).find((schedule) => schedule.name === name);

  getBuiltinCheck = async (): Promise<AdvisorCheck> => {
    const check = (await this.listChecks()).find(({ user_defined }) => !user_defined);

    expect(check, 'No built-in advisor check found').toBeDefined();

    return check as AdvisorCheck;
  };

  getMysqlService = async (): Promise<AdvisorTargetService> => {
    const service = (await this.listServices()).find(
      ({ technology }) => technology === AdvisorCheckTechnology.mysql,
    );

    expect(service, 'No MySQL service is monitored').toBeDefined();

    return service as AdvisorTargetService;
  };

  getRun = async (runId: string): Promise<AdvisorRun | undefined> =>
    (await this.listRuns({ run_id: runId }))[0];

  listChecks = async (): Promise<AdvisorCheck[]> => {
    const response = await this.request.get(apiEndpoints.advisors.checks, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { checks: AdvisorCheck[] }).checks;
  };

  listInsights = async (filters: Record<string, string> = {}): Promise<AdvisorInsight[]> => {
    const response = await this.request.get(apiEndpoints.advisors.insights, {
      headers: GrafanaHelper.getAuthHeader(),
      params: filters,
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as PaginatedResponse<AdvisorInsight>).results ?? [];
  };

  listRuns = async (filters: Record<string, string> = {}): Promise<AdvisorRun[]> => {
    const response = await this.request.get(apiEndpoints.advisors.runs, {
      headers: GrafanaHelper.getAuthHeader(),
      params: filters,
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as PaginatedResponse<AdvisorRun>).results ?? [];
  };

  listSchedules = async (): Promise<AdvisorSchedule[]> => {
    const response = await this.requestGet(apiEndpoints.advisors.schedules);

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { schedules: AdvisorSchedule[] }).schedules;
  };

  listServices = async (): Promise<AdvisorTargetService[]> => {
    const response = await this.requestGet(apiEndpoints.advisors.services);

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { services: AdvisorTargetService[] }).services;
  };

  listTestTargets = async (technology: AdvisorCheckTechnology): Promise<AdvisorTestTarget[]> => {
    const response = await this.request.get(apiEndpoints.advisors.testTargets, {
      headers: GrafanaHelper.getAuthHeader(),
      params: { technology },
    });

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { targets: AdvisorTestTarget[] }).targets;
  };

  // The first whole UTC minute at least 20 s away, so a schedule set to it is saved before it falls due.
  static nextDueMinute = () => {
    const at = new Date(
      Math.ceil((Date.now() + Timeouts.TWENTY_SECONDS) / Timeouts.ONE_MINUTE) * Timeouts.ONE_MINUTE,
    );

    return { at, time: at.toISOString().slice(11, 16) };
  };

  requestCreateSchedule = async (
    schedule: Partial<AdvisorScheduleInput>,
    headers = GrafanaHelper.getAuthHeader(),
  ): Promise<APIResponse> =>
    await this.request.post(apiEndpoints.advisors.schedules, { data: schedule, headers });

  requestDeleteCheck = async (name: string, headers = GrafanaHelper.getAuthHeader()): Promise<APIResponse> =>
    await this.request.delete(`${apiEndpoints.advisors.checks}/${name}`, { headers });

  requestGet = async (endpoint: string, headers = GrafanaHelper.getAuthHeader()): Promise<APIResponse> =>
    await this.request.get(endpoint, { headers });

  requestRunSchedule = async (
    scheduleId: string,
    headers = GrafanaHelper.getAuthHeader(),
  ): Promise<APIResponse> =>
    await this.request.post(`${apiEndpoints.advisors.schedules}/${scheduleId}:run`, { headers });

  // With no service IDs, the checks run on every monitored service of their technology.
  requestStartChecks = async (names: string[] = [], serviceIds: string[] = []): Promise<APIResponse> =>
    await this.request.post(apiEndpoints.advisors.start, {
      data: { names, service_ids: serviceIds },
      headers: GrafanaHelper.getAuthHeader(),
    });

  requestTestCheck = async (serviceId: string, check: AdvisorCheckDefinition): Promise<APIResponse> =>
    await this.request.post(apiEndpoints.advisors.test, {
      data: { check, service_id: serviceId },
      headers: GrafanaHelper.getAuthHeader(),
    });

  requestTestNotification = async (
    emails: string[],
    severities: string[] = [],
    headers = GrafanaHelper.getAuthHeader(),
  ): Promise<APIResponse> =>
    await this.request.post(apiEndpoints.advisors.testNotification, {
      data: { email_addresses: emails, severities },
      headers,
    });

  requestUpdateCheck = async (name: string, check: Partial<AdvisorCheckDefinition>): Promise<APIResponse> =>
    await this.request.put(`${apiEndpoints.advisors.checks}/${name}`, {
      data: { check },
      headers: GrafanaHelper.getAuthHeader(),
    });

  runChecksAndWait = async (
    names: string[] = [],
    serviceIds: string[] = [],
    timeout = Timeouts.TWO_MINUTES,
  ): Promise<AdvisorRun> => await this.waitForRun(await this.startChecks(names, serviceIds), timeout);

  runSchedule = async (scheduleId: string, headers = GrafanaHelper.getAuthHeader()): Promise<string> => {
    const response = await this.requestRunSchedule(scheduleId, headers);

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { run_id: string }).run_id;
  };

  static scheduleInput = (overrides: Partial<AdvisorScheduleInput> = {}): AdvisorScheduleInput => ({
    check_names: [],
    days_of_week: [1, 2, 3, 4, 5],
    email_addresses: [],
    email_mode: AdvisorScheduleEmailMode.off,
    email_severities: [],
    enabled: true,
    name: AdvisorsApi.scheduleName(),
    service_ids: [],
    time_of_day: '10:00',
    ...overrides,
  });

  static scheduleName = () => `QA schedule ${Date.now()}_${Math.floor(Math.random() * 1_000)}`;

  startChecks = async (names: string[] = [], serviceIds: string[] = []): Promise<string> => {
    const response = await this.requestStartChecks(names, serviceIds);

    expect(response.status(), await response.text()).toEqual(200);

    return ((await response.json()) as { run_id: string }).run_id;
  };

  // Runs never overlap, so the newest one is the only one that can still be active.
  waitForNoActiveRun = async (timeout = Timeouts.FIVE_MINUTES) => {
    await expect
      .poll(
        async () =>
          [AdvisorRunStatus.queued, AdvisorRunStatus.running].includes(
            (await this.listRuns({ page_size: '1' }))[0]?.status,
          ),
        { message: 'An Advisor run is still active', timeout },
      )
      .toBe(false);
  };

  waitForRun = async (runId: string, timeout = Timeouts.TWO_MINUTES): Promise<AdvisorRun> => {
    let run: AdvisorRun | undefined;

    await expect
      .poll(async () => (run = await this.getRun(runId))?.status, {
        message: `Advisor run ${runId} did not complete`,
        timeout,
      })
      .toEqual(AdvisorRunStatus.completed);

    return run as AdvisorRun;
  };

  waitForScheduledRun = async (scheduleId: string, timeout = Timeouts.TWO_MINUTES): Promise<AdvisorRun> => {
    let runs: AdvisorRun[] = [];

    await expect
      .poll(
        async () => (runs = await this.listRuns({ schedule_id: scheduleId })).map(({ status }) => status),
        {
          message: `No run of schedule ${scheduleId} completed`,
          timeout,
        },
      )
      .toContain(AdvisorRunStatus.completed);

    return runs.find(({ status }) => status === AdvisorRunStatus.completed) as AdvisorRun;
  };
}
