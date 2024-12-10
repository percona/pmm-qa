import subprocess

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True).stdout.splitlines()

psContainerName = ""
pgsqlContainerName = ""
firstMongoReplica = ""
secondMongoReplica = ""
thirdMongoReplica = ""

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
print(psContainerStatus)