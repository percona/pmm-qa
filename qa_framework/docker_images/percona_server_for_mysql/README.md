# Percona Server for MySQL — QA Docker image

A systemd-based Percona Server image that reproduces the containers built by
`qa-integration/pmm_qa/percona_server_for_mysql`, **without the PMM client**.
One image serves all three topologies; the role is chosen at runtime via env vars.

## Build

```bash
cd qa_framework/docker_images/percona_server_for_mysql

# 8.0 (default)
docker build -t ps-qa:8.0 .

# 8.4
docker build -t ps-qa:8.4 --build-arg PS_REPO=ps-84-lts .

# 5.7
docker build -t ps-qa:5.7 \
  --build-arg BASE_IMAGE=antmelekhin/docker-systemd:ubuntu-22.04 \
  --build-arg PS_REPO=ps-57 \
  --build-arg PS_PKG_SUFFIX=-5.7 .
```

## Run (systemd image needs these flags)

Common flags: `--privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw`
on a shared network so nodes resolve each other by name.

```bash
docker network create pmm-qa || true
```

### Single instance

```bash
docker run -d --name ps1 --network pmm-qa \
  --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  -e SETUP_TYPE=single -p 3306:3306 ps-qa:8.0
```

### Async replication (2 nodes)

Container **name must equal `${CONTAINER_PREFIX}${NODE_INDEX}`** so DNS resolves.

```bash
PREFIX=ps_repl_
# primary
docker run -d --name ${PREFIX}1 --network pmm-qa \
  --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  -e SETUP_TYPE=replication -e CONTAINER_PREFIX=$PREFIX \
  -e NODE_INDEX=1 -e NODES_COUNT=2 -p 3306:3306 ps-qa:8.0
# replica
docker run -d --name ${PREFIX}2 --network pmm-qa \
  --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
  -e SETUP_TYPE=replication -e CONTAINER_PREFIX=$PREFIX \
  -e NODE_INDEX=2 -e NODES_COUNT=2 -p 3307:3306 ps-qa:8.0
```

### Group replication (3 nodes)

```bash
PREFIX=ps_gr_
for i in 1 2 3; do
  docker run -d --name ${PREFIX}${i} --network pmm-qa \
    --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
    -e SETUP_TYPE=gr -e CONTAINER_PREFIX=$PREFIX \
    -e NODE_INDEX=${i} -e NODES_COUNT=3 -p $((3305+i)):3306 ps-qa:8.0
done
```

Start the primary (NODE_INDEX=1) first; replicas wait for it to bootstrap.

## Environment variables

| Var                | Default                                   | Meaning                                  |
|--------------------|-------------------------------------------|------------------------------------------|
| `SETUP_TYPE`       | `single`                                  | `single` \| `replication` \| `gr`        |
| `NODE_INDEX`       | `1`                                       | 1-based node index (1 = primary)         |
| `NODES_COUNT`      | `1`                                       | total nodes                              |
| `SERVER_ID`        | `NODE_INDEX`                              | mysql `server_id`                        |
| `CONTAINER_PREFIX` | `ps_node_`                                | node host = `PREFIX`+`INDEX`             |
| `PRIMARY_HOST`     | `${CONTAINER_PREFIX}1`                    | source/primary host                      |
| `REPL_USER`        | `repl_user`                               | replication user                         |
| `REPL_PASSWORD`    | `GRgrO9301RuF`                            | replication password                     |
| `ROOT_PASSWORD`    | `GRgrO9301RuF`                            | mysql root password                      |
| `MYSQL_PORT`       | `3306`                                    | mysql port                               |
| `GROUP_SEEDS_PORT` | `34061`                                   | GR (XCOM) port                           |
| `GROUP_NAME`       | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`    | GR group UUID                            |

## Verify

```bash
docker exec -it ps_gr_1 mysql -uroot -pGRgrO9301RuF \
  -e "SELECT * FROM performance_schema.replication_group_members;"

docker exec -it ps_repl_2 mysql -uroot -pGRgrO9301RuF -e "SHOW REPLICA STATUS\G"
```

Setup log inside each container: `/var/log/ps-node-setup.log`.
