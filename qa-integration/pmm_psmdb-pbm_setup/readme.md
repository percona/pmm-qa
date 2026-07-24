# PMM + PBM + PSMDB Integration Tests Setup and Details #


## Setup ##
Here are two scripts to setup and run basic backup/restore tests - start-rs.sh and start-sharded.sh 
The scripts are using ENV's to define needed versions for each product:
1) PSMDB_VERSION (e.g 6.0.3-2 ) - if not defined the latest 6.0 will be used 
2) PBM_VERSION (e.g. 2.0.3-1 ) - if not defined the latest will be used
3) PMM_REPO (e.g. release/testing/experimental) - the repo for pmm2-client, default to release
4) PMM_CLIENT_VERSION (e.g. 2.21.0 ) - pmm2-client version or alternatively full url for tarball e.g. https://downloads.percona.com/downloads/TESTING/pmm/pmm2-client-2.35.0.tar.gz, if not defined the latest package will be used
5) PMM_IMAGE ( e.g. perconalab/pmm-server:dev-latest ) - pmm-server docker image, default to perconalab/pmm-server:dev-latest
6) PBM_USER - mongo-user for PBM, default - pbm
7) PBM_PASS - password for PBM mongo-user, default - pbmpass
8) PMM_USER - mongo-user for PMM, default - pmm
9) PMM_PASS - password for PMM mongo-user, default - pmmpass

Also there are two more ENV's that allow to skip the tests and (or) to skip cleanup after the run:
1) TESTS - if set to "no" - the script will skip the tests step
2) CLEANUP - if set to "no" the script will skip the cleanup step


 - start-rs.sh - builds systemd-based docker-image, installs necessary versions of PBM/PSMDB/PMM2-Agent inside, starts them, prepares 3-nodes replicaset, 
starts necessary PMM server, starts minio container for s3-like storage, configure minio, adds some base data with mgodatagen, runs tests and than cleanup
 - start-sharded.sh - does the same, but prepares 9-nodes sharded cluster ( configsvr rs and two shards rs)

## Credentials ##
1) PMM server can be accessed at https://127.0.0.1/ , login - admin , password - password
2) MINIO can be accessed at internal docker ip, port 9000 e.g. http://172.26.0.4:9000, to check the ip -

   docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' minio  

   login - minio1234 , password - minio1234
3) PSMDB - root credentials: login root , password - root

