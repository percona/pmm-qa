import { APIRequestContext, expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';

interface Dump {
  dump_id: string;
  status: string;
}

export default class DumpApi {
  constructor(private request: APIRequestContext) {}

  createDump = async (serviceNames: string[] = [], exportQan = true): Promise<Pick<Dump, 'dump_id'>> => {
    const endTime = new Date();
    const response = await this.request.post(apiEndpoints.dumps.start, {
      data: {
        enable_encryption: false,
        end_time: endTime.toISOString(),
        export_qan: exportQan,
        ignore_load: true,
        service_names: serviceNames,
        start_time: new Date(endTime.getTime() - 5 * 60_000).toISOString(),
      },
      headers: GrafanaHelper.getAuthHeader(),
      timeout: Timeouts.ONE_MINUTE,
    });

    expect(response.status()).toEqual(200);

    return (await response.json()) as Pick<Dump, 'dump_id'>;
  };

  downloadDump = async (dumpId: string): Promise<Buffer> => {
    const response = await this.request.get(`${apiEndpoints.dumps.download}/${dumpId}.tar.gz`, {
      headers: GrafanaHelper.getAuthHeader(),
      timeout: Timeouts.ONE_MINUTE,
    });

    expect(response.status()).toEqual(200);

    return response.body();
  };

  getDump = async (dumpId: string): Promise<Dump | undefined> => {
    const response = await this.request.get(apiEndpoints.dumps.list, {
      headers: GrafanaHelper.getAuthHeader(),
      timeout: Timeouts.ONE_MINUTE,
    });

    expect(response.status()).toEqual(200);

    return ((await response.json()) as { dumps?: Dump[] }).dumps?.find((dump) => dump.dump_id === dumpId);
  };
}
