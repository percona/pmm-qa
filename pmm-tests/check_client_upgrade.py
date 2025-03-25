import subprocess
import sys

arguments = sys.argv
print(arguments)

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True).stdout.splitlines()

psContainerName = ""
pgsqlContainerName = ""
firstMongoReplica = ""
secondMongoReplica = ""
thirdMongoReplica = ""
errors = []

for i in range(len(containers)):
  if "ps_pmm_" in containers[i]:
      psContainerName = containers[i][containers[i].index("ps_pmm"):]
  elif "pgsql_pgss_pmm" in containers[i]:
      pgsqlContainerName = containers[i][containers[i].index("pgsql_pgss_pmm"):]
  elif "rs101" in containers[i]:
    firstMongoReplica = containers[i][containers[i].index("rs101"):]
  elif "rs102" in containers[i]:
    secondMongoReplica = containers[i][containers[i].index("rs102"):]
  elif "rs103" in containers[i]:
    thirdMongoReplica = containers[i][containers[i].index("rs103"):]

psContainerStatus = subprocess.run(["docker", "exec", psContainerName, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
pgContainerStatus = subprocess.run(["docker", "exec", pgsqlContainerName, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
firstMongoReplicaStatus = subprocess.run(["docker", "exec", firstMongoReplica, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
secondMongoReplicaStatus = subprocess.run(["docker", "exec", secondMongoReplica, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
thirdMongoReplicaStatus = subprocess.run(["docker", "exec", thirdMongoReplica, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
localClientStatus = subprocess.run(["pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()

print("Status is: ")
print(psContainerStatus)
print(pgContainerStatus)
print(firstMongoReplicaStatus)
print(localClientStatus)


if "Waiting" in psContainerStatus or "Done" in psContainerStatus or "Unknown" in psContainerStatus or "Initialization Error" in psContainerStatus or "Stopping" in psContainerStatus:
    errors.append("Not correct agent status in ps container.")

if "Waiting" in pgContainerStatus or "Done" in pgContainerStatus or "Unknown" in pgContainerStatus or "Initialization Error" in pgContainerStatus or "Stopping" in pgContainerStatus:
    errors.append("Not correct agent status in ps container.")

if "Waiting" in firstMongoReplicaStatus or "Done" in firstMongoReplicaStatus or "Unknown" in firstMongoReplicaStatus or "Initialization Error" in firstMongoReplicaStatus or "Stopping" in firstMongoReplicaStatus:
    errors.append("Not correct agent status in first mongo container.")

if "Waiting" in secondMongoReplicaStatus or "Done" in secondMongoReplicaStatus or"Unknown" in secondMongoReplicaStatus or "Initialization Error" in secondMongoReplicaStatus or "Stopping" in secondMongoReplicaStatus:
    errors.append("Not correct agent status in second mongo container.")

if "Waiting" in thirdMongoReplicaStatus or "Done" in thirdMongoReplicaStatus or "Unknown" in thirdMongoReplicaStatus or "Initialization Error" in thirdMongoReplicaStatus or "Stopping" in thirdMongoReplicaStatus:
    errors.append("Not correct agent status in third mongo container.")

if "Waiting" in localClientStatus or "Done" in localClientStatus or "Unknown" in localClientStatus or "Initialization Error" in localClientStatus or "Stopping" in localClientStatus:
    errors.append("Not correct agent status in third mongo container.")

if len(errors) > 0:
  raise Exception("Some errors in pmm-admin status: ".join(errors))

psContainerList = subprocess.run(["docker", "exec", psContainerName, "pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()
pgContainerList = subprocess.run(["docker", "exec", pgsqlContainerName, "pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()
firstMongoReplicaList = subprocess.run(["docker", "exec", firstMongoReplica, "pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()
secondMongoReplicaList = subprocess.run(["docker", "exec", secondMongoReplica, "pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()
thirdMongoReplicaList = subprocess.run(["docker", "exec", thirdMongoReplica, "pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()
localClientList = subprocess.run(["pmm-admin", "list"], capture_output=True, text=True).stdout.splitlines()

if "Waiting" in psContainerList or "Done" in psContainerList or "Unknown" in psContainerList or "Initialization Error" in psContainerList or "Stopping" in psContainerList:
    errors.append("Not correct agent status in ps container.")

if "Waiting" in pgContainerList or "Done" in pgContainerList or "Unknown" in pgContainerList or "Initialization Error" in pgContainerList or "Stopping" in pgContainerList:
    errors.append("Not correct agent status in ps container.")

if "Waiting" in firstMongoReplicaList or "Done" in firstMongoReplicaList or "Unknown" in firstMongoReplicaList or "Initialization Error" in firstMongoReplicaList or "Stopping" in firstMongoReplicaList:
    errors.append("Not correct agent status in first mongo container.")

if "Waiting" in secondMongoReplicaList or "Done" in secondMongoReplicaList or"Unknown" in secondMongoReplicaList or "Initialization Error" in secondMongoReplicaList or "Stopping" in secondMongoReplicaList:
    errors.append("Not correct agent status in second mongo container.")

if "Waiting" in thirdMongoReplicaList or "Done" in thirdMongoReplicaList or "Unknown" in thirdMongoReplicaList or "Initialization Error" in thirdMongoReplicaList or "Stopping" in thirdMongoReplicaList:
    errors.append("Not correct agent status in third mongo container.")

if "Waiting" in localClientList or "Done" in localClientList or "Unknown" in localClientList or "Initialization Error" in localClientList or "Stopping" in localClientList:
    errors.append("Not correct agent status in third mongo container.")

if len(errors) > 0:
  raise Exception("Some errors in pmm-admin list: ".join(errors))

# serverVersion = subprocess.run(["pmm-admin status | grep \"Version\" | awk  -F' ' '{print $2}'"], capture_output=True, text=True, shell=True).stdout

expected_version=arguments[1].replace("\\r\\n", "")
admin_version = subprocess.run(["pmm-admin status | grep pmm-admin | awk -F' ' '{print $3}'"], capture_output=True, text=True, shell=True).stdout.replace("\\r\\n", "").strip()

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

def test():
    print("Inside of a method")