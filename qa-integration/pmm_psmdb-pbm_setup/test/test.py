import os

import requests
import pytest
import testinfra
import time
import json

docker_rs101 = testinfra.get_host('docker://rs101')
docker_rs102 = testinfra.get_host('docker://rs102')
docker_rs103 = testinfra.get_host('docker://rs103')
testinfra_hosts = ['docker://rs101', 'docker://rs102', 'docker://rs103']

pmm_server_url = os.getenv('PMM_SERVER_CONTAINER_ADDRESS')

pytest.location_id = ''
pytest.service_id = ''
pytest.artifact_id = ''
pytest.artifact_pbm_meta = ''
pytest.artifact_is_sharded = False
pytest.pbm_backup_name = ''
pytest.restore_id = ''


def test_pmm_services():
    req = requests.get(f"https://{pmm_server_url}/v1/inventory/services", json={},
                        headers={"authorization": "Basic YWRtaW46cGFzc3dvcmQ="}, verify=False)
    print('\nGetting all mongodb services:')
    mongodb = req.json()['mongodb']
    print(mongodb)
    assert mongodb
    assert "service_id" in mongodb[0]
    for service in mongodb:
        assert "rs" or "mongos" in service['service_name']
        if not "mongos" in service['service_name']:
            pytest.service_id = service['service_id']
    print('This service_id will be used in the next steps')
    print(pytest.service_id)


def test_pmm_add_location():
    data = {
        'name': 'test',
        'description': 'test',
        's3_config': {
            'endpoint': 'http://minio:9000',
            'access_key': 'minio1234',
            'secret_key': 'minio1234',
            'bucket_name': 'bcp'
        }
    }
    req = requests.post(f"https://{pmm_server_url}/v1/backups/locations", json=data,
                        headers={"authorization": "Basic YWRtaW46cGFzc3dvcmQ="}, verify=False)
    print('\nAdding new location:')
    print(req.json())
    assert "location_id" in req.json()
    pytest.location_id = req.json()['location_id']


def test_pmm_logical_backup():
    data = {
        'service_id': pytest.service_id,
        'location_id': pytest.location_id,
        'name': 'test',
        'description': 'test',
        'retries': 0,
        'data_model': 'DATA_MODEL_LOGICAL'
    }

    print(data)
    req = requests.post(f"https://{pmm_server_url}/v1/backups:start", json=data,
                        headers={"authorization": "Basic YWRtaW46cGFzc3dvcmQ="}, verify=False)
    print('\nCreating logical backup:')
    print(req.json())
    assert "artifact_id" in req.json()
    pytest.artifact_id = req.json()['artifact_id']


def test_pmm_artifact():
    backup_complete = False
    for i in range(600):
        done = False
        req = requests.get(f"https://{pmm_server_url}/v1/backups/artifacts", json={},
                            headers={"authorization": "Basic YWRtaW46cGFzc3dvcmQ="}, verify=False)
        assert req.json()['artifacts']
        for artifact in req.json()['artifacts']:
            if artifact['artifact_id'] == pytest.artifact_id:
                print('\nChecking artifact status')
                print(artifact['status'])
                if artifact['status'] == "BACKUP_STATUS_SUCCESS":
                    done = True
                    print('Artifact data:')
                    print(artifact)
                    pytest.artifact_pbm_meta = artifact['metadata_list'][0]['pbm_metadata']['name']
                    if "is_sharded_cluster" in artifact:
                        pytest.artifact_is_sharded = artifact['is_sharded_cluster']
                    break
        if done:
            backup_complete = True
            break
        else:
            time.sleep(1)
    assert backup_complete


def test_pbm_artifact():
    status = docker_rs101.check_output('pbm status --out json')
    parsed_status = json.loads(status)
    print('\nChecking if the backup is completed in pbm status')
    print(parsed_status)
    assert pytest.artifact_pbm_meta == parsed_status['backups']['snapshot'][0]['name']
    assert parsed_status['backups']['snapshot'][0]['status'] == "done"
    pytest.pbm_backup_name = parsed_status['backups']['snapshot'][0]['name']


def test_pmm_start_restore():
    if pytest.artifact_is_sharded == True:
        pytest.skip("Unsupported setup for restore from UI")
    data = {
        'service_id': pytest.service_id,
        'artifact_id': pytest.artifact_id
    }
    req = requests.post(f"https://{pmm_server_url}/v1/backups/restores:start", json=data,
                        headers={"authorization": "Basic YWRtaW46cGFzc3dvcmQ="}, verify=False)
    print('\nRestoring logical backup:')
    print(req.json())
    assert "restore_id" in req.json()
    pytest.restore_id = req.json()['restore_id']


def test_pmm_restore():
    if pytest.artifact_is_sharded == True:
        pytest.skip("Unsupported setup for restore from UI")
    restore_complete = False
    for i in range(600):
        done = False
        req = requests.get(f"https://{pmm_server_url}/v1/backups/restores", json={},
                            headers={"authorization": "Basic YWRtaW46cGFzc3dvcmQ="}, verify=False)
        assert req.json()['items']
        for item in req.json()['items']:
            if item['restore_id'] == pytest.restore_id:
                print('\nChecking restore status')
                print(item['status'])
                if item['status'] == "RESTORE_STATUS_SUCCESS":
                    done = True
                    print('Restore data:')
                    print(item)
                    break
        if done:
            restore_complete = True
            break
        else:
            time.sleep(1)
    assert restore_complete


def test_pbm_restore():
    if pytest.artifact_is_sharded == True:
        pytest.skip("Unsupported setup for restore from UI")
    restore_list = docker_rs101.check_output('pbm list --restore --out json')
    parsed_restore_list = json.loads(restore_list)
    print('\nChecking if the restore is completed in pbm status')
    print(parsed_restore_list)
    restore_complete = False
    for restore in parsed_restore_list:
        if restore['snapshot'] == pytest.pbm_backup_name:
            assert restore['status'] == "done"
            restore_complete = True

    assert restore_complete

def test_metrics():
    pmm_admin_list = json.loads(docker_rs101.check_output('pmm-admin list --json', timeout=30))
    for agent in pmm_admin_list['agent']:
        if agent['agent_type'] == 'AGENT_TYPE_MONGODB_EXPORTER':
            agent_id = "mypass"
            agent_port = agent['port']
            break
    try:
      command = f"curl -s http://pmm:{agent_id}@127.0.0.1:{agent_port}/metrics"
      metrics = docker_rs101.run(command, timeout=30)
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
