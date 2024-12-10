import subprocess

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True) .stdout.splitlines()

for i in range(len(containers)):
  print(containers[i])
  if "ps_pmm_" in containers[i]:
      print("Found Start")
      print(containers[i])
      print("Found End")