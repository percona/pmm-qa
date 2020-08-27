# PMM Framework
[pmm-framework.sh](https://github.com/percona/pmm-qa/blob/master/pmm-tests/pmm-framework.sh) enables one to: 
  - Quickly setup a **Percona Monitoring and Management** environment. 
  - One can setup a PMM server and quickly add multiple clients.
  - Add DB instances of...
    - Percona Server (ps)
    - MongoDB (mo)   - Percona Server for MongoDB
    - MongoDB (modb) - Official MongoDB
    - MySQL (ms)
    - MariaDB (md)
    - Percona XtraDB Cluster (pxc)
    - PostgreSQL (pgsql)

This script supports installations of:
Instance|Platform|Repositories
---|---|---
pmm-server|docker|dev, dev-fb, release
pmm-client|tarball|dev

## Using pmm-framework.sh:
*****
- Append the given flags while executing PMM-Framework.sh  
  

### To install PMM:
1. Install PMM-Server and PMM-Client both; connect them
  - `./pmm-framework.sh --setup --pmm2 --pmm-server-version 2.7.0`
  - Omit `--pmm2` flag if you want to setup PMM1.x environment
  - Use `--link-client LINK` flag to provide specific tarball installation URL for pmm-client

2. Install PMM-Server only:
  - `./pmm-framework.sh --pmm2 --setup-server`

3. Install PMM-Client only:
  - `./pmm-framework.sh --pmm2 --setup-client --pmm2-server-ip 192.168.0.xyz`
  - To pass PMM-Server username/password *(if not the default admin & admin)*
    - `--pmm-server-username USERNAME`
    - `--pmm-server-password PASS`  
  
4. development-build/feature-build
  - `--dev` : To install PMM from development build
  - `--def-fb TAG` :  To install specified PMM feature build (TAG is the Docker image tag of perconalab/pmm-server-fb image on DockerHub.)
  
### Add Database Instance to client:
5. `./pmm-framework.sh --pmm2 --download --addclient=ps,1`
  - Here `--addclient=ps,1` means add `1` instance of `Percona Server` 
  - Change `ps` to the Database acronym you require - check above for valid DB acronyms
  - Change `1` to number of instances you require
  - **Multiple** DBs and instances at once is **Possible** :
    - For example, `./pmm-framework.sh --pmm2 --download --addclient=ps,2 --addclient=ms,3` adds 2 PS instances and 3 MySQL instances  
  
  - *Note:* `--download` option is necessary to download DB installers

6. To provide specific versions of DB: *(Change VERSION with your version string)*
  - `--ps-version VERSION`
  - `--modb-version VERSION`
  - `--ms-version VERSION`
  - `--pgsql-version VERSION`
  - `--md-version VERSION`
  - `--mo-version VERSION`
  - `--pxc-version VERSION`   

7. To only install the DBs and not connect them to PMM-Client yet, use `setup-db.sh`
  - `setup-db.sh` will install the requested DBs and export DB configuration parameters like Username, Password, Port, Socket etc. to another file (*db_config.txt*), so that DB can be later connected to PMM-Client as needed.  
  
### Load Test:
8. Run Load Tests on Percona Server Instances with PMM2
  - `--run-load-pmm2`  

9. Sysbench load test on MySQL instances:
  - `--sysbench-data-load` - This will initiate sysbench data load on mysql instances
  - `--sysbench-oltp-run` - This will initiate sysbench oltp run on mysql instances
  - `--storage-engine` - Create sysbench tables with specific storage engine  

10. Sysbench load test on MongoDB:
  - `--mongo-sysbench` - Initiates sysbench oltp prepare and run for MongoDB instance  
  
  
### Wipe Configuration:
11. `--wipe` - To wipe all the configuration
  - `--wipe-server` - Stop **pmm-server** container and remove all pmm containers
  - `--wipe-clients` - Stop all client instances and remove all clients from pmm-admin
  - `--wipe-pmm2-clients` - Stop all pmm-server from monitoring client instances (uses pmm-admin remove)
- `--wipe-docker-clients` - Stop all docker client instances and remove all clients from docker container

### Miscellaneous: 
12. `--use-socket` - Use DB Socket for PMM Client Connection

13. `--help` - to see all available options and their guide