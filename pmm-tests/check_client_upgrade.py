import subprocess

containers = subprocess.run(["docker", "ps", "-a"], capture_output=True, text=True) .stdout.splitlines()

print(containers)