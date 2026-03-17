import subprocess
import sys

arguments = sys.argv
print(arguments)

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True).stdout.splitlines()

def verify_agent_status(list, service_name):
    if any('Waiting' in name or 'Done' in name or 'Unknown' in name or 'Initialization Error' in name or 'Stopping' in name for name in list):
        errors.append(f"Agent status contains wrong status in {service_name} container. Error in: {list}")
    if all('Running' not in name for name in list):
        errors.append(f"Agent status does not contain running status in {service_name} container. Error in: {list}")

def get_pmm_admin_status(service_type):
    container_name = containers[i][containers[i].index(service_type):]
    return subprocess.run(["docker", "exec", container_name, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()

def get_pmm_admin_list(service_type):
    container_name = containers[i][containers[i].index(service_type):]
    return subprocess.run(["docker", "exec", container_name, "pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()

def get_agent_version(service_type):
    container_name = containers[i][containers[i].index(service_type):]
    agent_version_cmd = f'docker exec {container_name} sh -lc "pmm-admin status | grep pmm-admin | awk \'{{print \\$3}}\'"'
    print(f"Command is: {agent_version_cmd}")
    temp_version = subprocess.run(agent_version_cmd, capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip()

    print(f"Command line result is: ")
    print(subprocess.run(agent_version_cmd, capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip())
    print(subprocess.run(
        f'docker exec {container_name} sh -lc "pmm-admin status | grep pmm-admin | awk \'{{print \\$3}}\'"',
        capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip())
    print(subprocess.run(
        f'docker exec {container_name} sh -lc "pmm-admin status | grep pmm-admin',
        capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip())
    print(f"Version of pmm agent for container name: {container_name} is: {temp_version}")
    return subprocess.run(agent_version_cmd, capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip()

psContainerStatus = []
pgContainerStatus = []
firstMongoReplicaStatus = []
secondMongoReplicaStatus = []
thirdMongoReplicaStatus = []
psSSLStatus = []
pdpgsqlSSLStatus = []
psmdbSSLStatus = []

psContainerList = []
pgContainerList = []
firstMongoReplicaList = []
secondMongoReplicaList = []
thirdMongoReplicaList = []
psSSLList = []
pdpgsqlSSLList = []
psmdbSSLList = []
admin_version = ""

errors = []

for i in range(len(containers)):
  if "ps_pmm_" in containers[i]:
    psContainerStatus = get_pmm_admin_status("ps_pmm")
    psContainerList = get_pmm_admin_list("ps_pmm")
    admin_version = get_agent_version("ps_pmm")
    print(f"Actual agent version is: {admin_version}")
  elif "pgsql_pgss_pmm" in containers[i]:
    pgContainerStatus = get_pmm_admin_status("pgsql_pgss_pmm")
    pgContainerList = get_pmm_admin_list("pgsql_pgss_pmm")
    admin_version = get_agent_version("pgsql_pgss_pmm")
    print(f"Actual agent version is: {admin_version}")
  elif "rs101" in containers[i]:
    firstMongoReplicaStatus = get_pmm_admin_status("rs101")
    firstMongoReplicaList = get_pmm_admin_list("rs101")
    admin_version = get_agent_version("rs101")
  elif "rs102" in containers[i]:
    secondMongoReplicaStatus = get_pmm_admin_status("rs102")
    secondMongoReplicaList = get_pmm_admin_list("rs102")
    admin_version = get_agent_version("rs102")
  elif "rs103" in containers[i]:
    thirdMongoReplicaStatus = get_pmm_admin_status("rs103")
    thirdMongoReplicaList = get_pmm_admin_list("rs103")
    admin_version = get_agent_version("rs103")
  elif "mysql_ssl" in containers[i]:
    psSSLStatus = get_pmm_admin_status("mysql_ssl")
    psSSLList = get_pmm_admin_list("mysql_ssl")
    admin_version = get_agent_version("mysql_ssl")
  elif "pdpgsql_pgsm_ssl" in containers[i]:
    pdpgsqlSSLStatus = get_pmm_admin_status("pdpgsql_pgsm_ssl")
    pdpgsqlSSLList = get_pmm_admin_list("pdpgsql_pgsm_ssl")
    admin_version = get_agent_version("pdpgsql_pgsm_ssl")
  elif "psmdb-server" in containers[i]:
    psmdbSSLStatus = get_pmm_admin_status("psmdb-server")
    psmdbSSLList = get_pmm_admin_list("psmdb-server")
    admin_version = get_agent_version("psmdb-server")

if len(psContainerStatus) > 0:
    verify_agent_status(psContainerStatus, "Percona Server")
    verify_agent_status(psContainerList, "Percona Server")

if len(pgContainerStatus) > 0:
    verify_agent_status(pgContainerStatus, "Percona Distribution for PostgreSQL")
    verify_agent_status(pgContainerList, "Percona Distribution for PostgreSQL")

if len(psSSLStatus) > 0:
    verify_agent_status(psSSLStatus, "Percona Server SSl")
    verify_agent_status(psSSLList, "Percona Server SSl")

if len(pdpgsqlSSLStatus) > 0:
    verify_agent_status(pdpgsqlSSLStatus, "Percona Distribution for PostgreSQL SSL")
    verify_agent_status(pdpgsqlSSLList, "Percona Distribution for PostgreSQL SSL")

if len(psmdbSSLStatus) > 0:
    verify_agent_status(psmdbSSLStatus, "Percona Server for MongoDB instance SSL status")
    verify_agent_status(psmdbSSLList, "Percona Server for MongoDB instance SSL list")

if len(firstMongoReplicaStatus) > 0:
    verify_agent_status(firstMongoReplicaStatus, "Percona Server for MongoDB instance 1")
    verify_agent_status(firstMongoReplicaList, "Percona Server for MongoDB instance 1")

if len(secondMongoReplicaStatus) > 0:
    verify_agent_status(secondMongoReplicaStatus, "Percona Server for MongoDB instance 2")
    verify_agent_status(secondMongoReplicaList, "Percona Server for MongoDB instance 2")

if len(thirdMongoReplicaStatus) > 0:
    verify_agent_status(thirdMongoReplicaStatus, "Percona Server for MongoDB instance 3")
    verify_agent_status(thirdMongoReplicaList, "Percona Server for MongoDB instance 3")

if len(errors) > 0:
  raise Exception("Some errors in pmm-admin status: ".join(errors))

expected_version=arguments[1].replace("\\r\\n", "").replace("-rc", "")


if admin_version != expected_version:
  print(f"admin version is: {admin_version} and expected version is: {expected_version}")
  errors.append(f"Version of pmm admin is not correct expected: {expected_version} actual: {admin_version}")

agent_version = subprocess.run(["pmm-admin status | grep pmm-agent | awk -F' ' '{print $3}'"], capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip()

if agent_version != expected_version:
  print(f"agent version is: {agent_version} and expected version is: {expected_version}")
  errors.append(f"Version of pmm agent is not correct expected: {expected_version} actual: {agent_version}")

if admin_version != agent_version:
  errors.append(f"PMM admin version: {admin_version} does not equal PMM agent version {agent_version}")

if len(errors) > 0:
  raise Exception("Errors in pmm-admin and pmm-agent versions: ".join(errors))

