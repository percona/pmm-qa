echo "Setting up MongoDB replica set with PBM"
sudo percona-release enable pbm release && sudo yum -y install percona-backup-mongodb
#setup_docker_compose
mkdir -p /tmp/mongodb_backup_replica || :
cd /tmp/mongodb_backup_replica
if [ ! -d "pmm-ui-tests" ]; then
  git clone -b main https://github.com/percona/pmm-ui-tests
fi
cd pmm-ui-tests
bash -x testdata/backup-management/mongodb/setup-replica-and-pbm.sh