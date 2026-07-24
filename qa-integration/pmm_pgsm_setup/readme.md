# PMM + PGSM Integration Tests Setup and Details #

## Setup ##
The environment setup for PMM & PGSM Integration tests is divided into three main parts.
1) PGSQL Setup on the host, with user provided version (default is v14)
2) PGSM extension, building (from user provided branch) and setting it up with the PGSQL version deployed in step 1
3) PMM Server and Client setup, connecting PGSQL with query-source as pg_stat_monitor to monitor the QAN data.


### PGSQL & PGSM Setup ###
We prepared a simple script that installs PGSQL version and sets up PGSM with it, the script is available on [pmm-qa repo](https://github.com/percona/pmm-qa/blob/main/pmm-tests/pg_stat_monitor_setup.sh)
we soon plan to migrate the setup related scripts to [qa-integration](https://github.com/Percona-Lab/qa-integration)

The steps executed are summarized below:
1) Used a docker container, to have ease of setup on developers/QA engineers local and CI/CD Infrastructure we decided 
to use [Base Image docker Container](https://github.com/phusion/baseimage-docker)
   
2) The script can use environment variables to setup different versions of Postgresql Server and build from any custom PGSM branch,
this gives developers + QA the flexibility to run Integrations tests locally, on Pull Requests with Continuous Integration
   
3) The script ensures PG_STAT_MONITOR extension is enabled and a Monitoring user is created which will be used for
pmm2-client and server connection
   
### PMM Client Setup ###
We used the same container to setup pgsql+pgsm and installing pmm2-client package inside this container (Base Image docker container),
so it could be added for monitoring to pmm-server, the 
[pmm2-client setup script](https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm2-client-setup.sh) 
just gives users an option to install desired version of pmm2-client inside this container.

### PMM-Server Setup ###
We setup PMM-Server and then use the [playbook from pmm-qa](https://github.com/percona/pmm-qa/blob/main/pmm-tests/pgsql_pgsm_setup.yml) 
which ensures pmm2-client & pgsm setup is ready to execute our e2e tests

### E2E Tests ###
E2E tests are available and easy to understand, they can be modified or access on the [pmm-ui-tests](https://github.com/percona/pmm-ui-tests/blob/main/tests/qa-integration/pmm_pgsm_integration_test.js)

Here are the things that are being tested as part of PMM & PGSM Integration Scenarios:
1) We run a sample load on a Database on Postgres and ensure the metrics we have on PGSM side matches the ones on Clickhouse
2) We ensure postgresql_pgstatmonitor_agent for QAN is in running status, the test would fail is the status is unknown/stopped/waiting
3) We ensure QAN UI shows filters for test database, including Application Name, Service Name, Command Types
4) We ensure metrics from this test service are also hitting PMM-Server and Reports show data when users load the postgresql Instance Summary Dashboard