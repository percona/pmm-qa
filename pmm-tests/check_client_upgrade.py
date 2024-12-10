import subprocess

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True) .stdout.splitlines()

psContainerName = ""
pgsqlContainerName = ""

print(containers)

for i in range(len(containers)):
  if "ps_pmm_" in containers[i]:
      psContainerName = containers[i][containers[i].index("ps_pmm"):]
      print(psContainerName)
  elif "pgsql_pgss_pmm" in containers[i]:
      pgsqlContainerName = containers[i][containers[i].index("pgsql_pgss_pmm"):]
      print(pgsqlContainerName)