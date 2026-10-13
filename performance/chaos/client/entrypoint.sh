#!/bin/sh
# pmm-client container entrypoint for perf runs. Registers the node once, then keeps that identity
# across container restarts and image upgrades (the config sits on a named volume), so a soak VM
# reboot or a nightly client upgrade does not churn nodes on the server.
# Env: NODE_NAME, DB (mysql|postgresql|mongodb), DB_PASSWORD and the PMM_AGENT_* server settings.
cfg=/usr/local/percona/pmm/config/pmm-agent.yaml
export PMM_AGENT_CONFIG_FILE=$cfg
done_flag=/usr/local/percona/pmm/config/.service-added

if ! grep -qE '^id: *[^ ]+' "$cfg" 2>/dev/null; then
  pmm-agent setup --force "$(hostname -i | awk '{print $1}')" generic "$NODE_NAME" || exit 1
fi
pmm-agent run &
agent=$!
trap 'kill -TERM $agent' TERM INT

if [ ! -f "$done_flag" ]; then
  for _ in $(seq 60); do pmm-admin status >/dev/null 2>&1 && break; sleep 5; done
  for _ in $(seq 10); do
    case $DB in
      mysql) pmm-admin add mysql --service-name="$NODE_NAME-mysql" --host=mysql --port=3306 \
               --username=pmm --password="$DB_PASSWORD" --query-source=perfschema ;;
      postgresql) pmm-admin add postgresql --service-name="$NODE_NAME-pg" --host=postgres --port=5432 \
               --username=pmm --password="$DB_PASSWORD" --database=postgres --query-source=pgstatements ;;
      mongodb) pmm-admin add mongodb --service-name="$NODE_NAME-mongo" --host=mongo --port=27017 \
               --query-source=profiler ;;
    esac && touch "$done_flag" && break
    sleep 15
  done
fi
wait $agent
