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

export interface ScrapeTarget {
  health: 'down' | 'unknown' | 'up';
  labels: Record<string, string>;
  lastError: string;
  scrapeUrl: string;
}
