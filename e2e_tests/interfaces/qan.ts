export interface QanPeriod {
  period_start_from: string;
  period_start_to: string;
}

export interface QanResponse<T = Record<string, unknown>> {
  body: T;
  status: number;
  text: string;
}

export interface QanMetricsBody {
  metrics?: Record<string, { sum?: number }>;
}

export interface QanLabelsBody {
  labels?: Record<string, { values?: string[] }>;
}

export interface QanExampleBody {
  query_examples?: { example?: string }[];
}

export interface QanPlanBody {
  planid?: string;
  query_plan?: string;
}

export interface QanHistogramBody {
  histogram_items?: unknown[];
}

export interface QanReportBody {
  rows?: { dimension?: string; fingerprint?: string }[];
}
