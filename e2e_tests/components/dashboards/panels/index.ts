import BarGaugePanel from './barGauge.component';
import { Page } from '@playwright/test';
import BarTimePanel from '@components/dashboards/panels/barTime.component';
import GaugePanel from '@components/dashboards/panels/gauge.component';
import PolyStatPanel from '@components/dashboards/panels/polyStat.component';
import StatPanel from '@components/dashboards/panels/stat.component';
import StateTimePanel from '@components/dashboards/panels/stateTime.component';
import TablePanel from '@components/dashboards/panels/table.component';
import TextPanel from '@components/dashboards/panels/text.component';
import TimeSeriesPanel from '@components/dashboards/panels/timeSeries.component';

const panels = (page: Page) => ({
  barGauge: new BarGaugePanel(page),
  barTime: new BarTimePanel(page),
  gauge: new GaugePanel(page),
  polyStat: new PolyStatPanel(page),
  stat: new StatPanel(page),
  stateTime: new StateTimePanel(page),
  table: new TablePanel(page),
  text: new TextPanel(page),
  timeSeries: new TimeSeriesPanel(page),
});

export default panels;
