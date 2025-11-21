export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'text'
  | 'stat'
  | 'polyStat'
  | 'barGauge'
  | 'barTime'
  | 'stateTime'
  | 'summary'
  | 'unknown'
  | 'empty';

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
