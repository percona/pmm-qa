import docker
import pytest
import testinfra
import re
import time
import os
import json

env_vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_USERNAME']

client = docker.from_env()
docker_pmm_client = testinfra.get_host('docker://psmdb-server')


def run_test(add_db_command):
    try:
        output = docker_pmm_client.check_output('pmm-admin list --json', timeout=30)
        services_info = json.loads(output)
    except (AssertionError, json.JSONDecodeError):
        pytest.fail("Failed to get or parse service list from pmm-admin")
    services_to_remove = []
    for service in services_info.get("service", []):
        service_type = service.get("service_type")
        service_name = service.get("service_name", "")
        if service_type == "SERVICE_TYPE_MONGODB_SERVICE" and service_name.startswith("psmdb-server"):
            services_to_remove.append(service_name)
    for service_name in services_to_remove:
        try:
            docker_pmm_client.check_output(f'pmm-admin remove mongodb {service_name}', timeout=30)
        except AssertionError:
            pass
    try:
        docker_pmm_client.check_output(add_db_command, timeout=30)
    except AssertionError:
        pytest.fail("Fail to add MongoDB to pmm-admin")
    time.sleep(30)

    pmm_admin_list = json.loads(docker_pmm_client.check_output('pmm-admin list --json', timeout=30))
    for agent in pmm_admin_list['agent']:
        if agent['agent_type'] == 'AGENT_TYPE_MONGODB_EXPORTER':
            agent_id = "mypass" if "GSSAPI" not in add_db_command else agent['agent_id']
            agent_port = agent['port']
            break
    try:
      command = f"curl -s http://pmm:{agent_id}@127.0.0.1:{agent_port}/metrics"
      metrics = docker_pmm_client.run(command, timeout=30)
      assert metrics.exit_status == 0, f"Curl command failed with exit status {metrics.exit_status}"
    except Exception as e:
      pytest.fail(f"Fail to get metrics from exporter")

    try:
        with open("expected_metrics.txt", "r") as f:
            expected_metrics = {line.strip() for line in f if line.strip()}
    except FileNotFoundError:
        pytest.fail("Expected metrics file not found")

    for metric in expected_metrics:
        if metric not in metrics.stdout:
            pytest.fail(f"Metric '{metric}' is missing from the exporter output")


def test_simple_auth_wo_tls():
    run_test('pmm-admin add mongodb psmdb-server --agent-password=mypass --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" ''--host '
             'psmdb-server --port 27017')


def test_simple_auth_tls():
    run_test('pmm-admin add mongodb psmdb-server --agent-password=mypass --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" '
             '--host psmdb-server --port 27017 '
             '--tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem '
             '--cluster=mycluster')

#####
# All tests for external authentication methods (X509, LDAP, Kerberos, AWS) rely on the `mongod` configuration to handle
# authentication using the selected method, followed by authorization via LDAP.
#
# Therefore, no users are added to `$external` database before testing. Instead, after successful authentication
# against the selected service, the username is transformed based on the pattern below to match LDAP user
# `cn=pmm-test,ou=users,dc=example,dc=org`.
# This user is preconfigured on LDAP server and, after authorization, inherits the privileges assigned in
# MongoDB to its default group, `cn=readers,ou=users,dc=example,dc=org`.
#
# Transformation pattern from `mongod` configuration:
# [{match: "arn:aws:iam::(.+):user/(.+)|CN=(.+)|([^@]+)@PERCONATEST.COM", substitution: "cn={1}{2}{3},ou=users,dc=example,dc=org"}]
#####

def test_x509_auth():
    run_test('pmm-admin add mongodb psmdb-server --agent-password=mypass --host=psmdb-server --port 27017 '
             '--tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem '
             '--authentication-mechanism=MONGODB-X509 --authentication-database=\'$external\' '
             '--cluster=mycluster')


def test_ldap_auth_wo_tls():
    run_test('pmm-admin add mongodb psmdb-server --agent-password=mypass --username="CN=pmm-test" --password=password1 '
             '--host=psmdb-server --port 27017 '
             '--authentication-mechanism=PLAIN --authentication-database=\'$external\' '
             '--cluster=mycluster')


def test_ldap_auth_tls():
    run_test('pmm-admin add mongodb psmdb-server --agent-password=mypass --username="CN=pmm-test" --password=password1 '
             '--host=psmdb-server --port 27017 '
             '--authentication-mechanism=PLAIN --authentication-database=\'$external\' '
             '--tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem '
             '--cluster=mycluster')

@pytest.mark.skip(reason="Kerberos support in PMM was reverted")
def test_kerberos_auth_wo_tls():
    run_test('pmm-admin add mongodb psmdb-server --username="pmm-test@PERCONATEST.COM" --password=password1 '
             '--host=psmdb-server --port 27017 '
             '--authentication-mechanism=GSSAPI --authentication-database=\'$external\' '
             '--cluster=mycluster')

@pytest.mark.skip(reason="Kerberos support in PMM was reverted")
def test_kerberos_auth_tls():
    run_test('pmm-admin add mongodb psmdb-server --username="pmm-test@PERCONATEST.COM" --password=password1 '
             '--host=psmdb-server --port 27017 '
             '--authentication-mechanism=GSSAPI --authentication-database=\'$external\' '
             '--tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem '
             '--cluster=mycluster')

@pytest.mark.skipif(
    any(not os.environ.get(var) for var in env_vars) or os.environ.get('SKIP_AWS_TESTS') == 'true',
    reason=f"One or more of AWS env var isn't defined or SKIP_AWS_TESTS is set to true")
def test_aws_auth_wo_tls():
    run_test(f'pmm-admin add mongodb psmdb-server --agent-password=mypass --username={os.environ.get("AWS_ACCESS_KEY_ID")}'
             f'--password={os.environ.get("AWS_SECRET_ACCESS_KEY")}'
             '--host=psmdb-server --port 27017 '
             '--authentication-mechanism=MONGODB-AWS --authentication-database=\'$external\' '
             '--cluster=mycluster')


@pytest.mark.skipif(
    any(not os.environ.get(var) for var in env_vars) or os.environ.get('SKIP_AWS_TESTS') == 'true',
    reason=f"One or more of AWS env var isn't defined or SKIP_AWS_TESTS is set to true")
def test_aws_auth_tls():
    run_test(f'pmm-admin add mongodb psmdb-server --agent-password=mypass --username={os.environ.get("AWS_ACCESS_KEY_ID")}'
             f'--password={os.environ.get("AWS_SECRET_ACCESS_KEY")}'
             '--host=psmdb-server --port 27017 '
             '--authentication-mechanism=MONGODB-AWS --authentication-database=\'$external\' '
             '--tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem '
             '--cluster=mycluster')
