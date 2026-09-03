# .claude/skills/linode-docker-provisioning/SKILL.md — commands over the exec channel run with an empty HOME

- Added: 2026-09-03
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: `run.sh <run_id> -- "echo HOME=$HOME"` printed `HOME=`, so `minikube start --force --driver=docker` launched from `/root/pmm-qa/k8s` wrote its kubeconfig and certs under that CWD; every later kubectl/helm call failed with `unable to read certificate-authority /root/pmm-qa/k8s/.kube/.minikube/ca.crt: no such file or directory` and the bats suite ran against a broken cluster, costing a `minikube delete --all --purge` and a full 500 MB kicbase re-download.
- Proposed change: in the run.sh caveats, state that the exec channel provides no HOME and require `export HOME=/root` at the top of every script run on the box — including inside a detached/nohup script, since the export does not carry over from the run.sh invocation.
