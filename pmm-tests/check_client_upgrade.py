import subprocess

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True).stdout.splitlines()

psContainerName = ""
pgsqlContainerName = ""
firstMongoReplica = ""
secondMongoReplica = ""
thirdMongoReplica = ""
errors = []

print(containers)

for i in range(len(containers)):
  print(containers[i])
  if "ps_pmm_" in containers[i]:
      psContainerName = containers[i][containers[i].index("ps_pmm"):]
      print(psContainerName)
  elif "pgsql_pgss_pmm" in containers[i]:
      pgsqlContainerName = containers[i][containers[i].index("pgsql_pgss_pmm"):]
      print(pgsqlContainerName)
  elif "rs101" in containers[i]:
    firstMongoReplica = containers[i][containers[i].index("rs101"):]
    print(firstMongoReplica)
  elif "rs102" in containers[i]:
    secondMongoReplica = containers[i][containers[i].index("rs102"):]
    print(secondMongoReplica)
  elif "rs103" in containers[i]:
    thirdMongoReplica = containers[i][containers[i].index("rs103"):]
    print(thirdMongoReplica)

psContainerStatus = subprocess.run(["docker", "exec", psContainerName, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
pgContainerStatus = subprocess.run(["docker", "exec", pgsqlContainerName, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
firstMongoReplicaStatus = subprocess.run(["docker", "exec", firstMongoReplica, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
secondMongoReplicaStatus = subprocess.run(["docker", "exec", secondMongoReplica, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()
thirdMongoReplicaStatus = subprocess.run(["docker", "exec", thirdMongoReplica, "pmm-admin", "status"], capture_output=True, text=True).stdout.splitlines()

print(pgContainerStatus)

if "Waiting" in psContainerStatus or "Unknown" in psContainerStatus:
    errors.append("Not correct agent status in ps container.")

if "Waiting" in pgContainerStatus or "Unknown" in pgContainerStatus:
    errors.append("Not correct agent status in ps container.")

if "Waiting" in firstMongoReplicaStatus or "Unknown" in firstMongoReplicaStatus:
    errors.append("Not correct agent status in first mongo container.")

if "Waiting" in secondMongoReplicaStatus or "Unknown" in secondMongoReplicaStatus:
    errors.append("Not correct agent status in second mongo container.")

if "Waiting" in thirdMongoReplicaStatus or "Unknown" in thirdMongoReplicaStatus:
    errors.append("Not correct agent status in third mongo container.")

if errors.len() > 0:
  raise Exception("Some errors in pmm-admin status: " + errors)