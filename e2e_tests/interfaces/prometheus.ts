export interface PrometheusSample {
  metric: Record<string, string>;
  value: [number, string];
}

export interface PrometheusQueryResponse {
  data: {
    result: PrometheusSample[];
    resultType: string;
  };
  status: string;
}
