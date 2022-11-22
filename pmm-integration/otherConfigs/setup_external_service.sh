wget https://github.com/oliver006/redis_exporter/releases/download/v1.14.0/redis_exporter-v1.14.0.linux-386.tar.gz
export NODE_PROCESS_EXPORTER_VERSION="0.7.5"gz
tar -xvf redis_exporter-v1.14.0.linux-386.tar.gz
rm redis_exporter*.tar.gz
mv redis_* redis_exporter
cd redis_exporter
docker run -d -p 6379:6379 redis '--requirepass oFukiBRg7GujAJXq3tmd'
sleep 10
touch redis.log
JENKINS_NODE_COOKIE=dontKillMe nohup bash -c './redis_exporter -redis.password=oFukiBRg7GujAJXq3tmd -redis.addr=localhost:6379 -web.listen-address=:42200 > redis.log 2>&1 &'
sleep 10
pmm-admin add external --listen-port=42200 --group="redis" --service-name="redis_external"
echo "Setting up node_process"
wget https://github.com/ncabatoff/process-exporter/releases/download/v${NODE_PROCESS_EXPORTER_VERSION}/process-exporter_${NODE_PROCESS_EXPORTER_VERSION}_linux_amd64.rpm
sudo rpm -i process-exporter_${NODE_PROCESS_EXPORTER_VERSION}_linux_amd64.rpm
sudo service process-exporter start
sleep 10
pmm-admin add external --group=processes --listen-port=9256 --service-name=external_nodeprocess