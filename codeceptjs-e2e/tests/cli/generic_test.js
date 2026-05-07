Feature('Generic PMM Server CLI Tests');

BeforeSuite(async ({ I }) => {
  await I.verifyCommand(`PMM_SERVER_IMAGE=${process.env.DOCKER_VERSION} docker compose -f docker-compose-ubuntu.yml up -d`);
});

AfterSuite(async ({ I }) => {
  await I.verifyCommand('docker rm -f pmm-server-default-scrape');
  await I.verifyCommand('docker rm -f pmm-server-custom-scrape');
  await I.verifyCommand('docker compose -f docker-compose-ubuntu.yml down -v');
});

After(async ({ I }) => {
  const serverIp = await I.verifyCommand('curl ifconfig.me');
  const username = 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin';

  await I.verifyCommand('docker rm -f pmm-client-scrape');
  await I.verifyCommand(`sudo pmm-admin config --force '--server-url=https://${username}:${password}@0.0.0.0:443' --server-insecure-tls ${serverIp}`);
  await I.verifyCommand('docker rm -f pg-local ubuntu');
});

Scenario(
  'PMM-T1201 - Verify yum-cron updates are removed from PMM Server',
  async ({ I }) => {
    const pmm_server = await I.verifyCommand('docker ps --format "table {{.ID}}\\t{{.Image}}\\t{{.Names}}" | grep \'pmm-server\' | awk \'{print $3}\'');

    await I.verifyCommand(
      `docker exec ${pmm_server} supervisorctl status | grep cron`,
      '',
      'fail',
    );
    await I.verifyCommand(
      `docker exec ${pmm_server} ps aux | grep cron | grep -v grep`,
      '',
      'fail',
    );
  },
);

Scenario(
  'PMM-T1696 - Verify that PostgreSQL exporter collects uptime on Ubuntu',
  async ({ I }) => {
    await I.wait(30);
    await I.verifyCommand('docker exec pmm-client-ubuntu pmm-admin list', 'postgres-ubuntu', 'pass');
    await I.verifyCommand(
      'docker exec pmm-client-ubuntu curl -s -u pmm:agentpass localhost:42002/metrics | grep "pg_postmaster_uptime_seconds"',
      'pg_postmaster_uptime_seconds',
      'pass',
    );
  },
);
