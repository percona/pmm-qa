import QueryAnalyticsPage from '@pages/qan/queryAnalytics.page';
import { expect } from '@playwright/test';

// Start session lands on the sessions list, for MySQL and MongoDB alike.
export const startSessionFromSelection = async (
  queryAnalytics: QueryAnalyticsPage,
  serviceIds: string[],
  sessionNames: string[],
) => {
  const { rta } = queryAnalytics;

  await rta.selectServiceOptions(serviceIds);
  await queryAnalytics.buttons.startSessionButton.click();

  await expect(rta.elements.sessionsTable).toBeVisible();

  for (const sessionName of sessionNames) {
    await expect(rta.builders.sessionRow(sessionName)).toBeVisible();
  }
};

// A session name opens the live view of its own services; the view's picker adds the others.
export const openSessionFromList = async (
  queryAnalytics: QueryAnalyticsPage,
  sessionName: string,
  otherServiceIds: string[] = [],
) => {
  const { rta } = queryAnalytics;

  await rta.builders.sessionLink(sessionName).click();

  await expect(rta.elements.realTimeTable).toBeVisible();

  if (otherServiceIds.length > 0) {
    await rta.inputs.clusterService.click();
    await rta.selectServiceOptions(otherServiceIds);
  }
};
