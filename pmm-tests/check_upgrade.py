#!/usr/bin/env python
import argparse
import os
import subprocess
import sys
import unittest


POST_UPGRADE = 'Post-upgrade test'
RUNNING = 'RUNNING'
pmm_server_docker_container = ''


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('-v', '--version', help="Expected PMM version")
    parser.add_argument('-p', '--pre_post', help="Pass 'pre' from pre-upgrade stage and pass 'post' for post-upgrade "
                                                 "stage", default='post')
    parser.add_argument('-e', '--env', help="Pass 'ami' if it is AMI env, otherwise leave empty", default='not_ami')
    return parser.parse_args()


def verify_command(command):
    from tempfile import TemporaryFile
    # with open("/tmp/output.log", "a") as output:
    with TemporaryFile() as output:
        try:
            return subprocess.check_output(command, shell=True, text=True, stderr=output).rstrip()
        except subprocess.CalledProcessError as e:
            assert e.returncode == 0, f"'{command}' exited with {e.returncode} {output.read()}"


class PmmServerComponents(unittest.TestCase):

    def test_percona_qan_api2_version(self):
        out = grep_rpm('percona-qan-api2-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_percona_dashboards_version(self):
        out = grep_rpm('percona-dashboards-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_clickhouse_version(self):
        """PMM-12223 - Verify Clickhouse is v23.8 or later since 2.41.0"""
        if pmm_minor_version < 41: self.skipTest('Since version 2.41.0')
        if is_ami:
            out = verify_command('sudo clickhouse local --version')
        else:
            out = verify_command(f"docker exec {get_container_name()} clickhouse local --version")
        self.assertIn('23.8.2.7', out, 'Unexpected version!')

    def test_pmm_update_version(self):
        if pmm_version != "2.25.0": self.skipTest('for 2.25.0 only!')
        out = grep_rpm('pmm-update-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_pmm_managed_version(self):
        out = grep_rpm('pmm-managed-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_pmm2_client_version(self):
        out = grep_rpm('pmm2-client-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_dbaas_controller_version(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        out = grep_rpm('dbaas-controller-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_pmm_dump_version(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        out = grep_rpm('pmm-dump-')
        self.assertIn(pmm_version, out, 'Unexpected version!')

    def test_qan_api2_status(self):
        out = grep_supervisor_status('qan-api2')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_alert_manager_status(self):
        out = grep_supervisor_status('alertmanager')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_clickhouse_status(self):
        out = grep_supervisor_status('clickhouse')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_grafana_status(self):
        out = grep_supervisor_status('grafana')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_nginx_status(self):
        out = grep_supervisor_status('nginx')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_pmm_agent_status(self):
        out = grep_supervisor_status('pmm-agent')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_pmm_managed_status(self):
        out = grep_supervisor_status('pmm-managed')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_postgresql_status(self):
        out = grep_supervisor_status('postgresql')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_victoriametrics_status(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        out = grep_supervisor_status('victoriametrics')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_victoria_metrics_alert_status(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        out = grep_supervisor_status('vmalert')
        self.assertIn(RUNNING, out, 'Status is Not running!')

    def test_victoria_metrics_version(self):
        if test_mode != "post": self.skipTest(POST_UPGRADE)
        if is_ami:
            out = verify_command('sudo victoriametrics --version').strip()
        else:
            out = verify_command(f"docker exec {get_container_name()} victoriametrics --version").strip()
        self.assertIn('v1.93.4', out, 'Unexpected version!')

    def test_vertamedia_clickhouse_plugin_absent(self):
        # """PMM-T1758 - Verify vertamedia-clickhouse-datasource plugin is not installed after upgrade to 2.38.0"""
        if pmm_minor_version < 38: self.skipTest('Since version 2.41.0')
        if is_ami:
            out = verify_command(f"{grafana_cli} plugins ls")
        else:
            out = verify_command(
                f"docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ "
                f"{get_container_name()} {grafana_cli} plugins ls")
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
    pmm_version = args.version
    pmm_minor_version = int(args.version.split('.')[1])
    test_mode = args.pre_post
    is_ami = args.env in "ami"
    do_docker_way = os.getenv("PERFORM_DOCKER_WAY_UPGRADE")
    grafana_cli = "grafana cli" if pmm_minor_version >= 39 else "grafana-cli"


    def get_container_name():
        """Lazi initialization"""
        global pmm_server_docker_container
        if not pmm_server_docker_container:
            pmm_server_docker_container = verify_command(
                """docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}'"""
            ).strip()
        return pmm_server_docker_container


    def grep_rpm(query):
        """Polymorphic shortcut to use in test"""
        if is_ami:
            return verify_command(f"rpm -qa | grep {query}")
        else:
            return verify_command(f"docker exec {get_container_name()} rpm -qa | grep {query}")


    def grep_supervisor_status(name):
        """Polymorphic shortcut to use in test"""
        if is_ami:
            return verify_command(f"sudo supervisorctl status | grep {name}")
        else:
            return verify_command(f"docker exec {get_container_name()} supervisorctl status | grep {name}")


    # leaving sys.argv[0] alone
    del sys.argv[1:]
    unittest.main(verbosity=2)
