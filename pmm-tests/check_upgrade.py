#!/usr/bin/env python
import argparse
import os
import subprocess
import sys
import unittest

NOT_RUNNING_MSG = 'Status is Not "running"!'
WRONG_VERSION_MSG = 'Unexpected version!'
POST_UPGRADE = 'Post-upgrade test'
RUNNING = 'RUNNING'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('-v', '--version', help="Expected PMM version")
    parser.add_argument('-p', '--pre_post', help="Pass 'pre' from pre-upgrade stage and pass 'post' for post-upgrade "
                                                 "stage", default='post')
    parser.add_argument('-e', '--env', help="Pass 'ami' if it is AMI env, otherwise leave empty", default='not_ami')
    return parser.parse_args()


def verify_command(command):
    """
    Executes shell specified command and return the console output.
    If the exit code was non-zero it raises a CalledProcessError.

    :param  command:    shell command string to execute
    :type   command:    str
    :return:            command console output
    :rtype:             str
    :raises:            a CalledProcessError if the exit code was non-zero.
    """
    from tempfile import TemporaryFile
    with TemporaryFile() as output:
        return subprocess.check_output(command, shell=True, universal_newlines=True, stderr=output).rstrip()


class PmmServerComponents(unittest.TestCase):
    """
    Collection of tests for the PMM Server container. Supports both "Docker/Podman" and "AMI" instances.

    Also includes 2 suits of tests to verify PMM Server instance:
        * general test (use '-p pre' commandline argument)
        * upgraded from previous version (default one or use '-p post' commandline argument to switch explicitly)

    How to run:
        * python3 ./check_upgrade.py --env=ami --pre_post=pre --version=2.41.0
        * python3 ./check_upgrade.py -v 2.41.0 -p post
    """

    def test_percona_qan_api2_version(self):
        self.assertIn(expected_pmm_version, grep_rpm('percona-qan-api2-'), WRONG_VERSION_MSG)

    def test_percona_dashboards_version(self):
        self.assertIn(expected_pmm_version, grep_rpm('percona-dashboards-'), WRONG_VERSION_MSG)

    def test_clickhouse_version(self):
        """PMM-12223 - Verify Clickhouse is v23.8 or later since 2.41.0"""
        if expected_pmm_minor_version < 41: self.skipTest('Since version 2.41.0')
        if is_ami:
            out = verify_command('sudo clickhouse local --version')
        else:
            out = verify_command(f"docker exec {pmm_server_docker_container} clickhouse local --version")
        self.assertIn('23.8.2.7', out, WRONG_VERSION_MSG)

    def test_pmm_update_version(self):
        if expected_pmm_version == "2.25.0": self.skipTest('not fo 2.25.0!')
        self.assertIn(expected_pmm_version, grep_rpm('pmm-update-'), WRONG_VERSION_MSG)

    def test_pmm_managed_version(self):
        self.assertIn(expected_pmm_version, grep_rpm('pmm-managed-'), WRONG_VERSION_MSG)

    def test_pmm_client_version(self):
        self.assertIn(expected_pmm_version, verify_command("docker exec " + pmm_server_docker_container + " pmm-admin --version | grep PMMVersion | awk -F \" \" \'{print $2}\'"), WRONG_VERSION_MSG)

    def test_dbaas_controller_version(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        self.assertIn(expected_pmm_version, grep_rpm('dbaas-controller-'), WRONG_VERSION_MSG)

    def test_pmm_dump_version(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        self.assertIn(expected_pmm_version, grep_rpm('pmm-dump-'), WRONG_VERSION_MSG)

    def test_qan_api2_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('qan-api2'), NOT_RUNNING_MSG)

    def test_alert_manager_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('alertmanager'), NOT_RUNNING_MSG)

    def test_clickhouse_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('clickhouse'), NOT_RUNNING_MSG)

    def test_grafana_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('grafana'), NOT_RUNNING_MSG)

    def test_nginx_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('nginx'), NOT_RUNNING_MSG)

    def test_pmm_agent_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('pmm-agent'), NOT_RUNNING_MSG)

    def test_pmm_managed_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('pmm-managed'), NOT_RUNNING_MSG)

    def test_postgresql_status(self):
        self.assertIn(RUNNING, grep_supervisor_status('postgresql'), NOT_RUNNING_MSG)

    def test_victoriametrics_status(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        self.assertIn(RUNNING, grep_supervisor_status('victoriametrics'), NOT_RUNNING_MSG)

    def test_victoria_metrics_alert_status(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        self.assertIn(RUNNING, grep_supervisor_status('vmalert'), NOT_RUNNING_MSG)

    def test_victoria_metrics_version(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        if is_ami:
            out = verify_command('sudo victoriametrics --version')
        else:
            out = verify_command(f"docker exec {pmm_server_docker_container} victoriametrics --version")
        self.assertIn('v1.93.4', out, WRONG_VERSION_MSG)

    def test_vertamedia_clickhouse_plugin_absent(self):
        # """PMM-T1758 - Verify vertamedia-clickhouse-datasource plugin is not installed after upgrade to 2.38.0"""
        if expected_pmm_minor_version < 38: self.skipTest('Since version 2.41.0')
        if is_ami:
            out = verify_command(f"{grafana_cli} plugins ls")
        else:
            out = verify_command(
                f"docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ "
                f"{pmm_server_docker_container} {grafana_cli} plugins ls")
        self.assertNotIn('vertamedia', out, 'Must be absent!')

        # Disabled tests AMI+Docker:
        # verify_command('grafana cli plugins ls | grep alexanderzobnin-zabbix-app')
        # if (do_docker_way == "yes" and pmm_minor_v > 22) or (do_docker_way != "yes"):
        #     verify_command(
        #         f"docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ {pmm_server_docker_container} "
        #         f"{grafana_cli} plugins ls | grep alexanderzobnin-zabbix-app")

        # verify_command('grafana cli plugins ls | grep "vertamedia-clickhouse-datasource @ 2.4.4"')
        # verify_command(
        #     f"docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ {pmm_server_docker_container} "
        #     f"{grafana_cli} plugins ls | grep \"vertamedia-clickhouse-datasource @ 2.4.4\"")


if __name__ == '__main__':
    args = parse_args()
    expected_pmm_version = args.version
    expected_pmm_minor_version = int(args.version.split('.')[1])
    test_mode = args.pre_post
    is_ami = args.env in "ami"

    do_docker_way = os.getenv("PERFORM_DOCKER_WAY_UPGRADE")
    grafana_cli = "grafana cli" if expected_pmm_minor_version >= 39 else "grafana-cli"
    if not is_ami:
        pmm_server_docker_container = verify_command(
            """docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}'""")
        assert pmm_server_docker_container, "No docker container found!"


    def grep_rpm(query):
        """Polymorphic shortcut to use in test"""
        if is_ami:
            return verify_command(f"rpm -qa | grep {query}")
        else:
            return verify_command(f"docker exec {pmm_server_docker_container} rpm -qa | grep {query}")


    def grep_supervisor_status(name):
        """Polymorphic shortcut to use in test"""
        if is_ami:
            return verify_command(f"sudo supervisorctl status | grep {name}")
        else:
            return verify_command(f"docker exec {pmm_server_docker_container} supervisorctl status | grep {name}")


    # leaving sys.argv[0] alone
    del sys.argv[1:]
    unittest.main(verbosity=2)
