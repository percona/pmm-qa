import re
import subprocess
import sys

arguments = sys.argv
print(arguments)

containers = subprocess.run(["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True, check=False).stdout.splitlines()

services = [
    ("ps_pmm_", "Percona Server"),
    ("pgsql_pgss_pmm", "Percona Distribution for PostgreSQL"),
    ("rs101", "Percona Server for MongoDB instance 1"),
    ("rs102", "Percona Server for MongoDB instance 2"),
    ("rs103", "Percona Server for MongoDB instance 3"),
    ("mysql_ssl", "Percona Server SSl"),
    ("pdpgsql_pgsm_ssl", "Percona Distribution for PostgreSQL SSL"),
    ("psmdb-server", "Percona Server for MongoDB instance SSL"),
]

errors = []

def verify_agent_status(list, service_name):
    if any('Waiting' in name or 'Done' in name or 'Unknown' in name or 'Initialization Error' in name or 'Stopping' in name for name in list):
        errors.append(f"Agent status contains wrong status in {service_name} container. Error in: {list}")
    if all('Running' not in name for name in list):
        errors.append(f"Agent status does not contain running status in {service_name} container. Error in: {list}")

def pmm_admin(container_name, command):
    return subprocess.run(["docker", "exec", container_name, "pmm-admin", command], capture_output=True, text=True, check=False)

def get_version(container_name, component):
    version_cmd = f'docker exec {container_name} sh -lc "pmm-admin status | grep {component} | awk \'{{print \\$3}}\'"'

    return subprocess.run(version_cmd, capture_output=True, text=True, shell=True, check=False).stdout.replace("\\r\\n", "").strip()

versions = []

for container_name in containers:
    service_name = next((name for marker, name in services if marker in container_name), None)
    if service_name is None:
        continue

    status = pmm_admin(container_name, "status")
    if status.returncode != 0 or not status.stdout.strip():
        errors.append(f"pmm-admin status failed in {service_name} container {container_name} (exit {status.returncode}): {status.stderr.strip()}")
        continue

    verify_agent_status(status.stdout.splitlines(), service_name)
    verify_agent_status(pmm_admin(container_name, "list").stdout.splitlines(), service_name)
    versions.append((container_name, get_version(container_name, "pmm-admin"), get_version(container_name, "pmm-agent")))

if len(errors) > 0:
  raise RuntimeError("Some errors in pmm-admin status: ".join(errors))

if not versions:
  raise RuntimeError(f"No running PMM client container found among: {containers}")

expected_version=arguments[1].replace("\\r\\n", "")

# CLIENT_VERSION may be a client tarball URL instead of a bare version: the upgrade
# matrix uses one for releases whose client deb is no longer in the apt repo. Parse
# it before stripping -rc, or a -rcN suffix corrupts the captured version.
if expected_version.startswith("http"):
  tarball_version = re.search(r"pmm-client-(\d+\.\d+\.\d+)", expected_version)
  if not tarball_version:
    raise RuntimeError(f"Cannot determine expected version from client tarball URL: {expected_version}")
  expected_version = tarball_version.group(1)

expected_version = re.sub(r"-rc\d*$", "", expected_version)

def matches_expected(version):
  return version == expected_version or version.startswith(expected_version + "-")

for container_name, admin_version, agent_version in versions:
  if not matches_expected(admin_version):
    print(f"{container_name}: admin version is: {admin_version} and expected version is: {expected_version}")
    errors.append(f"Version of pmm admin in {container_name} is not correct expected: {expected_version} actual: {admin_version}")

  if not matches_expected(agent_version):
    print(f"{container_name}: agent version is: {agent_version} and expected version is: {expected_version}")
    errors.append(f"Version of pmm agent in {container_name} is not correct expected: {expected_version} actual: {agent_version}")

  if admin_version != agent_version:
    errors.append(f"PMM admin version in {container_name}: {admin_version} does not equal PMM agent version {agent_version}")

if len(errors) > 0:
  raise RuntimeError("Errors in pmm-admin and pmm-agent versions: ".join(errors))
