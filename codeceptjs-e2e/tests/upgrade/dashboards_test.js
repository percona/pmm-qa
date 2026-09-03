const { isOvFAmiJenkinsJob } = require('../helper/constants');

Feature('PMM upgrade tests for dashboards');

Before(async ({ I }) => {
  await I.Authorize();
});

// mongodb dashboards test after upgrade replicaset cluster routers.
// mysql overview and postgres overview.
// invetory nodes, services and agents.