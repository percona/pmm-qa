#!/bin/bash

# PMM Framework
# This script enables one to quickly setup a Percona Monitoring and Management environment. One can setup a PMM server and quickly add multiple clients
# The intention of this script is to be robust from a quality assurance POV; it should handle many different server configurations accurately

# Internal variables
DIRNAME=$(dirname "$0")
WORKDIR=${PWD}
SCRIPT_PWD=$(cd `dirname $0` && pwd)
RPORT=$(( RANDOM%21 + 10 ))
RBASE="$(( RPORT*1000 ))"
SERVER_START_TIMEOUT=100
SUSER="root"
SPASS=""
OUSER="admin"
OPASS="passw0rd"
ADDR="127.0.0.1"
download_link=0
disable_ssl=0
create_pgsql_user=0
PGSQL_PORT=5432
PDPGSQL_PORT=6432
PS_PORT=43306
mysqld_startup_options="--user=root"

mkdir -p $WORKDIR/logs
# User configurable variables
IS_BATS_RUN=0

# Dispay script usage details
usage () {
  echo "Usage: [ options ]"
  echo "Options:"
  echo " --setup                        This will setup and configure a PMM server"
  echo " --dev                          When this option is specified, PMM framework will use the latest PMM development version. Otherwise, the latest 1.x version is used"
  echo " --dev-fb                       This will install specified feature build (must be used with --setup and --dev options)"
  echo " --pmm2                         When this option is specified, PMM framework will use specified PMM 2.x development version. Must be used with pmm-server-version option"
  echo " --skip-docker-setup            Pass this parameter if Docker Setup for PMM2-Server is not needed, Only Pmm2-client needs to be installed"
  echo " --is-bats-run                  Change Bats run option, set to 1 if not user interaction required"
  echo " --link-client                  Pass URL to download pmm-client"
  echo " --addclient=ps,2               Add Percona (ps), MySQL (ms), MariaDB (md), Percona XtraDB Cluster (pxc), and/or mongodb (mo) pmm-clients to the currently live PMM server (as setup by --setup)"
  echo "                                You can add multiple client instances simultaneously. eg : --addclient=ps,2  --addclient=ms,2 --addclient=md,2 --addclient=mo,2 --addclient=pxc,3"
  echo " --download                     This will help us to download pmm client binary tar balls"
  echo " --dbdeployer                   This option will use dbdeployer tool for deploying PS, MS Databases"
  echo " --pmm-server-version           Pass PMM version"
  echo " --pmm-port                     Pass port for PMM docker"
  echo " --pmm2-server-ip               Pass Address for PMM2-Server"
  echo " --package-name                 Name of the Server package installed"
  echo " --ps-version                   Pass Percona Server version info"
  echo " --modb-version                 Pass MongoDB version info, from MongoDB!!"
  echo " --ms-version                   Pass MySQL Server version info"
  echo " --pgsql-version                Pass Postgre SQL server version Info"
  echo " --md-version                   Pass MariaDB Server version info"
  echo " --pxc-version                  Pass Percona XtraDB Cluster version info"
  echo " --pdpgsql-version              Pass Percona Distribution for PostgreSQL version Info"
  echo " --mysqld-startup-options       Pass MySQL startup options. eg : --mysqld-startup-options='--innodb_buffer_pool_size=1G --innodb_log_file_size=1G'"
  echo " --with-proxysql                This allow to install PXC with proxysql"
  echo " --sysbench-data-load           This will initiate sysbench data load on mysql instances"
  echo " --sysbench-oltp-run            This will initiate sysbench oltp run on mysql instances"
  echo " --storage-engine               This will create sysbench tables with specific storage engine"
  echo " --mongo-storage-engine         Pass storage engine for MongoDB"
  echo " --mo-version                   Pass MongoDB Server version info"
  echo " --replcount                    You can configure multiple mongodb replica sets with this oprion"
  echo " --with-replica                 This will configure mongodb replica setup"
  echo " --with-sharding                This will configure mongodb sharding setup"
  echo " --mongo-sysbench               This option initiates sysbench oltp prepare and run for MongoDB instance"
  echo " --add-docker-client            Add docker pmm-clients with percona server to the currently live PMM server"
  echo " --list                         List all client information as obtained from pmm-admin"
  echo " --wipe-clients                 This will stop all client instances and remove all clients from pmm-admin"
  echo " --wipe-pmm2-clients            This will stop all pmm-server from monitoring client instances"
  echo " --wipe-docker-clients          This will stop all docker client instances and remove all clients from docker container"
  echo " --wipe-server                  This will stop pmm-server container and remove all pmm containers"
  echo " --wipe                         This will wipe all pmm configuration"
  echo " --pmm-server-username          User name to access the PMM Server web interface"
  echo " --pmm-server-password          Password to access the PMM Server web interface"
  echo " --pmm-server-memory            Set METRICS_MEMORY option to PMM server"
  echo " --pmm-docker-memory            Set memory for docker container"
  echo " --pmm-server=[docker|ami|ova]  Choose PMM server appliance, default pmm server appliance is docker"
  echo " --ami-image                    Pass PMM server ami image name"
  echo " --key-name                     Pass your aws access key file name"
  echo " --ova-image                    Pass PMM server ova image name"
  echo " --ova-memory                   Pass memory(memorysize in MB) for OVA virtual box"
  echo " --disable-ssl                  Disable ssl mode on exporter"
  echo " --create-pgsql-user            Set this option if a Dedicated PGSQl User creation is required username: psql and no password"
  echo " --upgrade-server               When this option is specified, PMM Server will be updated to the last version"
  echo " --upgrade-client               When this option is specified, PMM client will be updated to the last version"
  echo " --query-source                 Set query source (perfschema or slowlog)"
  echo " --setup-alertmanager           Start alert-manager on aws instance which runs on port 9093"
  echo " --compare-query-count          This will help us to compare the query count between PMM client instance and PMM QAN/Metrics page"
  echo " --disable-tablestats           Disable table statistics collection (only works with PS Node)"
  echo " --run-load-pmm2                Run Load Tests on Percona Server Instances with PMM2"
  echo " --add-annotation               Pass this to add Annotation to All reports and dashboard"
  echo " --use-socket                   Use DB Socket for PMM Client Connection"
  echo " --mongomagic                   Use this option for experimental MongoDB setup with PMM2"
  echo " --setup-pmm-client-docker      Use this option to setup PMM-Client docker, Percona Server and PMM-Server Docker images for testing client"
  echo " --group-replication            Use this option to setup MS/PS with Group Replication, --single-primary & topology group"
  echo " --setup-replication-ps-pmm2    Use this option to setup PS replication, this is only needed for UI tests extra check setup"
  echo " --group                        Use this option to setup group replication for PS. Must be used with --setup-replication-ps-pmm2"
  echo " --disable-queryexample         Use this option to setup PS instance with disabled query example"
  echo " --metrics-mode                 Use this option to set Metrics mode for DB exporters"
  echo " --setup-external-service       Use this option to setup Redis as External Service"
  echo " --setup-with-custom-settings   Use this option to setup Custom Queries on Client and Custom Prometheues Base Config File"
  echo " --install-backup-toolkit       Use this option to setup Percona-xtrabackup along with Mysql, Percona-Server Setup"
  echo " --setup-with-custom-queries    Use this option to setup custom queries on the client pmm-agent"
  echo " --setup-custom-ami             Use this option to setup AMI instance PMM with custom configuration"
  echo " --setup-mysql-ssl              Use this option to setup mysql 8.x server with SSL option"
  echo " --setup-mongodb-ssl            Use this option to setup official mongodb 4.4 server with ssl"
  echo " --setup-postgres-ssl           Use this option to setup official Postgresql 13 with SSL"
  echo " --setup-remote-db              Use this option when running AMI/OVF instances and setting up remote db's on client node"
  echo " --mongo-replica-for-backup     Use this option to setup MongoDB Replica Set and PBM for each replica member on client node"
  echo " --setup-bm-mysql               Use this option to setup Percona Server along with Percona Xtra Backup and Qpress for BM setup"
  echo " --setup-ssl-services           Use this option to setup mysql, postgresql, mongodb ssl services all together"
  echo " --setup-pmm-pgsm-integration   Use this option to setup PMM-Client with PGSM for integration testing"
  echo " --setup-pmm-pgss-integration   Use this option to setup PMM-Client with PG Stat Statements for Integration Testing"
  echo " --cleanup-service              Use this option to delete DB container and remove from monitoring, just pass service name"
  echo " --deploy-service-with-name     Use this to deploy a service with user specified service name expected values to be used with --addclient=ps,1 example: --deploy-service-with-name=psserviceName"
  echo " --setup-pgsql-vacuum           Use this do setup postgres for vacuum monitoring tests "
  echo " --setup-pmm-ps-integration     Use this do setup for percona-server and PMM using dbdeployer "
  echo " --setup-checks-basic           Use this to generate some basic checks failure for ps/pgsql/mongodb"
}

# Check if we have a functional getopt(1)
if ! getopt --test
  then
  go_out="$(getopt --options=u: --longoptions=addclient:,replcount:,pmm-server:,ami-image:,key-name:,pmm2-server-ip:,ova-image:,ova-memory:,deploy-service-with-name:,cleanup-service:,pmm-server-version:,dev-fb:,mongo-replica-for-backup:,setup-bm-mysql:,link-client:,pmm-port:,metrics-mode:,package-name:,setup-pmm-pgsm-integration,setup-pmm-pgss-integration,pmm-server-memory:,pmm-docker-memory:,pmm-server-username:,pmm-server-password:,query-source:,setup,pmm2,mongomagic,setup-external-service,group-replication,group,install-backup-toolkit,setup-replication-ps-pmm2,setup-pmm-client-docker,setup-custom-ami,setup-remote-db,setup-postgres-ssl,setup-mongodb-ssl,setup-mysql-ssl,setup-with-custom-settings,setup-with-custom-queries,disable-tablestats,dbdeployer,install-client,skip-docker-setup,with-replica,with-arbiter,with-sharding,download,ps-version:,modb-version:,ms-version:,pgsql-version:,md-version:,pxc-version:,haproxy-version:,pdpgsql-version:,mysqld-startup-options:,mo-version:,add-docker-client,list,wipe-clients,wipe-pmm2-clients,add-annotation,use-socket,run-load-pmm2,disable-queryexample,delete-package,wipe-docker-clients,wipe-server,is-bats-run,disable-ssl,setup-ssl-services,create-pgsql-user,upgrade-server,upgrade-client,setup-pgsql-vacuum,setup-pmm-ps-integration,setup-checks-basic,wipe,setup-alertmanager,dev,with-proxysql,sysbench-data-load,sysbench-oltp-run,mongo-sysbench,storage-engine:,mongo-storage-engine:,compare-query-count,pgsql-pgss-port:,help \
  --name="$(basename "$0")" -- "$@")"
  test $? -eq 0 || exit 1
  eval set -- $go_out
fi

if [[ $go_out == " --" ]];then
  usage
  exit 1
fi

for arg
do
  case "$arg" in
    -- ) shift; break;;
    --addclient )
    ADDCLIENT+=("$2")
    shift 2
    ;;
    --setup-pgsql-vacuum )
    setup_pgsql_vacuum=1
    shift
    ;;
    --setup-pmm-ps-integration )
    setup_pmm_ps_integration=1
    shift
    ;;
    --setup-checks-basic )
    setup_checks_basic=1
    shift
    ;;
    --with-replica )
    shift
    with_replica=1
    ;;
    --with-arbiter )
    shift
    with_arbiter=1
    ;;
    --replcount )
    REPLCOUNT=$2
    shift 2
    ;;
    --with-sharding )
    shift
    with_sharding=1
    ;;
    --download )
    shift
    download_link=1
    ;;
    --link-client )
    link_client="$2"
    shift 2
    ;;
    --pmm-server )
    pmm_server="$2"
	shift 2
    if [ "$pmm_server" != "docker" ] && [ "$pmm_server" != "ami" ] && [ "$pmm_server" != "ova" ] && [ "$pmm_server" != "custom" ]; then
      echo "ERROR: Invalid --pmm-server passed:"
      echo "  Please choose any of these pmm-server options: 'docker', 'ami', 'custom', or 'ova'"
      exit 1
    fi
    ;;
    --pmm-server-version )
    pmm_server_version="$2"
    PMM_VERSION=$pmm_server_version
    shift 2
    ;;
    --dev-fb )
    DEV_FB="$2"
    shift 2
    ;;
    --pmm-server-memory )
    MEMORY="$2"
    shift 2
    ;;
    --pmm-port )
    PMM_PORT="$2"
    shift 2
    ;;
    --pmm2-server-ip )
    IP_ADDRESS="$2"
    PMM2_SERVER_IP="$2"
    shift 2
    ;;
    --package-name )
    package_name="$2"
    shift 2
    ;;
    --pmm-docker-memory )
    DOCKER_MEMORY="$2"
    shift 2
    ;;
    --cleanup-service )
    cleanup_services=1
    cleanup_service_name="$2"
    shift 2
    ;;
    --deploy-service-with-name )
    service_custom_name=1
    service_name="$2"
    shift 2
    ;;
    --ami-image )
    ami_image="$2"
    shift 2
    ;;
    --setup-ssl-services )
    setup_ssl_services=1
    shift
    ;;
    --key-name )
    key_name="$2"
    shift 2
    ;;
    --is-bats-run )
    IS_BATS_RUN=1
    shift 2
    ;;
    --ova-image )
    ova_image="$2"
    shift 2
    ;;
    --ova-memory )
    ova_memory="$2"
    shift 2
    ;;
    --ps-version )
    ps_version="$2"
    shift 2
    ;;
    --modb-version )
    modb_version="$2"
    shift 2
    ;;
    --ms-version )
    ms_version="$2"
    shift 2
    ;;
    --pgsql-version )
    pgsql_version="$2"
    shift 2
    ;;
    --md-version )
    md_version="$2"
    shift 2
    ;;
    --pxc-version )
    pxc_version="$2"
    shift 2
    ;;
    --haproxy-version )
    haproxy_version="$2"
    shift 2
    ;;
    --pdpgsql-version )
    pdpgsql_version="$2"
    shift 2
    ;;
    --mysqld-startup-options )
    mysqld_startup_options="$2"
    shift 2
    ;;
    --query-source )
    query_source="$2"
    shift 2
    ;;
    --mo-version )
    mo_version="$2"
    shift 2
    ;;
    --mongo-storage-engine )
    mongo_storage_engine="--storageEngine  $2"
    shift 2
    ;;
    --add-docker-client )
    shift
    add_docker_client=1
    ;;
    --setup )
    shift
    setup=1
    ;;
    --pmm2 )
    shift
    PMM2=1
    ;;
    --mongomagic )
    shift
    MONGOMAGIC=1
    ;;
    --setup-pmm-pgsm-integration )
    shift
    setup_pmm_pgsm_integration=1
    ;;
    --setup-pmm-pgss-integration )
    shift
    setup_pmm_pgss_integration=1
    ;;
    --setup-pmm-client-docker )
    shift
    setup_pmm_client_docker=1
    ;;
    --group-replication )
    shift
    setup_group_replication=1
    ;;
    --setup-replication-ps-pmm2 )
    shift
    setup_replication_ps_pmm2=1
    ;;
    --group )
    shift
    group=1
    ;;
    --disable-tablestats )
    shift
    DISABLE_TABLESTATS=1
    ;;
    --disable-queryexample )
    shift
    DISABLE_QUERYEXAMPLE=1
    ;;
    --metrics-mode )
    metrics_mode="$2"
    shift 2
    ;;
    --dbdeployer )
    shift
    use_dbdeployer=1
    ;;
    --install-backup-toolkit )
    shift
    install_backup_toolkit=1
    ;;
    --setup-bm-mysql )
    shift
    setup_bm_mysql=1
    ;;
    --setup-external-service )
    shift
    setup_external_service=1
    ;;
    --skip-docker-setup )
    shift
    skip_docker_setup=1
    ;;
    --list )
    shift
    list=1
    ;;
    --wipe-clients )
    shift
    wipe_clients=1
    ;;
    --wipe-pmm2-clients )
    shift
    wipe_pmm2_clients=1
    ;;
    --run-load-pmm2 )
    shift
    run_load_pmm2=1
    ;;
    --add-annotation )
    shift
    add_annotation=1
    ;;
    --use-socket )
    shift
    use_socket=1
    ;;
    --setup-alertmanager )
    shift
    setup_alertmanager=1
    ;;
    --setup-with-custom-settings )
    shift
    setup_with_custom_settings=1
    ;;
    --setup-custom-ami )
    shift
    setup_custom_ami=1
    ;;
    --setup-with-custom-queries )
    shift
    setup_with_custom_queries=1
    ;;
    --delete-package )
    shift
    delete_package=1
    ;;
    --disable-ssl )
    shift
    disable_ssl=1
    ;;
    --create-pgsql-user )
    shift
    create_pgsql_user=1
    ;;
    --wipe-docker-clients )
    shift
    wipe_docker_clients=1
    ;;
    --wipe-server )
    shift
    wipe_server=1
    ;;
    --wipe )
    shift
    wipe=1
    ;;
    --dev )
    shift
    dev=1
    ;;
    --with-proxysql )
    shift
    with_proxysql=1
    ;;
    --sysbench-data-load )
    shift
    sysbench_data_load=1
    ;;
    --sysbench-oltp-run )
    shift
    sysbench_oltp_run=1
    ;;
    --storage-engine )
    storage_engine="$2"
    shift 2
    ;;
    --mongo-sysbench )
    shift
    mongo_sysbench=1
    ;;
    --setup-mysql-ssl )
    shift
    mysql_ssl_setup=1
    ;;
    --setup-mongodb-ssl )
    shift
    mongodb_ssl_setup=1
    ;;
    --setup-postgres-ssl )
    shift
    postgres_ssl_setup=1
    ;;
    --setup-remote-db )
    shift
    setup_remote_db=1
    ;;
    --mongo-replica-for-backup )
    shift
    mongo_replica_for_backup=1
    ;;
    --compare-query-count )
    shift
    compare_query_count=1
    ;;
    --upgrade-server )
    upgrade_server=1
    shift
    ;;
    --upgrade-client )
    upgrade_client=1
    shift
    ;;
    --pgsql-pgss-port )
    pgsql_pgss_port="$2"
    shift 2
     ;;
    --pmm-server-username )
    pmm_server_username="$2"
    shift 2
    ;;
    --pmm-server-password )
    case "$2" in
      "")
      read -r -s -p  "Enter PMM Server web interface password:" INPUT_PASS
      if [ -z "$INPUT_PASS" ]; then
        pmm_server_password=""
        printf "\nConfiguring without PMM Server web interface password...\n";
      else
        pmm_server_password="$INPUT_PASS"
      fi
      printf "\n"
      ;;
      *)
      pmm_server_password="$2"
      ;;
    esac
    shift 2
    ;;
    --help )
    usage
    exit 0
    ;;
  esac
done

check_script(){
  MPID=$1
  ERROR_MSG=$2
  if [ ${MPID} -ne 0 ]; then echo "Assert! ${MPID}. Terminating!"; exit 1; fi
}

mongo_sysbench(){
  SYSBENCH=$(which sysbench)
  if [[ -z "SYSBENCH" ]];then
    echo "ERROR! 'sysbench' is not installed. Please install sysbench. Terminating."
    exit 1
  fi
  wget https://raw.githubusercontent.com/Percona-Lab/sysbench-mongodb-lua/master/oltp-mongo.lua
  PORT=$(sudo pmm-admin list  | awk -F '[: ]+' '/mongodb:metrics/{print $7}'| head -n1)
  echo "PORT "$PORT
  sysbench oltp-mongo.lua --tables=10 --threads=10 --table-size=1000000 --mongodb-db=sbtest --mongodb-host=localhost --mongodb-port=${PORT}  --rand-type=pareto prepare > $WORKDIR/logs/mongo_sysbench_prepare.txt 2>&1 &
  sysbench oltp-mongo.lua --tables=10 --threads=10 --table-size=1000000 --mongodb-db=sbtest --mongodb-host=localhost --mongodb-port=${PORT} --time=1200 --report-interval=1 --rand-type=pareto run > $WORKDIR/logs/mongo_sysbench_run.txt 2>&1 &
  check_script $? "Failed to run sysbench for MongoDB dataload"

}
# Add check for --pmm-server-memory
if [[ -z "$MEMORY" ]]; then
  PMM_METRICS_MEMORY=""
else
  PMM_METRICS_MEMORY="-e METRICS_MEMORY=$MEMORY"
fi

# Add check for --pmm-docker-memory
if [[ -z "$DOCKER_MEMORY" ]]; then
  DOCKER_CONTAINER_MEMORY=""
else
  DOCKER_CONTAINER_MEMORY="--memory=$DOCKER_MEMORY"
fi

if [[ -z "$storage_engine" ]];then
  storage_engine=INNODB
fi

if [[ -z "$disable_ssl" ]];then
  disable_ssl=0
fi

if [[ -z "$create_pgsql_user" ]]; then
  create_pgsql_user=0
fi

if [[ "$with_sharding" == "1" ]];then
  with_replica=1
fi
if [[ -z "$pmm_server_username" ]];then
  if [[ ! -z "$pmm_server_password" ]];then
    echo "ERROR! PMM Server web interface username is empty. Terminating"
    exit 1
  fi
fi

if [[ -z "$pmm_server" ]];then
  pmm_server="docker"
elif [[ "$pmm_server" == "ami" ]];then
  if [[ "$setup" == "1" ]];then
    if [[ -z "$ami_image" ]];then
      echo "ERROR! You have not given AMI image name. Please use --ami-image to pass image name. Terminating"
      exit 1
    fi
    if [[ -z "$key_name" ]];then
      echo "ERROR! You have not entered  aws key name. Please use --key-name to pass key name. Terminating"
      exit 1
    fi
  fi
elif [[ "$pmm_server" == "ova" ]];then
  if [[ "$setup" == "1" ]];then
    if [[ -z "$ova_image" ]];then
      echo "ERROR! You have not given OVA image name. Please use --ova-image to pass image name. Terminating"
      exit 1
    fi
  fi
elif [[ "$pmm_server" == "custom" ]];then
  if ! sudo pmm-admin ping | grep -q "OK, PMM server is alive"; then
    echo "ERROR! PMM Server is not running. Please check PMM server status. Terminating"
    exit 1
  fi
fi

sanity_check(){
  if [[ "$pmm_server" == "docker" ]];then
    if ! sudo docker ps | grep 'pmm-server' > /dev/null ; then
      echo "ERROR! pmm-server docker container is not runnning. Terminating"
      #exit 1
    fi
  elif [[ "$pmm_server" == "ami" ]];then
    if [ -f $WORKDIR/aws_instance_config.txt ]; then
      INSTANCE_ID=$(cat $WORKDIR/aws_instance_config.txt | grep "InstanceId"  | awk -F[\"\"] '{print $4}')
	else
	  echo "ERROR! Could not read aws instance id. $WORKDIR/aws_instance_config.txt does not exist. Terminating"
	  exit 1
	fi
    INSTANCE_ACTIVE=$(aws ec2 describe-instance-status --instance-ids  $INSTANCE_ID | grep "Code" | sed 's/[^0-9]//g')
	if [[ "$INSTANCE_ACTIVE" != "16" ]];then
      echo "ERROR! pmm-server ami instance is not runnning. Terminating"
      exit 1
	fi
  elif [[ "$pmm_server" == "ova" ]];then
    VMBOX=$(vboxmanage list runningvms | grep "PMM-Server" | awk -F[\"\"] '{print $2}')
	VMBOX_STATUS=$(vboxmanage showvminfo $VMBOX  | grep State | awk '{print $2}')
	if [[ "$VMBOX_STATUS" != "running" ]]; then
	  echo "ERROR! pmm-server ova instance is not runnning. Terminating"
      exit 1
	fi
  fi
}

sudo_check(){

  USER=$1
    # Sudo check
    echo "Checking for user $1"
  if [ "$(sudo -H -u ${USER} bash -c "echo 'test'" 2>/dev/null)" != "test" ]; then
    echo "Error: sudo is not available or requires a password. This script needs to be able to use sudo, without password, from the userID that invokes it ($(whoami))"
    echo "To get your setup correct, you may like to use a tool like visudo (use 'sudo visudo' or 'su' and then 'visudo') and consider adding the following line to the file:"
    echo "$(whoami)   ALL=(ALL)      NOPASSWD:ALL"
    echo "If you do not have sudo installed yet, try 'su' and then 'yum install sudo' or the apt-get equivalent"
    echo "Terminating now."
    exit 1
  fi
}

if [[ -z "${ps_version}" ]]; then ps_version="8.0"; fi
if [[ -z "${modb_version}" ]]; then modb_version="4.4"; fi
if [[ -z "${pxc_version}" ]]; then pxc_version="5.7"; fi
if [[ -z "${ms_version}" ]]; then ms_version="8.0"; fi
if [[ -z "${md_version}" ]]; then md_version="10.5"; fi
if [[ -z "${mo_version}" ]]; then mo_version="4.4"; fi
if [[ -z "${REPLCOUNT}" ]]; then REPLCOUNT="1"; fi
if [[ -z "${ova_memory}" ]]; then ova_memory="2048";fi
if [[ -z "${pgsql_version}" ]]; then pgsql_version="14";fi
if [[ -z "${pdpgsql_version}" ]]; then pdpgsql_version="14"; fi

if [[ -z "$query_source" ]];then
  query_source=perfschema
fi

setup(){
  if [ $IS_BATS_RUN -eq 0 ];then
    read -p "Would you like to enable SSL encryption to protect PMM from unauthorized access[y/n] ? " check_param
    case $check_param in
      y|Y)
        echo -e "\nGenerating SSL certificate files to protect PMM from unauthorized access"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -subj '/CN=www.percona.com/O=Database Performance./C=US'
        IS_SSL="Yes"
        if [[ -z $PMM_PORT ]]; then
          PMM_PORT=443
        fi
      ;;
      n|N)
        echo ""
        IS_SSL="No"
        if [[ -z $PMM_PORT ]]; then
          PMM_PORT=80
        fi
      ;;
      *)
        echo "Please type [y/n]! Terminating."
        exit 1
      ;;
    esac
  else
    IS_SSL="No"
  fi


  if [[ ! -e $(which lynx 2> /dev/null) ]] ;then
    echo "ERROR! The program 'lynx' is currently not installed. Please install lynx. Terminating"
    exit 1
  fi
  #IP_ADDRESS=$(ip route get 8.8.8.8 | head -1 | cut -d' ' -f8)
  if [ -z $IP_ADDRESS ]; then
    IP_ADDRESS=$(ip route get 8.8.8.8 | awk -F"src " 'NR==1{split($2,a," ");print a[1]}')
  fi
  if [[ "$pmm_server" == "docker" ]];then
    #PMM configuration setup
    if [ -z $pmm_server_version ]; then
      if [ -z $dev ]; then
        echo "dev is == " $dev
        PMM_VERSION=$(lynx --dump https://hub.docker.com/r/percona/pmm-server/tags/ | grep '[0-9].[0-9].[0-9]' | sed 's|   ||' | head -n1)
        echo "PMM VERSION IS $PMM_VERSION"
      else
        PMM_VERSION=$(lynx --dump https://hub.docker.com/r/perconalab/pmm-server/tags/ | grep '[0-9].[0-9].[0-9]' | sed 's|   ||' | head -n1)
        echo "PMM VERSION IS $PMM_VERSION"
      fi
    #PMM sanity check
      if ! pgrep docker > /dev/null ; then
        echo "ERROR! docker service is not running. Terminating"
        exit 1
      fi
      if sudo docker ps | grep 'pmm-server' > /dev/null ; then
        echo "ERROR! pmm-server docker container is already runnning. Terminating"
        exit 1
      elif  sudo docker ps -a | grep 'pmm-server' > /dev/null ; then
        CONTAINER_NAME=$(sudo docker ps -a | grep 'pmm-server' | grep $PMM_VERSION | grep -v pmm-data | awk '{ print $1}')
        echo "ERROR! The name 'pmm-server' is already in use by container $CONTAINER_NAME"
        exit 1
      fi
    fi
   if [[ "$pmm_server" == "aws" ]];then
	    aws ec2 describe-instance-status --instance-ids  $INSTANCE_ID | grep "Code" | sed 's/[^0-9]//g'
    fi
    echo "Initiating PMM configuration"
    if [[ ! -z $PMM2  && -z $skip_docker_setup ]]; then
      sudo docker create -v /srv    --name pmm-data    perconalab/pmm-server:$PMM_VERSION  /bin/true
      sudo docker run -d  -p $PMM_PORT:80 -p 443:443 -p 9000:9000  --name pmm-server perconalab/pmm-server:$PMM_VERSION
    else
    if [ ! -z $DEV_FB ]; then
      sudo docker create -v /opt/prometheus/data  -v /var/lib/grafana -v /opt/consul-data -v /var/lib/mysql -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" --name pmm-data perconalab/pmm-server-fb:$DEV_FB /bin/true 2>/dev/null
      sudo docker run -d -p $PMM_PORT:80 -p 8500:8500 $DOCKER_CONTAINER_MEMORY $PMM_METRICS_MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always perconalab/pmm-server-fb:$DEV_FB 2>/dev/null
    else

      if [ -z $dev ]; then
        sudo docker create -v /opt/prometheus/data -v /var/lib/grafana -v /opt/consul-data -v /var/lib/mysql -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" --name pmm-data percona/pmm-server:$PMM_VERSION /bin/true 2>/dev/null
      else
        sudo docker create -v /opt/prometheus/data  -v /var/lib/grafana -v /opt/consul-data -v /var/lib/mysql -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" --name pmm-data perconalab/pmm-server:$PMM_VERSION /bin/true 2>/dev/null
      fi
      if [ -z $dev ]; then
        if [ "$IS_SSL" == "Yes" ];then
          sudo docker run -d -p $PMM_PORT:443 -p 8500:8500 $DOCKER_CONTAINER_MEMORY $PMM_METRICS_MEMORY  -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always percona/pmm-server:$PMM_VERSION 2>/dev/null
        else
          sudo docker run -d -p $PMM_PORT:80 -p 8500:8500 $DOCKER_CONTAINER_MEMORY $PMM_METRICS_MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always percona/pmm-server:$PMM_VERSION 2>/dev/null
        fi
      else
        if [ "$IS_SSL" == "Yes" ];then
          sudo docker run -d -p $PMM_PORT:443 -p 8500:8500 $DOCKER_CONTAINER_MEMORY $PMM_METRICS_MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always perconalab/pmm-server:$PMM_VERSION 2>/dev/null
        else
          sudo docker run -d -p $PMM_PORT:80 -p 8500:8500 $DOCKER_CONTAINER_MEMORY $PMM_METRICS_MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always perconalab/pmm-server:$PMM_VERSION 2>/dev/null
        fi
     fi
   fi
  fi
  elif [[ "$pmm_server" == "ami" ]] ; then
    if [[ ! -e $(which aws 2> /dev/null) ]] ;then
      echo "ERROR! AWS client program is currently not installed. Please install awscli. Terminating"
      exit 1
    fi
    if [ ! -f $HOME/.aws/credentials ]; then
      echo "ERROR! AWS access key is not configured. Terminating"
	  exit 1
	fi
	aws ec2 run-instances \
	--image-id $ami_image \
	--security-group-ids sg-3b6e5e46 \
	--instance-type t2.micro \
    --subnet-id subnet-4765a930 \
    --region us-east-1 \
    --key-name $key_name > $WORKDIR/aws_instance_config.txt 2> /dev/null

	INSTANCE_ID=$(cat $WORKDIR/aws_instance_config.txt | grep "InstanceId"  | awk -F[\"\"] '{print $4}')

	aws ec2 create-tags  \
    --resources $INSTANCE_ID \
    --region us-east-1 \
    --tags Key=Name,Value=PMM_test_image 2> /dev/null

	sleep 30

	AWS_PUBLIC_IP=$(aws ec2 describe-instances --instance-ids  $INSTANCE_ID | grep "PublicIpAddress" | awk -F[\"\"] '{print $4}')
  elif [[ "$pmm_server" == "ova" ]] ; then
    if [[ ! -e $(which VBoxManage 2> /dev/null) ]] ;then
      echo "ERROR! VBoxManage client program is currently not installed. Please install VirtualBox. Terminating"
      exit 1
    fi
	ova_image_name=$(echo $ova_image | sed 's/.ova//')
    VMBOX=$(vboxmanage list runningvms | grep $ova_image_name | awk -F[\"\"] '{print $2}')
	VMBOX_STATUS=$(vboxmanage showvminfo $VMBOX  | grep State | awk '{print $2}')
	if [[ "$VMBOX_STATUS" == "running" ]]; then
	  echo "ERROR! pmm-server ova instance is already runnning. Terminating"
      exit 1
	fi
	# import image
	if [ ! -f $ova_image ] ;then
	  echo "Alert! ${ova_image} does not exist in $WORKDIR. Downloading ${ova_image} ..."
	  wget https://s3.amazonaws.com/percona-vm/$ova_image
	fi
    VBoxManage import $ova_image > $WORKDIR/ova_instance_config.txt 2> /dev/null
	NETWORK_INTERFACE=$(ip addr | grep $IP_ADDRESS |  awk 'NF>1{print $NF}')
	VBoxManage modifyvm $ova_image_name --nic1 bridged --bridgeadapter1 ${NETWORK_INTERFACE}
	VBoxManage modifyvm $ova_image_name --uart1 0x3F8 4 --uartmode1 file $WORKDIR/pmm-server-console.log
    VBoxManage modifyvm $ova_image_name --memory ${ova_memory}
    # start instance
    VBoxManage startvm --type headless $ova_image_name > $WORKDIR/pmm-server-starup.log 2> /dev/null
	sleep 120
	OVA_PUBLIC_IP=$(grep 'Percona Monitoring and Management' $WORKDIR/pmm-server-console.log | awk -F[\/\/] '{print $3}')
  fi
 #  #PMM configuration setup
  if [ -z $pmm_server_version ] && [ -z $dev ]; then
   PMM_VERSION=$(lynx --dump https://hub.docker.com/r/percona/pmm-server/tags/ | grep '[0-9].[0-9].[0-9]' | sed 's|   ||' | head -n1)
 else
   if [[ ! -z $pmm_server_version ]]; then
     PMM_VERSION=$pmm_server_version
   fi
   echo "PMM version is ====== $PMM_VERSION"
 fi
  echo "Initiating PMM client configuration"
  PMM_CLIENT_BASEDIR=$(ls -1td pmm-client-* 2>/dev/null | grep -v ".tar" | head -n1)
  if [ -z $PMM_CLIENT_BASEDIR ]; then
    PMM_CLIENT_TAR=$(ls -1td pmm-client-* 2>/dev/null | grep ".tar" | head -n1)
    if [ ! -z $PMM_CLIENT_TAR ];then
      tar -xzf $PMM_CLIENT_TAR
      PMM_CLIENT_BASEDIR=$(ls -1td pmm-client-* 2>/dev/null | grep -v ".tar" | head -n1)
      pushd $PMM_CLIENT_BASEDIR > /dev/null
      sudo ./install
      popd > /dev/null
    else
      if [ ! -z $PMM2 ]; then
        install_client
      else
      if [ ! -z $dev ]; then
        if [  -z $link_client]; then
         PMM_CLIENT_TARBALL_URL=$(lynx --listonly --dump https://www.percona.com/downloads/TESTING/pmm/ | grep  "pmm-client" |awk '{print $2}'| grep "tar.gz" | head -n1)
        else
          PMM_CLIENT_TARBALL_URL=$link_client
        fi
        #echo "PMM client URL $PMM_CLIENT_URL"
        echo "PMM client tarball $PMM_CLIENT_TARBALL_URL"
        wget $PMM_CLIENT_TARBALL_URL
        PMM_CLIENT_TAR=$(echo $PMM_CLIENT_TARBALL_URL | grep -o '[^/]*$')
        tar -xzf $PMM_CLIENT_TAR
        PMM_CLIENT_BASEDIR=$(ls -1td pmm-client-* 2>/dev/null | grep -v ".tar" | head -n1)
        pushd $PMM_CLIENT_BASEDIR > /dev/null
        sudo ./install
        popd > /dev/null
      else
        PMM_CLIENT_TAR=$(lynx --dump  https://www.percona.com/downloads/pmm-client/$PMM_VERSION/binary/tarball/ | grep -o pmm-client.*.tar.gz | head -n1)
        echo "PMM client tar 2 $PMM_CLIENT_TAR"
        wget https://www.percona.com/downloads/pmm-client/$PMM_VERSION/binary/tarball/$PMM_CLIENT_TAR
        tar -xzf $PMM_CLIENT_TAR
        PMM_CLIENT_BASEDIR=$(ls -1td pmm-client-* 2>/dev/null | grep -v ".tar" | head -n1)
        pushd $PMM_CLIENT_BASEDIR > /dev/null
        sudo ./install
        popd > /dev/null
      fi
    fi
  fi
  else
    pushd $PMM_CLIENT_BASEDIR > /dev/null
    sudo ./install
    popd > /dev/null
  fi
  if [ "$IS_SSL" == "Yes" ];then
    PMM_MYEXTRA="--server-insecure-ssl"
  else
    PMM_MYEXTRA=""
  fi
  if [[ ! -e $(which pmm-admin 2> /dev/null) ]] ;then
    echo "ERROR! The pmm-admin client binary was not found, please install the pmm-client package"
    exit 1
  else
    sleep 10
  if [[ ! -e $(which pmm-agent 2> /dev/null) ]] && [ ! -z $PMM2 ] ;then
    echo "ERROR! The pmm-agent was not found, please install the pmm2-client package"
    exit 1
  fi
   #Cleaning existing PMM server configuration
  if [ ! -z $PMM2 ]; then
    configure_client
  else
    sudo truncate -s0 /usr/local/percona/pmm-client/pmm.yml
    if [[ "$pmm_server" == "ami" ]]; then
	  sudo pmm-admin config --server $AWS_PUBLIC_IP --client-address $IP_ADDRESS $PMM_MYEXTRA
	  echo "Alert! Password protection is not enabled in ami image, Please configure it manually"
	  SERVER_IP=$AWS_PUBLIC_IP
    elif [[ "$pmm_server" == "ova" ]]; then
	  sudo pmm-admin config --server $OVA_PUBLIC_IP --client-address $IP_ADDRESS $PMM_MYEXTRA
	  echo "Alert! Password protection is not enabled in ova image, Please configure it manually"
	  SERVER_IP=$OVA_PUBLIC_IP
    else
      sudo pmm-admin config --server $IP_ADDRESS:$PMM_PORT --server-user=$pmm_server_username --server-password=$pmm_server_password $PMM_MYEXTRA
	  SERVER_IP=$IP_ADDRESS
    fi
  fi
fi

  echo -e "******************************************************************"
  if [[ "$pmm_server" == "docker" ]]; then
    echo -e "Please execute below command to access docker container"
    echo -e "docker exec -it pmm-server bash\n"
  fi
  if [ "$IS_SSL" == "Yes" ];then
    (
    printf "%s\t%s\n" "PMM landing page" "https://$SERVER_IP:$PMM_PORT"
    if [ ! -z $pmm_server_username ];then
      printf "%s\t%s\n" "PMM landing page username" "$pmm_server_username"
    fi
    if [ ! -z $pmm_server_password ];then
      printf "%s\t%s\n" "PMM landing page password" "$pmm_server_password"
    fi
    printf "%s\t%s\n" "Query Analytics (QAN web app)" "https://$SERVER_IP:$PMM_PORT/qan"
    printf "%s\t%s\n" "Metrics Monitor (Grafana)" "https://$SERVER_IP:$PMM_PORT/graph"
    printf "%s\t%s\n" "Metrics Monitor username" "admin"
    printf "%s\t%s\n" "Metrics Monitor password" "admin"
    printf "%s\t%s\n" "Orchestrator" "https://$SERVER_IP:$PMM_PORT/orchestrator"
    ) | column -t -s $'\t'
  else
    (
    printf "%s\t%s\n" "PMM landing page" "http://$SERVER_IP:$PMM_PORT"
    if [ ! -z $pmm_server_username ];then
      printf "%s\t%s\n" "PMM landing page username" "$pmm_server_username"
    fi
    if [ ! -z $pmm_server_password ];then
      printf "%s\t%s\n" "PMM landing page password" "$pmm_server_password"
    fi
    printf "%s\t%s\n" "Query Analytics (QAN web app)" "http://$SERVER_IP/qan"
    printf "%s\t%s\n" "Metrics Monitor (Grafana)" "http://$SERVER_IP/graph"
    printf "%s\t%s\n" "Metrics Monitor username" "admin"
    printf "%s\t%s\n" "Metrics Monitor password" "admin"
    printf "%s\t%s\n" "Orchestrator" "http://$SERVER_IP/orchestrator"
    ) | column -t -s $'\t'
  fi
  echo -e "******************************************************************"
}

#Download and install PMM2.x client
install_client(){
  if [ ! -z $link_client ]; then
    PMM_CLIENT_TAR_URL=$link_client;
  else
    PMM_CLIENT_TAR_URL=$(lynx --listonly --dump https://www.percona.com/downloads/TESTING/pmm/ | grep  "pmm2-client" |awk '{print $2}'| grep "tar.gz" | head -n1)
  fi
  echo "PMM2 client  $PMM_CLIENT_TAR_URL"
  wget $PMM_CLIENT_TAR_URL
  PMM_CLIENT_TAR=$(echo $PMM_CLIENT_TAR_URL | grep -o '[^/]*$')
  tar -xzf $PMM_CLIENT_TAR
  PMM_CLIENT_BASEDIR=$(ls -1td pmm2-client-* 2>/dev/null | grep -v ".tar" | head -n1)
  pushd $PMM_CLIENT_BASEDIR > /dev/null
  echo "export PATH=$PATH:$PWD/bin" >> ~/.bash_profile
  source ~/.bash_profile
  pmm-admin --version
  pmm-agent setup --config-file=$PWD/config/pmm-agent.yaml --server-address=$IP_ADDRESS:443 --server-insecure-tls  --server-username=admin --server-password=admin --trace
  pmm-agent --config-file=$PWD/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
}

configure_client() {
  if [ ! -z $IP_ADDRESS ]; then
    if [ ! -z $setup ]; then
      pmm-agent setup --server-address=$IP_ADDRESS:443 --server-insecure-tls  --server-username=admin --server-password=admin --trace
    else
      sudo pmm-agent setup --server-address=$IP_ADDRESS:443 --server-insecure-tls  --server-username=admin --server-password=admin --trace
    fi
    SERVER_IP=$IP_ADDRESS
  else
    IP_ADDRESS=$(ip route get 8.8.8.8 | awk -F"src " 'NR==1{split($2,a," ");print a[1]}')
    SERVER_IP=$IP_ADDRESS
    if [ ! -z $setup ]; then
      pmm-agent setup --server-address=$IP_ADDRESS:443 --server-insecure-tls  --server-username=admin --server-password=admin --trace
    else
      sudo pmm-agent setup --server-address=$IP_ADDRESS:443 --server-insecure-tls  --server-username=admin --server-password=admin --trace
    fi
  fi
  sleep 5
}

setup_db_tar(){
  PRODUCT_NAME=$1
  SERVER_STRING=$2
  CLIENT_MSG=$3
  VERSION=$4

  #This is only needed due to a bug in get_download_links.sh file, once that is fixed, we don't need to hardcode Download URL's
  if [[ "${PRODUCT_NAME}" == "ps" && "${VERSION}" == "8.0" ]]; then
    LINK="https://downloads.percona.com/downloads/Percona-Server-8.0/Percona-Server-8.0.32-24/binary/tarball/Percona-Server-8.0.32-24-Linux.x86_64.glibc2.17-minimal.tar.gz"
    FILE=`echo $LINK | awk -F"/" '{print $9}'`
    if [ ! -f $FILE ]; then
      wget $LINK 2>/dev/null
    fi
    VERSION_ACCURATE="8.0.32"
    PORT_NUMBER="80321"
    BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
  elif [[ "${PRODUCT_NAME}" == "ps" && "${VERSION}" == "5.7" ]]; then
    LINK="https://www.percona.com/downloads/Percona-Server-5.7/Percona-Server-5.7.31-34/binary/tarball/Percona-Server-5.7.31-34-Linux.x86_64.glibc2.12-minimal.tar.gz"
    FILE=`echo $LINK | awk -F"/" '{print $9}'`
    if [ ! -f $FILE ]; then
      wget $LINK 2>/dev/null
    fi
    VERSION_ACCURATE="5.7.31"
    PORT_NUMBER="57311"
    BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
  else
    if cat /etc/os-release | grep rhel >/dev/null ; then
      DISTRUBUTION=centos
    fi
    LINK=`$SCRIPT_PWD/../get_download_link.sh --product=${PRODUCT_NAME} --distribution=$DISTRUBUTION --version=$VERSION`
    echo "Downloading $CLIENT_MSG(Version : $VERSION)"
    FILE=`$SCRIPT_PWD/../get_download_link.sh --product=${PRODUCT_NAME} --distribution=$DISTRUBUTION --version=$VERSION | awk -F"/" '{print $7}'`
    if [ ! -f $FILE ]; then
      wget $LINK 2>/dev/null
    fi
    VERSION_ACCURATE=`$SCRIPT_PWD/../get_download_link.sh --product=${PRODUCT_NAME} --distribution=$DISTRUBUTION --version=$VERSION | awk -F"-" '{ print $3 }'`
    PORT_NUMBER=`$SCRIPT_PWD/../get_download_link.sh --product=${PRODUCT_NAME} --distribution=$DISTRUBUTION --version=$VERSION | awk -F"-" '{ print $3 }' | tr -d .`
    BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
  fi
}
#Get PMM client basedir.
get_basedir(){
  PRODUCT_NAME=$1
  SERVER_STRING=$2
  CLIENT_MSG=$3
  VERSION=$4
  if cat /etc/os-release | grep rhel >/dev/null ; then
   DISTRUBUTION=centos
  fi
  if [ $download_link -eq 1 ]; then
    if [ -f $SCRIPT_PWD/../get_download_link.sh ]; then
      if [[ "${PRODUCT_NAME}" == "psmdb" && "${VERSION}" == "4.4" ]]; then
        LINK="https://downloads.percona.com/downloads/percona-server-mongodb-4.4/percona-server-mongodb-4.4.16-16/binary/tarball/percona-server-mongodb-4.4.16-16-x86_64.glibc2.17-minimal.tar.gz"
      elif [[ "${PRODUCT_NAME}" == "psmdb" && "${VERSION}" == "4.2" ]]; then
        LINK="https://downloads.percona.com/downloads/percona-server-mongodb-4.2/percona-server-mongodb-4.2.22-22/binary/tarball/percona-server-mongodb-4.2.22-22-x86_64.glibc2.17-minimal.tar.gz"
      elif [[ "${PRODUCT_NAME}" == "psmdb" && "${VERSION}" == "5.0" ]]; then
        LINK="https://downloads.percona.com/downloads/percona-server-mongodb-LATEST/percona-server-mongodb-5.0.13-11/binary/tarball/percona-server-mongodb-5.0.13-11-x86_64.glibc2.17-minimal.tar.gz"
      elif [[ "${PRODUCT_NAME}" == "psmdb" && "${VERSION}" == "6.0" ]]; then
        LINK="https://downloads.percona.com/downloads/TESTING/psmdb-6.0.2-1/percona-server-mongodb-6.0.2-1-x86_64.glibc2.17-minimal.tar.gz"
      elif [[ "${PRODUCT_NAME}" == "psmdb" && "${VERSION}" == "4.0" ]]; then
        LINK="https://downloads.percona.com/downloads/percona-server-mongodb-4.0/percona-server-mongodb-4.0.28-23/binary/tarball/percona-server-mongodb-4.0.28-23-x86_64.glibc2.17-minimal.tar.gz"
      else
        LINK=`$SCRIPT_PWD/../get_download_link.sh --product=${PRODUCT_NAME} --distribution=$DISTRUBUTION --version=$VERSION`
      fi
      echo "Downloading $CLIENT_MSG(Version : $VERSION)"
      wget $LINK 2>/dev/null
      BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
      if [ -z $BASEDIR ]; then
        BASE_TAR=$(ls -1td $SERVER_STRING 2>/dev/null | grep ".tar" | head -n1)
        if [ ! -z $BASE_TAR ];then
          tar -xvf $BASE_TAR >/dev/null
          if [[ "${PRODUCT_NAME}" == "postgresql" ]]; then
            BASEDIR=$(ls -1td pgsql 2>/dev/null | grep -v ".tar" | head -n1)
          else
            BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
          fi
          BASEDIR="$WORKDIR/$BASEDIR"
          rm -rf $BASEDIR/node*
        else
          echo "ERROR! $CLIENT_MSG(this script looked for '$SERVER_STRING') does not exist. Terminating."
          exit 1
        fi
      else
        BASEDIR="$WORKDIR/$BASEDIR"
      fi
    else
      echo "ERROR! $SCRIPT_PWD/../get_download_link.sh does not exist. Terminating."
      exit 1
    fi
  else
    BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
    if [ -z $BASEDIR ]; then
      BASE_TAR=$(ls -1td $SERVER_STRING 2>/dev/null | grep ".tar" | head -n1)
      if [ ! -z $BASE_TAR ];then
        tar -xvf $BASE_TAR >/dev/null
        if [[ "${PRODUCT_NAME}" == "postgresql" ]]; then
            BASEDIR=$(ls -1td pgsql 2>/dev/null | grep -v ".tar" | head -n1)
        else
          BASEDIR=$(ls -1td $SERVER_STRING 2>/dev/null | grep -v ".tar" | head -n1)
        fi
        BASEDIR="$WORKDIR/$BASEDIR"
        if [[ "${CLIENT_NAME}" == "mo" ]]; then
          sudo rm -rf $BASEDIR/data
        else
          rm -rf $BASEDIR/node*
        fi
      else
        echo "ERROR! $CLIENT_MSG(this script looked for '$SERVER_STRING') does not exist. Terminating."
        exit 1
      fi
    else
      BASEDIR="$WORKDIR/$BASEDIR"
    fi
  fi
}

# Function to compare query count
compare_query(){
  insert_loop(){
    NUM_START=$((CURRENT_QUERY_COUNT + 1))
    NUM_END=$(shuf -i ${1} -n 1)
	TOTAL_QUERY_COUNT_BEFORE_RUN=$(${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -Bse "SELECT COUNT_STAR  FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';")
    for i in `seq $NUM_START $NUM_END`; do
      STRING=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
      ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "INSERT INTO test.t1 (str) VALUES ('${STRING}')"
    done
	TOTAL_QUERY_COUNT_AFTER_RUN=$(${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -Bse "SELECT COUNT_STAR  FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';")
	CURRENT_QUERY_COUNT=$((TOTAL_QUERY_COUNT_AFTER_RUN - TOTAL_QUERY_COUNT_BEFORE_RUN))
    START_TIME=$(${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -Bse "SELECT FIRST_SEEN  FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';")
    END_TIME=$(${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -Bse "SELECT LAST_SEEN  FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';")
  }

  #BASEDIR="/home/ramesh/pmmwork/ps57"
  TEST_SOCKET=$(sudo pmm-admin list | grep "mysql:metrics[ \t].*_NODE-" | head -1 | awk -F[\(\)] '{print $2}')
  TEST_NODE_NAME=$(sudo pmm-admin list | grep "mysql:metrics[ \t].*_NODE-" | head -1  | awk '{print $2}')
  if [ $disable_ssl -eq 1 ]; then
    sudo pmm-admin add mysql --user=root --socket=$TEST_SOCKET SHADOW_NODE --disable-ssl
  else
    sudo pmm-admin add mysql --user=root --socket=$TEST_SOCKET SHADOW_NODE
  fi
  if [ -z $TEST_SOCKET ];then
    echo "ERROR! PMM client instance does not exist. Terminating"
	exit 1
  fi
  echo "Initializing query count testing"
  ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "create database if not exists test;"  2>&1
  ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "create table test.t1 (id int auto_increment,str varchar(32), primary key(id))" 2>&1
  echo "Running first set INSERT statement execution"
  insert_loop 1000-5000
  echo "Sleeping 60 secs"
  sleep 60
  echo "INSERT INTO test.t1 .. query count between ${START_TIME} and ${END_TIME}"
  ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "SELECT DIGEST_TEXT QUERY,COUNT_STAR ALL_QUERY_COUNT,$CURRENT_QUERY_COUNT QUERY_COUNT_CURRENT_RUN FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';"
  echo "Running second set INSERT statement execution"
  insert_loop 5001-10000
  echo "Sleeping 60 secs"
  sleep 60
  echo "INSERT INTO test.t1 .. query count between ${START_TIME} and ${END_TIME}"
  ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "SELECT DIGEST_TEXT QUERY,COUNT_STAR ALL_QUERY_COUNT,$CURRENT_QUERY_COUNT QUERY_COUNT_CURRENT_RUN FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';"
  echo "Running third set INSERT statement execution"
  insert_loop 10001-15000
  echo "Sleeping 60 secs"
  sleep 60
  echo "INSERT INTO test.t1 .. query count between ${START_TIME} and ${END_TIME}"
  ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "SELECT DIGEST_TEXT QUERY,COUNT_STAR ALL_QUERY_COUNT,$CURRENT_QUERY_COUNT QUERY_COUNT_CURRENT_RUN FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';"
  echo "Running fourth set INSERT statement execution"
  insert_loop 15001-20000
  echo "Sleeping 60 secs"
  sleep 60
  echo "INSERT INTO test.t1 .. query count between ${START_TIME} and ${END_TIME}"
  ${BASEDIR}/bin/mysql -uroot --socket=$TEST_SOCKET -e "SELECT DIGEST_TEXT QUERY,COUNT_STAR ALL_QUERY_COUNT,$CURRENT_QUERY_COUNT QUERY_COUNT_CURRENT_RUN FROM performance_schema.events_statements_summary_by_digest WHERE DIGEST_TEXT LIKE 'INSERT INTO `test`%';"
  sleep 300
  echo "INSERT INTO test.t1 .. query count from pmm client instance $TEST_NODE_NAME (Performance Schema)."
  docker exec -it pmm-server mysql -e"select sum(query_count) from pmm.query_class_metrics where query_class_id in (select query_class_id from pmm.query_classes where fingerprint like 'INSERT%') and instance_id=(select instance_id from pmm.instances where name='$TEST_NODE_NAME');"
  echo "INSERT INTO test.t1 .. query count from pmm client instance SHADOW_NODE (Slow log)."
  docker exec -it pmm-server mysql -e"select sum(query_count) from pmm.query_class_metrics where query_class_id in (select query_class_id from pmm.query_classes where fingerprint like 'INSERT%') and instance_id=(select instance_id from pmm.instances where name='SHADOW_NODE');"
  echo "Please compare these query count with QAN/Metrics webpage"
}

check_disable_ssl(){
  EXPORTER_NAME=$1
  echo ${EXPORTER_NAME}
  PMM_OUTPUT=$(sudo pmm-admin list | grep ${EXPORTER_NAME} | grep 'scheme=http')
  if [ ! -z "$PMM_OUTPUT" ]; then
    echo "SSL Disabled Succcesfully for" ${EXPORTER_NAME}
  else
    echo "Could not disable_ssl Please check again"
    exit 1;
  fi
}

remove_packages(){
  if [[ "${package_name}" == "ps" ]]; then
    BASEDIR=$(ls -1td [Pp]ercona-[Ss]erver-${ps_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td [Pp]ercona-[Ss]erver-${ps_version}* 2>/dev/null | grep ".tar" | head -n1)
  elif [[ "${package_name}" == "psmyr" ]]; then
    BASEDIR=$(ls -1td [Pp]ercona-[Ss]erver-${ps_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td [Pp]ercona-[Ss]erver-${ps_version}* 2>/dev/null | grep ".tar" | head -n1)
  elif [[ "${package_name}" == "ms" ]]; then
    BASEDIR=$(ls -1td mysql-${ms_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td mysql-${ms_version}* 2>/dev/null | grep ".tar" | head -n1)
  elif [[ "${package_name}" == "pgsql" ]]; then
    BASEDIR=$(ls -1td postgresql-${pgsql_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td postgresql-${pgsql_version}* 2>/dev/null | grep ".tar" | head -n1)
  elif [[ "${package_name}" == "md" ]]; then
    BASEDIR=$(ls -1td mariadb-${md_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td mariadb-${md_version}* 2>/dev/null | grep ".tar" | head -n1)
  elif [[ "${package_name}" == "pxc" ]]; then
    BASEDIR=$(ls -1td Percona-XtraDB-Cluster-${pxc_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td Percona-XtraDB-Cluster-${pxc_version}* 2>/dev/null | grep ".tar" | head -n1)
  elif [[ "${package_name}" == "mo" ]]; then
    BASEDIR=$(ls -1td percona-server-mongodb-${mo_version}* 2>/dev/null | grep -v ".tar" | head -n1)
    BASETAR=$(ls -1td percona-server-mongodb-${mo_version}* 2>/dev/null | grep ".tar" | head -n1)
  fi
  if [[ ! -z $BASEDIR ]]; then
    sudo rm -rf $BASEDIR;
  fi
  if [[ ! -z $BASETAR ]]; then
    sudo rm -rf $BASETAR;
  fi
}

#Percona Server configuration.
add_clients(){
  mkdir -p $WORKDIR/logs
  for i in ${ADDCLIENT[@]};do
    CLIENT_NAME=$(echo $i | grep -o  '[[:alpha:]]*')
    if [[ "${CLIENT_NAME}" == "ps" && -z $PMM2 ]]; then
      PORT_CHECK=101
      NODE_NAME="PS_NODE"
      get_basedir ps "Percona-Server-${ps_version}*" "Percona Server binary tar ball" ${ps_version}
      MYSQL_CONFIG="--init-file ${SCRIPT_PWD}/QRT_Plugin.sql --log_output=file --slow_query_log=ON --long_query_time=0 --log_slow_rate_limit=100 --log_slow_rate_type=query --log_slow_verbosity=full --log_slow_admin_statements=ON --log_slow_slave_statements=ON --slow_query_log_always_write_time=1 --slow_query_log_use_global_control=all --innodb_monitor_enable=all --userstat=1"
    elif [[ "${CLIENT_NAME}" == "psmyr" ]]; then
      PORT_CHECK=601
      NODE_NAME="PSMR_NODE"
      get_basedir ps "[Pp]ercona-[Ss]erver-${ps_version}*" "Percona Server binary tar ball" ${ps_version}
      MYSQL_CONFIG="--init-file ${SCRIPT_PWD}/QRT_Plugin.sql --log_output=file --slow_query_log=ON --long_query_time=0 --log_slow_rate_limit=100 --log_slow_rate_type=query --log_slow_verbosity=full --log_slow_admin_statements=ON --log_slow_slave_statements=ON --slow_query_log_always_write_time=1 --slow_query_log_use_global_control=all --innodb_monitor_enable=all --userstat=1 --plugin-load-add=rocksdb=ha_rocksdb.so --default-storage-engine=rocksdb"
    elif [[ "${CLIENT_NAME}" == "ms" && -z $PMM2 ]]; then
      PORT_CHECK=201
      NODE_NAME="MS_NODE"
      get_basedir mysql "mysql-${ms_version}*" "MySQL Server binary tar ball" ${ms_version}
      MYSQL_CONFIG="--init-file ${SCRIPT_PWD}/QRT_Plugin.sql --innodb_monitor_enable=all --performance_schema=ON"
    elif [[ "${CLIENT_NAME}" == "pgsql" && -z $PMM2 ]]; then
      PORT_CHECK=501
      NODE_NAME="PGSQL_NODE"
      get_basedir postgresql "postgresql-${pgsql_version}*" "Postgre SQL Binary tar ball" ${pgsql_version}
    elif [[ "${CLIENT_NAME}" == "md" && -z $PMM2 ]]; then
      PORT_CHECK=301
      NODE_NAME="MD_NODE"
      get_basedir mariadb "mariadb-${md_version}*" "MariaDB Server binary tar ball" ${md_version}
      MYSQL_CONFIG="--init-file ${SCRIPT_PWD}/QRT_Plugin.sql  --innodb_monitor_enable=all --performance_schema=ON"
    elif [[ "${CLIENT_NAME}" == "pxc" && -z $PMM2 ]]; then
      PORT_CHECK=401
      NODE_NAME="PXC_NODE"
      get_basedir pxc "Percona-XtraDB-Cluster-${pxc_version}*" "Percona XtraDB Cluster binary tar ball" ${pxc_version}
      MYSQL_CONFIG="--init-file ${SCRIPT_PWD}/QRT_Plugin.sql --log_output=file --slow_query_log=ON --long_query_time=0 --log_slow_rate_limit=100 --log_slow_rate_type=query --log_slow_verbosity=full --log_slow_admin_statements=ON --log_slow_slave_statements=ON --slow_query_log_always_write_time=1 --slow_query_log_use_global_control=all --innodb_monitor_enable=all --userstat=1"
    elif [[ "${CLIENT_NAME}" == "mo" && -z $PMM2 ]]; then
      get_basedir psmdb "percona-server-mongodb-${mo_version}*" "Percona Server Mongodb binary tar ball" ${mo_version}
    fi
    if [[ "${CLIENT_NAME}" != "md"  && "${CLIENT_NAME}" != "mo" && "${CLIENT_NAME}" != "pgsql" && -z $PMM2 ]]; then
      VERSION="$(${BASEDIR}/bin/mysqld --version | grep -oe '[58]\.[5670]' | head -n1)"
      if [ "$VERSION" == "5.7" -o "$VERSION" == "8.0" ]; then
        MID="${BASEDIR}/bin/mysqld   --default-authentication-plugin=mysql_native_password --initialize-insecure --basedir=${BASEDIR}"
      else
        MID="${BASEDIR}/scripts/mysql_install_db --no-defaults --basedir=${BASEDIR}"
      fi
    else
      if [[ "${CLIENT_NAME}" != "mo" ]]; then
        MID="${BASEDIR}/scripts/mysql_install_db --no-defaults --basedir=${BASEDIR}"
      fi
    fi

    ADDCLIENTS_COUNT=$(echo "${i}" | sed 's|[^0-9]||g')
    if  [[ "${CLIENT_NAME}" == "mo" && -z $MONGOMAGIC ]]; then
      rm -rf $BASEDIR/data
      if [ -f /usr/lib64/liblzma.so.5.0.99 ]; then
        sudo ln -s /usr/lib64/liblzma.so.5.0.99 /usr/lib64/liblzma.so.0
      else
        sudo ln -s /usr/lib64/liblzma.so.5.2.2 /usr/lib64/liblzma.so.0
      fi
      for k in `seq 1  ${REPLCOUNT}`;do
        PSMDB_PORT=$(( (RANDOM%21 + 10) * 1001 ))
        PSMDB_PORTS+=($PSMDB_PORT)
          for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
            PORT=$(( $PSMDB_PORT + $j - 1 ))
            mkdir -p ${BASEDIR}/data/rpldb${k}_${j}
            $BASEDIR/bin/mongod --profile 2 --slowms 1  $mongo_storage_engine  --replSet r${k} --dbpath=$BASEDIR/data/rpldb${k}_${j} --logpath=$BASEDIR/data/rpldb${k}_${j}/mongod.log --port=$PORT --logappend --fork &
            sleep 20
            if [ $disable_ssl -eq 1 ]; then
              sudo pmm-admin add mongodb --cluster mongodb_cluster  --uri localhost:$PORT mongodb_inst_rpl${k}_${j} --disable-ssl
              check_disable_ssl mongodb_inst_rpl${k}_${j}
            else
              sudo pmm-admin add mongodb --cluster mongodb_cluster  --uri localhost:$PORT mongodb_inst_rpl${k}_${j}
            fi
          done
      done
      create_replset_js()
      {
        REPLSET_COUNT=$(( ${ADDCLIENTS_COUNT} - 1 ))
        rm -rf /tmp/config_replset.js
        echo "port=parseInt(db.adminCommand(\"getCmdLineOpts\").parsed.net.port)" >> /tmp/config_replset.js
        for i in `seq 1  ${REPLSET_COUNT}`;do
          echo "port${i}=port+${i};" >> /tmp/config_replset.js
        done
        echo "conf = {" >> /tmp/config_replset.js
        echo "_id : replSet," >> /tmp/config_replset.js
        echo "members: [" >> /tmp/config_replset.js
        echo "  { _id:0 , host:\"localhost:\"+port,priority:10}," >> /tmp/config_replset.js
        for i in `seq 1  ${REPLSET_COUNT}`;do
          echo "  { _id:${i} , host:\"localhost:\"+port${i}}," >> /tmp/config_replset.js
        done
        echo "  ]" >> /tmp/config_replset.js
        echo "};" >> /tmp/config_replset.js

        echo "printjson(conf)" >> /tmp/config_replset.js
        echo "printjson(rs.initiate(conf));" >> /tmp/config_replset.js
      }
      create_replset_js
      if [[ "$with_replica" == "1" ]]; then
        for k in `seq 1  ${REPLCOUNT}`;do
	        n=$(( $k - 1 ))
		      echo "Configuring replicaset"
          sudo $BASEDIR/bin/mongo --quiet --port ${PSMDB_PORTS[$n]} --eval "var replSet='r${k}'" "/tmp/config_replset.js"
          sleep 20
	      done
	    fi
      if [ ! -z $PMM2 ]; then
        for p in `seq 1  ${REPLCOUNT}`;do
          n=$(( $p - 1 ))
          for r in `seq 1  ${ADDCLIENTS_COUNT}`;do
            PORT=$(( ${PSMDB_PORTS[$n]} + $r - 1 ))
            if [[ -z $use_socket ]]; then
              if [[ ! -z $metrics_mode ]]; then
                pmm-admin add mongodb --debug --metrics-mode=$metrics_mode --cluster mongodb_cluster mongodb_inst_rpl${p}_${r}_$IP_ADDRESS localhost:$PORT
              else
                pmm-admin add mongodb --debug --cluster mongodb_cluster mongodb_inst_rpl${p}_${r}_$IP_ADDRESS localhost:$PORT
              fi
            else
              if [[ ! -z $metrics_mode ]]; then
                pmm-admin add mongodb --debug --cluster mongodb_cluster --socket=/tmp/mongodb-$PORT.sock --metrics-mode=$metrics_mode mongodb_inst_rpl${p}_${r}_$IP_ADDRESS
              else
                pmm-admin add mongodb --debug --cluster mongodb_cluster --socket=/tmp/mongodb-$PORT.sock  mongodb_inst_rpl${p}_${r}_$IP_ADDRESS
              fi
            fi
          done
        done
      fi
      if [[ "$with_sharding" == "1" ]]; then
        #config
        CONFIG_MONGOD_PORT=$(( (RANDOM%21 + 10) * 1001 ))
        CONFIG_MONGOS_PORT=$(( (RANDOM%21 + 10) * 1001 ))
        for m in `seq 1 ${ADDCLIENTS_COUNT}`;do
          PORT=$(( $CONFIG_MONGOD_PORT + $m - 1 ))
          mkdir -p $BASEDIR/data/confdb${m}
          $BASEDIR/bin/mongod --profile 2 --fork --logpath $BASEDIR/data/confdb${m}/config_mongo.log --dbpath=$BASEDIR/data/confdb${m} --port $PORT --configsvr --replSet config &
          sleep 15
          if [ $disable_ssl -eq 1 ]; then
            sudo pmm-admin add mongodb --cluster mongodb_cluster  --uri localhost:$PORT mongodb_inst_config_rpl${m} --disable-ssl
            check_disable_ssl mongodb_inst_rpl${k}_${j}
          else
            if [ ! -z $PMM2 ]; then
              if [[ -z $use_socket ]]; then
                pmm-admin add mongodb --debug --cluster mongodb_cluster mongodb_inst_config_rpl${m}_$IP_ADDRESS localhost:$PORT
              else
                if [[ ! -z $metrics_mode ]]; then
                  pmm-admin add mongodb --debug --cluster mongodb_cluster --metrics-mode=$metrics_mode --socket=/tmp/mongodb-$PORT.sock mongodb_inst_config_rpl${m}_$IP_ADDRESS
                else
                  pmm-admin add mongodb --debug --cluster mongodb_cluster --socket=/tmp/mongodb-$PORT.sock mongodb_inst_config_rpl${m}_$IP_ADDRESS
                fi
              fi
            else
              sudo pmm-admin add mongodb --cluster mongodb_cluster --uri mongodb_inst_config_rpl${m} localhost:$PORT
            fi
          fi
          MONGOS_STARTUP_CMD="localhost:$PORT,$MONGOS_STARTUP_CMD"
        done

        echo "Configuring replicaset"
        $BASEDIR/bin/mongo --quiet --port ${CONFIG_MONGOD_PORT} --eval "var replSet='config'" "/tmp/config_replset.js"
        sleep 20

        MONGOS_STARTUP_CMD="${MONGOS_STARTUP_CMD::-1}"
        mkdir $BASEDIR/data/mongos
        #Removing default mongodb socket file
        sudo rm -rf /tmp/mongodb-27017.sock
        $BASEDIR/bin/mongos --fork --logpath $BASEDIR/data/mongos/mongos.log --configdb config/$MONGOS_STARTUP_CMD  &
        sleep 5
        if [ $disable_ssl -eq 1 ]; then
          sudo pmm-admin add mongodb --cluster mongodb_cluster --uri localhost:$CONFIG_MONGOD_PORT mongod_config_inst --disable-ssl
        else
          if [ ! -z $PMM2 ]; then
            pmm-admin add mongodb --cluster mongodb_cluster --debug mongos_config_inst_$IP_ADDRESS localhost:$CONFIG_MONGOS_PORT
          else
            sudo pmm-admin add mongodb --cluster mongodb_cluster --uri localhost:$CONFIG_MONGOS_PORT mongos_config_inst
          fi
        fi
        echo "Adding Shards"
		    sleep 20
        for k in `seq 1  ${REPLCOUNT}`;do
          n=$(( $k - 1 ))
          $BASEDIR/bin/mongo --quiet --eval "printjson(db.getSisterDB('admin').runCommand({addShard: 'r${k}/localhost:${PSMDB_PORTS[$n]}'}))"
        done
	    fi
    elif [[ -z $PMM2 && "${CLIENT_NAME}" == "pgsql" ]]; then
      if [ $create_pgsql_user -eq 1 ]; then
        PGSQL_USER=psql
        echo "Creating postgresql Dedicated User psql"
        if id psql >/dev/null 2>&1; then
          echo "yes the user psql exists"
        else
          echo "No, the user psql does not exist, Adding"
          sudo adduser --disabled-password --gecos "" psql
        fi
      else
        PGSQL_USER=nobody
      fi
      PGSQL_PORT=5431
      cd ${BASEDIR}/..
      result=pgsql
      sudo cp -u -R ${result} /home/
      BASEDIR=/home/pgsql
      cd ${BASEDIR}/bin
      sudo chmod +x .
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        PGSQL_PORT=$((PGSQL_PORT+j))
        echo "Current Path is $(pwd)"
        if [ -d ${BASEDIR}/${NODE_NAME}_${j}/data ]; then
          echo "PGSQL Data Directory Exist, Removing old Directory, Stopping already running Server and creating a new one"
          sudo -H -u ${PGSQL_USER} bash -c "./pg_ctl -D ${BASEDIR}/${NODE_NAME}_${j}/data -l ${BASEDIR}/${NODE_NAME}_${j}/data/logfile -o '-F -p ${PGSQL_PORT}' stop" > /dev/null 2>&1;
          sudo rm -r ${BASEDIR}/${NODE_NAME}_${j}
          sudo mkdir -p ${BASEDIR}/${NODE_NAME}_${j}/data
        else
          sudo mkdir -p ${BASEDIR}/${NODE_NAME}_${j}/data
        fi
        sudo_check ${PGSQL_USER}
        sudo chown -R ${PGSQL_USER} ${BASEDIR}/${NODE_NAME}_${j}/data
        echo "Starting PGSQL server at port ${PGSQL_PORT}"
        sudo -H -u ${PGSQL_USER} bash -c "./initdb -D ${BASEDIR}/${NODE_NAME}_${j}/data --username=postgres" > /dev/null 2>&1;
        sudo -H -u ${PGSQL_USER} bash -c "./pg_ctl -D ${BASEDIR}/${NODE_NAME}_${j}/data -l ${BASEDIR}/${NODE_NAME}_${j}/data/logfile -o '-F -p ${PGSQL_PORT}' start" > /dev/null 2>&1;
        sudo -H -u ${PGSQL_USER} bash -c "./createdb psql --username=postgres"
        if [ $disable_ssl -eq 1 ]; then
          sudo pmm-admin add postgresql --query-source=pgstatements --user postgres --host localhost --port ${PGSQL_PORT} --disable-ssl PGSQL-${NODE_NAME}-${j}
          check_disable_ssl PGSQL-${NODE_NAME}-${j}
        else
          sudo pmm-admin add postgresql --query-source=pgstatements --user postgres --host localhost --port ${PGSQL_PORT} PGSQL-${NODE_NAME}-${j}
        fi
      done
    elif [[ "${CLIENT_NAME}" == "pgsql" && ! -z $PMM2 ]]; then
      PGSQL_PORT=5432
      export PGSQL_PASSWORD=oFukiBRg7GujAJXq3tmd
      docker pull postgres:${pgsql_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $PGSQL_PORT postgres
        docker run --name PGSQL_${pgsql_version}_${IP_ADDRESS}_$j -v $SCRIPT_PWD/postgres:/docker-entrypoint-initdb.d/:rw -e POSTGRES_PASSWORD=${PGSQL_PASSWORD} -p $PGSQL_PORT:5432 -d postgres:${pgsql_version} -c shared_preload_libraries='pg_stat_statements' -c pg_stat_statements.max=10000 -c pg_stat_statements.track=all
        sleep 20
        docker exec PGSQL_${pgsql_version}_${IP_ADDRESS}_$j psql -h localhost -U postgres -c 'CREATE DATABASE mydat;'
        if [ $(( ${j} % 2 )) -eq 0 ]; then
          if [[ ! -z $metrics_mode ]]; then
            pmm-admin add postgresql --query-source=pgstatements --username=postgres --password=${PGSQL_PASSWORD} --environment=pgsql-prod --cluster=pgsql-prod-cluster --metrics-mode=$metrics_mode --replication-set=pgsql-repl2 PGSQL_${pgsql_version}_${IP_ADDRESS}_$j localhost:$PGSQL_PORT
          else
            pmm-admin add postgresql --query-source=pgstatements --username=postgres --password=${PGSQL_PASSWORD} --environment=pgsql-prod --cluster=pgsql-prod-cluster --replication-set=pgsql-repl2 PGSQL_${pgsql_version}_${IP_ADDRESS}_$j localhost:$PGSQL_PORT
          fi
        else
          if [[ ! -z $metrics_mode ]]; then
            pmm-admin add postgresql --query-source=pgstatements --username=postgres --password=${PGSQL_PASSWORD} --environment=pgsql-dev --cluster=pgsql-dev-cluster --metrics-mode=$metrics_mode --replication-set=pgsql-repl1 PGSQL_${pgsql_version}_${IP_ADDRESS}_$j localhost:$PGSQL_PORT
          else
            pmm-admin add postgresql --query-source=pgstatements --username=postgres --password=${PGSQL_PASSWORD} --environment=pgsql-dev --cluster=pgsql-dev-cluster --replication-set=pgsql-repl1 PGSQL_${pgsql_version}_${IP_ADDRESS}_$j localhost:$PGSQL_PORT
          fi
        fi
        PGSQL_PORT=$((PGSQL_PORT+j))
      done
    elif [[ "${CLIENT_NAME}" == "pdpgsql" && ! -z $PMM2 ]]; then
      PDPGSQL_PORT=6432
      export PDPGSQL_PASSWORD=oFukiBRg7GujAJXq3tmd
      docker pull perconalab/percona-distribution-postgresql:${pdpgsql_version}
      git clone https://github.com/percona/pg_stat_monitor
      for j in `seq 1 ${ADDCLIENTS_COUNT}`;do
        check_port $PDPGSQL_PORT PDPGSQL
        pdpgsql_service_name=$(prepare_service_name PDPGSQL_${pdpgsql_version}_${IP_ADDRESS}_$j)
        docker run --name $pdpgsql_service_name -v $SCRIPT_PWD/postgres:/docker-entrypoint-initdb.d/:rw -p $PDPGSQL_PORT:5432 \
        -d -e POSTGRES_PASSWORD=${PDPGSQL_PASSWORD} perconalab/percona-distribution-postgresql:${pdpgsql_version} \
        -c shared_preload_libraries=pg_stat_statements,pg_stat_monitor \
        -c pg_stat_monitor.pgsm_bucket_time=60 \
        -c pg_stat_monitor.pgsm_max_buckets=10 -c pg_stat_monitor.pgsm_query_shared_buffer=20 \
        -c pg_stat_monitor.pgsm_max=100 -c track_activity_query_size=2048 -c pg_stat_statements.max=10000 \
        -c pg_stat_monitor.pgsm_normalized_query=0 -c pg_stat_monitor.pgsm_query_max_len=10000 \
        -c pg_stat_monitor.pgsm_enable_query_plan=1 \
        -c pg_stat_statements.track=all -c pg_stat_statements.save=off -c track_io_timing=on
        sleep 20
        docker exec $pdpgsql_service_name psql -h localhost -U postgres -c 'create extension pg_stat_monitor'
        docker exec $pdpgsql_service_name psql -h localhost -U postgres -c 'SELECT pg_reload_conf();'
        if [ $(( ${j} % 2 )) -eq 0 ]; then
          if [[ ! -z $metrics_mode ]]; then
            pmm-admin add postgresql --username=postgres --password=${PDPGSQL_PASSWORD} --environment=pdpgsql-prod --cluster=pdpgsql-prod-cluster --metrics-mode=$metrics_mode --query-source=pgstatmonitor --replication-set=pdpgsql-repl2 $pdpgsql_service_name localhost:$PDPGSQL_PORT
          else
            pmm-admin add postgresql --username=postgres --password=${PDPGSQL_PASSWORD} --environment=pdpgsql-prod --cluster=pdpgsql-prod-cluster --query-source=pgstatmonitor --replication-set=pdpgsql-repl2 $pdpgsql_service_name localhost:$PDPGSQL_PORT
          fi
        else
          if [[ ! -z $metrics_mode ]]; then
            pmm-admin add postgresql --username=postgres --password=${PDPGSQL_PASSWORD} --environment=pdpgsql-dev --cluster=pdpgsql-dev-cluster --metrics-mode=$metrics_mode --query-source=pgstatmonitor --replication-set=pdpgsql-repl1 $pdpgsql_service_name localhost:$PDPGSQL_PORT
          else
            pmm-admin add postgresql --username=postgres --password=${PDPGSQL_PASSWORD} --environment=pdpgsql-dev --cluster=pdpgsql-dev-cluster --query-source=pgstatmonitor --replication-set=pdpgsql-repl1 $pdpgsql_service_name localhost:$PDPGSQL_PORT
          fi
        fi
        sudo chmod +x $SCRIPT_PWD/pgstatmonitor_metrics_queries.sh
        bash $SCRIPT_PWD/pgstatmonitor_metrics_queries.sh $pdpgsql_service_name > /dev/null 2>&1 &
        PDPGSQL_PORT=$((PDPGSQL_PORT+j))
      done
    elif [[ "${CLIENT_NAME}" == "haproxy" && ! -z $PMM2 ]]; then
      echo "Setting up PMM and HAPROXY Integration"

      ## only doing it for jenkins workers, need ansible installed on the host
      sudo yum install -y ansible || true
      export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
      docker network create pmm-qa || true
      docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
      pushd $SCRIPT_PWD/
      if [ -z "$CLIENT_VERSION" ]
      then
        export CLIENT_VERSION=dev-latest
      fi
      if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
      then
        if [ ! -z "${PMM2_SERVER_IP}" ]
        then
          export PMM_SERVER_IP=${PMM2_SERVER_IP}
        else
          export PMM_SERVER_IP=127.0.0.1
        fi
      else
        export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
      fi
      export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
      ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 haproxy_setup.yml
      popd
    elif [[ "${CLIENT_NAME}" == "ms" && ! -z $PMM2 ]]; then
    setup_pmm_ms_integration
    elif [[ "${CLIENT_NAME}" == "ps" && ! -z $PMM2 ]]; then
      echo "Checking if Percona-xtrabackup required"
      if [[ ! -z $install_backup_toolkit ]]; then
        sudo chmod +x $SCRIPT_PWD/install_backup_toolkit.sh
        bash $SCRIPT_PWD/install_backup_toolkit.sh ${ps_version}
      fi
      if [[ ! -z $setup_group_replication ]]; then
        check_dbdeployer
        setup_db_tar ps "Percona-Server-${ps_version}*" "Percona Server binary tar ball" ${ps_version}
        if [ -d "$WORKDIR/ps" ]; then
          rm -Rf $WORKDIR/ps;
        fi
        mkdir $WORKDIR/ps
        dbdeployer unpack Percona-Server-${ps_version}* --sandbox-binary $WORKDIR/ps --overwrite
        rm -Rf Percona-Server-${ps_version}*
        dbdeployer deploy --topology=group replication $VERSION_ACCURATE --single-primary --sandbox-binary $WORKDIR/ps --force
        node_port=`dbdeployer sandboxes --header | grep $VERSION_ACCURATE | grep 'group-single-primary' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
        for j in `seq 1  3`;do
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_rate_limit=1;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
          #run_workload 127.0.0.1 msandbox msandbox $node_port mysql percona-server-group-replication-node-$j
          if [[ -z $use_socket ]]; then
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ps-prod --metrics-mode=$metrics_mode --cluster=ps-prod-cluster --replication-set=ps-repl ps-group-replication-node-$j-$IP_ADDRESS --debug 127.0.0.1:$node_port
            else
              pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ps-prod --cluster=ps-prod-cluster --replication-set=ps-repl ps-group-replication-node-$j-$IP_ADDRESS --debug 127.0.0.1:$node_port
            fi
          else
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --socket=/tmp/mysql_sandbox$node_port.sock --metrics-mode=$metrics_mode --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps-group-replication-node-$j-$IP_ADDRESS --debug
            else
              pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --socket=/tmp/mysql_sandbox$node_port.sock --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps-group-replication-node-$j-$IP_ADDRESS --debug
            fi
          fi
          node_port=$(($node_port + 1))
          sleep 20
        done
      else
        PS_PORT=43306
        PS_PASSWORD=GRgrO9301RuF
        docker pull percona:${ps_version}
        for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
          check_port $PS_PORT percona
          sudo chmod 777 -R /var/log
          mkdir ps_socket_${PS_PORT}
          sudo chmod 777 -R ps_socket_${PS_PORT}
          ps_service_name=$(prepare_service_name ps_${ps_version}_${IP_ADDRESS}_$j)
          docker run --name $ps_service_name -v /var/log:/var/log -v ${WORKDIR}/ps_socket_${PS_PORT}/:/var/lib/mysql/ -p $PS_PORT:3306 -e MYSQL_ROOT_PASSWORD=${PS_PASSWORD} -e UMASK=0777 -d percona:${ps_version} --character-set-server=utf8 --default-authentication-plugin=mysql_native_password --collation-server=utf8_unicode_ci
          sleep 30
          mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL userstat=1;"
          mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL innodb_monitor_enable=all;"
          mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'GRgrO9301RuF';"
          if [[ "$query_source" != "perfschema" ]]; then
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL slow_query_log='ON';"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL long_query_time=0;"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL log_slow_rate_limit=1;"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL log_slow_admin_statements=ON;"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL log_slow_slave_statements=ON;"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL query_response_time_stats=ON;"
            mysql -h 127.0.0.1 -u root -p${PS_PASSWORD} --port $PS_PORT -e "SET GLOBAL slow_query_log_file='/var/log/ps_${j}_slowlog.log';"
          fi
          if [[ -z $use_socket ]]; then
            if [ $(( ${j} % 2 )) -eq 0 ]; then
              if [[ ! -z $metrics_mode ]]; then
                pmm-admin add mysql --query-source=$query_source --username=root --password=${PS_PASSWORD} --environment=ps-prod --metrics-mode=$metrics_mode --cluster=ps-prod-cluster --replication-set=ps-repl2 $ps_service_name --debug 127.0.0.1:$PS_PORT
              else
                pmm-admin add mysql --query-source=$query_source --username=root --password=${PS_PASSWORD} --environment=ps-prod --cluster=ps-prod-cluster --replication-set=ps-repl2 $ps_service_name --debug 127.0.0.1:$PS_PORT
              fi
            else
              if [[ ! -z $metrics_mode ]]; then
                pmm-admin add mysql --query-source=$query_source --username=root --password=${PS_PASSWORD} --environment=ps-dev --cluster=ps-dev-cluster --metrics-mode=$metrics_mode --replication-set=ps-repl1 $ps_service_name --debug 127.0.0.1:$PS_PORT
              else
                pmm-admin add mysql --query-source=$query_source --username=root --password=${PS_PASSWORD} --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 $ps_service_name --debug 127.0.0.1:$PS_PORT
              fi
            fi
            if [[ ! -z $DISABLE_TABLESTATS ]]; then
              pmm-admin add mysql --query-source=$query_source --username=root --password=${PS_PASSWORD} --environment=ps-prod --disable-tablestats ps_dts_node_$j --debug 127.0.0.1:$PS_PORT
            fi
	          if [[ ! -z $DISABLE_QUERYEXAMPLE ]]; then
              pmm-admin add mysql --query-source=$query_source --username=root --password=${PS_PASSWORD} --environment=ps-prod --disable-queryexamples ps_disabled_queryexample_$j --debug 127.0.0.1:$PS_PORT
            fi
          else
            if [ $(( ${j} % 2 )) -eq 0 ]; then
              if [[ ! -z $metrics_mode ]]; then
                pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=${PS_PASSWORD} --environment=ps-prod --cluster=ps-prod-cluster --metrics-mode=$metrics_mode --replication-set=ps-repl2 $ps_service_name --debug
              else
                pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=${PS_PASSWORD} --environment=ps-prod --cluster=ps-prod-cluster --replication-set=ps-repl2 $ps_service_name --debug
              fi
            else
              if [[ ! -z $metrics_mode ]]; then
                pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=${PS_PASSWORD} --environment=ps-dev --metrics-mode=$metrics_mode --cluster=ps-dev-cluster --replication-set=ps-repl1 $ps_service_name --debug
              else
                pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=${PS_PASSWORD} --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 $ps_service_name --debug
              fi
            fi
            if [[ ! -z $DISABLE_TABLESTATS ]]; then
              pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=${PS_PASSWORD} --environment=ps-prod --disable-tablestats ps_dts_node_$j --debug
            fi
	          if [[ ! -z $DISABLE_QUERYEXAMPLE ]]; then
              pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=${PS_PASSWORD} --environment=ps-prod --disable-queryexamples ps_disabled_queryexample_$j --debug
            fi
          fi
          #run_workload 127.0.0.1 root ps $PS_PORT mysql $ps_service_name
          PS_PORT=$((PS_PORT+j))
        done
      fi
    elif [[ "${CLIENT_NAME}" == "md" && ! -z $PMM2 ]]; then
      MD_PORT=53306
      MD_PASSWORD=GRgrO9301RuF
      docker pull mariadb:${md_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $MD_PORT mariadb
        sudo chmod 777 -R /var/log
        mkdir md_socket_${MD_PORT}
        sudo chmod 777 -R md_socket_${MD_PORT}
        docker run --name md_${md_version}_${IP_ADDRESS}_$j -v /var/log:/var/log -v ${WORKDIR}/md_socket_${MD_PORT}/:/var/run/mysqld/ -p $MD_PORT:3306 -e MYSQL_ROOT_PASSWORD=${MD_PASSWORD} -e UMASK=0777 -d mariadb:${md_version} --performance-schema=1
        sleep 20
        if [[ "$query_source" != "perfschema" ]]; then
          mysql -h 127.0.0.1 -u root -p${MD_PASSWORD} --port $MD_PORT -e "SET GLOBAL slow_query_log='ON';"
          mysql -h 127.0.0.1 -u root -p${MD_PASSWORD} --port $MD_PORT -e "SET GLOBAL long_query_time=0;"
          mysql -h 127.0.0.1 -u root -p${MD_PASSWORD} --port $MD_PORT -e "SET GLOBAL log_slow_rate_limit=1;"
          mysql -h 127.0.0.1 -u root -p${MD_PASSWORD} --port $MD_PORT -e "SET GLOBAL slow_query_log_file='/var/log/md_${j}_slowlog.log';"
        else
          mysql -h 127.0.0.1 -u root -p${MD_PASSWORD} --port $MD_PORT -e "UPDATE performance_schema.setup_instruments SET ENABLED = 'YES', TIMED = 'YES' WHERE NAME LIKE 'statement/%';"
          mysql -h 127.0.0.1 -u root -p${MD_PASSWORD} --port $MD_PORT -e "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME LIKE '%statements%';"
        fi
        if [[ -z $use_socket ]]; then
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --environment=md-prod --cluster=md-prod-cluster --metrics-mode=$metrics_mode --replication-set=md-repl2 md_${md_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$MD_PORT
            else
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --environment=md-prod --cluster=md-prod-cluster --replication-set=md-repl2 md_${md_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$MD_PORT
            fi
          else
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --environment=md-dev --cluster=md-dev-cluster --metrics-mode=$metrics_mode --replication-set=md-repl1 md_${md_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$MD_PORT
            else
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --environment=md-dev --cluster=md-dev-cluster --replication-set=md-repl1 md_${md_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$MD_PORT
            fi
          fi
        else
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --socket=${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock --environment=md-prod --cluster=md-prod-cluster --metrics-mode=$metrics_mode --replication-set=md-repl2 md_${md_version}_${IP_ADDRESS}_$j --debug
            else
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --socket=${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock --environment=md-prod --cluster=md-prod-cluster --replication-set=md-repl2 md_${md_version}_${IP_ADDRESS}_$j --debug
            fi
          else
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --socket=${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock --environment=md-dev --cluster=md-dev-cluster --metrics-mode=$metrics_mode --replication-set=md-repl1 md_${md_version}_${IP_ADDRESS}_$j --debug
            else
              pmm-admin add mysql --query-source=$query_source --username=root --password=${MD_PASSWORD} --socket=${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock --environment=md-dev --cluster=md-dev-cluster --replication-set=md-repl1 md_${md_version}_${IP_ADDRESS}_$j --debug
            fi
          fi
        fi
        #run_workload 127.0.0.1 root md $MD_PORT mysql md_${md_version}_${IP_ADDRESS}_$j
        MD_PORT=$((MD_PORT+j))
      done
    elif [[ "${CLIENT_NAME}" == "modb" && ! -z $PMM2 ]]; then
      MODB_PORT=27017
      MODB_PASSWORD=GRgrO9301RuF
      docker pull mongo:${modb_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $MODB_PORT mongodb
        MODB_PORT=$((MODB_PORT+2))
        mkdir -p /tmp/modb_${MODB_PORT}
        chown -R $USER:$USER /tmp/ > /dev/null 2>&1
        chmod -R go+w /tmp/ > /dev/null 2>&1
        modb_service_name=$(prepare_service_name mongodb_node_$j)
        docker run -d -p $MODB_PORT:27017 -v /tmp/modb_${MODB_PORT}/:/tmp/ -e MONGO_INITDB_ROOT_USERNAME=mongoadmin -e MONGO_INITDB_ROOT_PASSWORD=${MODB_PASSWORD} -e UMASK=0777 --name $modb_service_name mongo:${modb_version}
        sleep 20
        if [ "${modb_version}" -gt "5" ]; then
          docker exec $modb_service_name mongosh -u mongoadmin -p ${MODB_PASSWORD} --eval 'db.setProfilingLevel(2)'
          docker cp $SCRIPT_PWD/mongodb_user_setup.js $modb_service_name:/
          docker exec $modb_service_name mongosh -u mongoadmin -p ${MODB_PASSWORD} mongodb_user_setup.js
        else
          docker exec $modb_service_name mongo -u mongoadmin -p ${MODB_PASSWORD} --eval 'db.setProfilingLevel(2)'
          docker cp $SCRIPT_PWD/mongodb_user_setup.js $modb_service_name:/
          docker exec $modb_service_name mongo -u mongoadmin -p ${MODB_PASSWORD} mongodb_user_setup.js
        fi
        if [[ -z $use_socket ]]; then
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --metrics-mode=$metrics_mode --environment=modb-prod $modb_service_name --debug localhost:$MODB_PORT
            else
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --environment=modb-prod $modb_service_name --debug localhost:$MODB_PORT
            fi
          else
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --metrics-mode=$metrics_mode --environment=modb-dev $modb_service_name --debug localhost:$MODB_PORT
            else
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --environment=modb-dev $modb_service_name --debug localhost:$MODB_PORT
            fi
          fi
        else
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --metrics-mode=$metrics_mode --environment=modb-prod $modb_service_name --socket=/tmp/modb_${MODB_PORT}/mongodb-27017.sock --debug
            else
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --environment=modb-prod $modb_service_name --socket=/tmp/modb_${MODB_PORT}/mongodb-27017.sock --debug
            fi
          else
            if [[ ! -z $metrics_mode ]]; then
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --environment=modb-dev $modb_service_name --metrics-mode=$metrics_mode --socket=/tmp/modb_${MODB_PORT}/mongodb-27017.sock --debug
            else
              pmm-admin add mongodb --cluster $modb_service_name --username=pmm_mongodb --password=${MODB_PASSWORD} --environment=modb-dev $modb_service_name --socket=/tmp/modb_${MODB_PORT}/mongodb-27017.sock --debug
            fi
          fi
        fi
        MODB_PORT=$((MODB_PORT+j+3))
      done
    elif [[ "${CLIENT_NAME}" == "mo" && ! -z $PMM2  && -z $MONGOMAGIC ]]; then
      echo "Will execute a mongodb container method"
    elif [[ "${CLIENT_NAME}" == "pxc" && ! -z $PMM2 ]]; then
      echo "Executing PXC Setup playbook"
      setup_pxc_client_container
    else
      if [ -r ${BASEDIR}/lib/mysql/plugin/ha_tokudb.so ]; then
        TOKUDB_STARTUP="--plugin-load-add=tokudb=ha_tokudb.so --tokudb-check-jemalloc=0"
      else
        TOKUDB_STARTUP=""
      fi
      if [ -r ${BASEDIR}/lib/mysql/plugin/ha_rocksdb.so ]; then
        ROCKSDB_STARTUP="--plugin-load-add=rocksdb=ha_rocksdb.so"
      else
        ROCKSDB_STARTUP=""
      fi
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        RBASE1="$(( RBASE + ( $PORT_CHECK * $j ) ))"
        LADDR1="$ADDR:$(( RBASE1 + 8 ))"
        node="${BASEDIR}/node$j"
        if ${BASEDIR}/bin/mysqladmin -uroot -S/tmp/${NODE_NAME}_${j}.sock ping > /dev/null 2>&1; then
          echo "WARNING! Another mysqld process using /tmp/${NODE_NAME}_${j}.sock"
          if ! sudo pmm-admin list | grep "/tmp/${NODE_NAME}_${j}.sock" > /dev/null ; then
            if [ $disable_ssl -eq 1 ]; then
              sudo pmm-admin add mysql ${NODE_NAME}-${j} --socket=/tmp/${NODE_NAME}_${j}.sock --user=root --query-source=$query_source --disable-ssl
              check_disable_ssl ${NODE_NAME}-${j}
            else
              sudo pmm-admin add mysql ${NODE_NAME}-${j} --socket=/tmp/${NODE_NAME}_${j}.sock --user=root --query-source=$query_source
            fi
          fi
          continue
        fi
        VERSION="$(${BASEDIR}/bin/mysqld --version | grep -oe '[58]\.[5670]' | head -n1)"
        if [ "$VERSION" == "5.7" -o "$VERSION" == "8.0" ]; then
          mkdir -p $node
          ${MID} --datadir=$node  > ${BASEDIR}/startup_node$j.err 2>&1
        else
          if [ ! -d $node ]; then
            ${MID} --datadir=$node  > ${BASEDIR}/startup_node$j.err 2>&1
          fi
        fi
        if  [[ "${CLIENT_NAME}" == "pxc" ]]; then
          WSREP_CLUSTER="${WSREP_CLUSTER}gcomm://$LADDR1,"
          if [ $j -eq 1 ]; then
            WSREP_CLUSTER_ADD="--wsrep_cluster_address=gcomm:// "
          else
            WSREP_CLUSTER_ADD="--wsrep_cluster_address=$WSREP_CLUSTER"
          fi
          MYEXTRA="--no-defaults --wsrep-provider=${BASEDIR}/lib/libgalera_smm.so $WSREP_CLUSTER_ADD --wsrep_provider_options=gmcast.listen_addr=tcp://$LADDR1 --wsrep_sst_method=rsync --wsrep_sst_auth=root: --max-connections=30000"
        else
          MYEXTRA="--no-defaults --max-connections=30000"
        fi
        if [[ "${CLIENT_NAME}" == "md" ]]; then
          MYEXTRA+=" --gtid-strict-mode=ON "
        else
          MYEXTRA+=" --gtid-mode=ON --enforce-gtid-consistency "
        fi
        ${BASEDIR}/bin/mysqld $MYEXTRA $MYSQL_CONFIG $TOKUDB_STARTUP $ROCKSDB_STARTUP $mysqld_startup_options --basedir=${BASEDIR} \
          --datadir=$node --log-error=$node/error.err --log-bin=mysql-bin \
          --socket=/tmp/${NODE_NAME}_${j}.sock --port=$RBASE1 --log-slave-updates \
          --server-id=10${j} > $node/error.err 2>&1 &
        function startup_chk(){
          for X in $(seq 0 ${SERVER_START_TIMEOUT}); do
            sleep 1
            if ${BASEDIR}/bin/mysqladmin -uroot -S/tmp/${NODE_NAME}_${j}.sock ping > /dev/null 2>&1; then
              ${BASEDIR}/bin/mysql  -uroot -S/tmp/${NODE_NAME}_${j}.sock -e "SET GLOBAL query_response_time_stats=ON;" > /dev/null 2>&1
              check_user=`${BASEDIR}/bin/mysql  -uroot -S/tmp/${NODE_NAME}_${j}.sock -e "SELECT user,host FROM mysql.user where user='$OUSER' and host='%';"`
              if [[ -z "$check_user" ]]; then
                ${BASEDIR}/bin/mysql  -uroot -S/tmp/${NODE_NAME}_${j}.sock -e "CREATE USER '$OUSER'@'%' IDENTIFIED BY '$OPASS';GRANT SUPER, PROCESS, REPLICATION SLAVE, RELOAD ON *.* TO '$OUSER'@'%'"
                (
                printf "%s\t%s\n" "Orchestrator username :" "admin"
                printf "%s\t%s\n" "Orchestrator password :" "passw0rd"
                ) | column -t -s $'\t'
              else
                echo "User '$OUSER' is already present in MySQL server. Please create Orchestrator user manually."
              fi
              break
            fi
          done
        }
        startup_chk
        if ! ${BASEDIR}/bin/mysqladmin -uroot -S/tmp/${NODE_NAME}_${j}.sock ping > /dev/null 2>&1; then
          if grep -q "TCP/IP port: Address already in use" $node/error.err; then
            echo "TCP/IP port: Address already in use, restarting ${NODE_NAME}_${j} mysqld daemon with different port"
            RBASE1="$(( RBASE1 - 1 ))"
            ${BASEDIR}/bin/mysqld $MYEXTRA $MYSQL_CONFIG $TOKUDB_STARTUP $ROCKSDB_STARTUP $mysqld_startup_options --basedir=${BASEDIR} \
               --datadir=$node --log-error=$node/error.err --log-bin=mysql-bin \
               --socket=/tmp/${NODE_NAME}_${j}.sock --port=$RBASE1 --log-slave-updates \
               --server-id=10${j} > $node/error.err 2>&1 &
            startup_chk
            if ! ${BASEDIR}/bin/mysqladmin -uroot -S/tmp/${NODE_NAME}_${j}.sock ping > /dev/null 2>&1; then
              echo "ERROR! ${NODE_NAME} startup failed. Please check error log $node/error.err"
              exit 1
            fi
          else
            echo "ERROR! ${NODE_NAME} startup failed. Please check error log $node/error.err"
            exit 1
          fi
        fi
        if [ $disable_ssl -eq 1 ]; then
          sudo pmm-admin add mysql ${NODE_NAME}-${j} --socket=/tmp/${NODE_NAME}_${j}.sock --user=root --query-source=$query_source --disable-ssl
          check_disable_ssl ${NODE_NAME}-${j}
        else
          sudo pmm-admin add mysql ${NODE_NAME}-${j} --socket=/tmp/${NODE_NAME}_${j}.sock --user=root --query-source=$query_source
        fi
      done
      pxc_proxysql_setup(){
        if  [[ "${CLIENT_NAME}" == "pxc" ]]; then
          if [[ ! -e $(which proxysql 2> /dev/null) ]] ;then
            echo "The program 'proxysql' is currently not installed. Installing proxysql from percona repository"
            if grep -iq "ubuntu"  /etc/os-release ; then
              sudo apt install -y proxysql
            fi
            if grep -iq "centos"  /etc/os-release ; then
              sudo yum install -y proxysql
            fi
            if grep -iq "rhel"  /etc/os-release ; then
              sudo yum install -y proxysql
            fi
            if [[ ! -e $(which proxysql 2> /dev/null) ]] ;then
              echo "ERROR! Could not install proxysql on CentOS/Ubuntu machine. Terminating"
              exit 1
            fi
          fi
          sleep 5
          sudo service proxysql start
          PXC_SOCKET=$(sudo pmm-admin list | grep "mysql:metrics[ \t]*PXC_NODE-1" | awk -F[\(\)] '{print $2}')
          PXC_BASE_PORT=$(${BASEDIR}/bin/mysql -uroot --socket=$PXC_SOCKET -Bse"select @@port")
          ${BASEDIR}/bin/mysql -uroot --socket=$PXC_SOCKET -e"grant all on *.* to admin@'%' identified by 'admin'"
          sudo sed -i "s/3306/${PXC_BASE_PORT}/" /etc/proxysql-admin.cnf
          sudo proxysql-admin -e > $WORKDIR/logs/proxysql-admin.log
          if [ $disable_ssl -eq 1 ]; then
            sudo pmm-admin add proxysql:metrics --disable-ssl
          else
            sudo pmm-admin add proxysql:metrics
          fi
        else
          echo "Could not find PXC nodes. Skipping proxysql setup"
        fi
      }
    fi
  done
  if [ ! -z $compare_query_count ]; then
    compare_query
  fi
}

check_port (){
  PORT=$1
  DB=$2
  if [[ $(sudo docker ps | grep $DB | grep 0.0.0.0:$PORT) ]] || [[ $(lsof -i -P -n | grep LISTEN | grep $PORT) ]]; then
    if [[ $DB == "PDPGSQL" ]]; then
      PDPGSQL_PORT=$((PDPGSQL_PORT+j))
      check_port $PDPGSQL_PORT PDPGSQL
    fi
    if [[ $DB == "postgres" ]]; then
      PGSQL_PORT=$((PGSQL_PORT+j))
      check_port $PGSQL_PORT postgres
    fi
    if [[ $DB == "percona" ]]; then
      PS_PORT=$((PS_PORT+j))
      check_port $PS_PORT percona
    fi
    if [[ $DB == "mongodb" ]]; then
      MODB_PORT=$((MODB_PORT+3+j))
      check_port $MODB_PORT mongodb
    fi
    if [[ $DB == "mariadb" ]]; then
      MD_PORT=$((MD_PORT+3+j))
      check_port $MD_PORT mariadb
    fi
  fi
}

clean_clients(){
  if [[ ! -e $(which mysqladmin 2> /dev/null) ]] ;then
    MYSQLADMIN_CLIENT=$(find . -name mysqladmin | head -n1)
  else
    MYSQLADMIN_CLIENT=$(which mysqladmin)
  fi
  if [[ -z "$MYSQLADMIN_CLIENT" ]];then
   echo "ERROR! 'mysqladmin' is currently not installed. Please install mysqladmin. Terminating."
   exit 1
  fi
  #Shutdown all mysql client instances
  if [[ -z $PMM2 ]]; then
    for i in $(sudo pmm-admin list | grep "mysql:metrics[ \t].*_NODE-" | awk -F[\(\)] '{print $2}'  | sort -r) ; do
      echo -e "Shutting down mysql instance (--socket=${i})"
      ${MYSQLADMIN_CLIENT} -uroot --socket=${i} shutdown
     sleep 2
    done
    if sudo pmm-admin list | grep -q 'No services under monitoring' ; then
      echo -e "No services under pmm monitoring"
    else
    #Remove all client instances
      echo -e "Removing all local pmm client instances"
      sudo pmm-admin remove --all 2&>/dev/null
    fi
 else
    for i in $(pmm-admin list | grep -E "MySQL" | awk -F " " '{print $2}'  | sort -r) ; do
      pmm-admin remove mysql $i

    done
    for i in $(pmm-admin list | grep -E "MongoDB" | awk -F " " '{print $2}'  | sort -r) ; do
      pmm-admin remove mongodb $i
    done

    for i in $(pmm-admin list | grep -E "PostgreSQL" | awk -F " " '{print $2}'  | sort -r) ; do
      pmm-admin remove postgresql $i
    done

    for i in $(pmm-admin list | grep -E "ProxySQL" | awk -F " " '{print $2}'  | sort -r) ; do
      pmm-admin remove proxysql $i
    done

    #Remove PS and PostgreSQL  docker containers
    for i in $(docker ps -f name=ps -f name=PGS -f name=mongo -q) ; do
      docker rm -f $i
    done
    dbdeployer delete all --skip-confirm
 fi
   #Kill mongodb processes
    sudo killall mongod 2> /dev/null
    sudo killall mongos 2> /dev/null
    sleep 5
}

clean_docker_clients(){
  #Remove docker pmm-clients
  BASE_DIR=$(basename "$PWD")
  BASE_DIR=${BASE_DIR//[^[:alnum:]]/}
  echo -e "Removing pmm-client instances from docker containers"
  sudo docker exec -it ${BASE_DIR}_centos_ps_1  pmm-admin remove --all 2&> /dev/null
  sudo docker exec -it ${BASE_DIR}_ubuntu_ps_1  pmm-admin remove --all  2&> /dev/null
  echo -e "Removing pmm-client docker containers"
  sudo docker stop ${BASE_DIR}_ubuntu_ps_1 ${BASE_DIR}_centos_ps_1  2&> /dev/null
  sudo docker rm ${BASE_DIR}_ubuntu_ps_1 ${BASE_DIR}_centos_ps_1  2&> /dev/null
}

clean_server(){
  #Stop/Remove pmm-server docker/ami/ova instances
  if [[ "$pmm_server" == "docker" ]] ; then
    echo -e "Removing pmm-server docker containers"
    sudo docker stop pmm-server  2&> /dev/null
    sudo docker rm pmm-server pmm-data  2&> /dev/null
  elif [[ "$pmm_server" == "ova" ]] ; then
	VMBOX=$(vboxmanage list runningvms | grep "PMM-Server" | awk -F[\"\"] '{print $2}')
	echo "Shutting down ova instance"
	VBoxManage controlvm $VMBOX poweroff
	echo "Unregistering ova instance"
	VBoxManage unregistervm $VMBOX --delete
	 VM_DISKS=($(vboxmanage list hdds | grep -B4 $VMBOX | grep UUID | grep -v 'Parent UUID:' | awk '{ print $2}'))
	for i in ${VM_DISKS[@]}; do
	  VBoxManage closemedium disk $i --delete ;
	done
  elif [[ "$pmm_server" == "ami" ]] ; then
    if [ -f $WORKDIR/aws_instance_config.txt ]; then
      INSTANCE_ID=$(cat $WORKDIR/aws_instance_config.txt | grep "InstanceId"  | awk -F[\"\"] '{print $4}')
	else
	  echo "ERROR! Could not read aws instance id. $WORKDIR/aws_instance_config.txt does not exist. Terminating"
	  exit 1
	fi
    aws ec2 terminate-instances --instance-ids $INSTANCE_ID > $WORKDIR/aws_remove_instance.log
  fi

}

upgrade_server(){
  #Stop/Remove pmm-server
  if [[ "$pmm_server" == "docker" ]] ; then
    SERVER_USER=$(sudo pmm-admin show-passwords| grep 'User'|awk '{print $3}')
    SERVER_PASSWORD=$(sudo pmm-admin show-passwords| grep 'Password'|awk '{print $3}')
    IS_SSL=$(sudo pmm-admin info |grep 'SSL')
    echo -e "Removing pmm-server docker containers"
    sudo docker stop pmm-server  2&> /dev/null
    sudo docker rm pmm-server 2&> /dev/null
    if [ -z $dev ]; then
      if [ "$IS_SSL" == "Yes" ];then
        sudo docker run -d -p $PMM_PORT:443 -p 8500:8500 -e METRICS_MEMORY=$MEMORY  -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always percona/pmm-server:$PMM_VERSION 2>/dev/null
      else
        sudo docker run -d -p $PMM_PORT:80 -p 8500:8500 -e METRICS_MEMORY=$MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always percona/pmm-server:$PMM_VERSION 2>/dev/null
      fi
    else
      if [ "$IS_SSL" == "Yes" ];then
        sudo docker run -d -p $PMM_PORT:443 -p 8500:8500 -e METRICS_MEMORY=$MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always perconalab/pmm-server:$PMM_VERSION 2>/dev/null
      else
        sudo docker run -d -p $PMM_PORT:80 -p 8500:8500 -e METRICS_MEMORY=$MEMORY -e SERVER_USER="$pmm_server_username" -e SERVER_PASSWORD="$pmm_server_password" -e ORCHESTRATOR_USER=$OUSER -e ORCHESTRATOR_PASSWORD=$OPASS --volumes-from pmm-data --name pmm-server --restart always perconalab/pmm-server:$PMM_VERSION 2>/dev/null
      fi
    fi

  else
    echo "AMI/OVA images upgrade is not implemented yet"
    exit 1
  fi

}

upgrade_client(){
  #Install new pmm-client
  echo "Installing new pmm-client tarball from TESTING directory..."
  PMM_CLIENT_TARBALL_URL=$(lynx --listonly --dump https://www.percona.com/downloads/TESTING/pmm/ | grep  "pmm-client" |awk '{print $2}'| grep "tar.gz" | head -n1)
  echo "PMM client tarball $PMM_CLIENT_TARBALL_URL"
  wget $PMM_CLIENT_TARBALL_URL
  PMM_CLIENT_TAR=$(echo $PMM_CLIENT_TARBALL_URL | grep -o '[^/]*$')
  tar -xzf $PMM_CLIENT_TAR
  PMM_CLIENT_BASEDIR=$(ls -1td pmm-client-* 2>/dev/null | grep -v ".tar" | head -n1)
  pushd $PMM_CLIENT_BASEDIR > /dev/null
  sudo ./install
  popd > /dev/null
  if [[ $(sudo pmm-admin list |grep metrics) ]]; then
    echo "Upgrade client has been finished successfully"
  else
    echo "There is no any instances, please check pmm-admin list output"
  fi
}

wipe_pmm2_clients () {

  if [[ $(pmm-admin list | grep "MySQL" | awk -F" " '{print $2}') ]]; then
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $2}') ; do
        echo "$i"
        MYSQL_SERVICE_ID=${i}
        pmm-admin remove mysql ${MYSQL_SERVICE_ID}
        docker stop ${MYSQL_SERVICE_ID} && docker rm ${MYSQL_SERVICE_ID}
        dbdeployer delete all --skip-confirm
    done
  fi
  if [[ $(pmm-admin list | grep "HAProxy" | awk -F" " '{print $2}') ]]; then
    IFS=$'\n'
    for i in $(pmm-admin list | grep "HAProxy" | awk -F" " '{print $2}') ; do
        echo "$i"
        HAPROXY_SERVICE_NAME=${i}
        pmm-admin remove haproxy ${HAPROXY_SERVICE_NAME}
    done
  fi
  if [[ $(pmm-admin list | grep "PostgreSQL" | awk -F" " '{print $2}') ]]; then
    IFS=$'\n'
    for i in $(pmm-admin list | grep "PostgreSQL" | awk -F" " '{print $2}') ; do
        echo "$i"
        PGSQL_SERVICE_ID=${i}
        pmm-admin remove postgresql ${PGSQL_SERVICE_ID}
        docker stop ${PGSQL_SERVICE_ID} && docker rm ${PGSQL_SERVICE_ID}
    done
  fi
  if [[ $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $2}') ]]; then
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $2}') ; do
        echo "$i"
        MONGODB_SERVICE_ID=${i}
        pmm-admin remove mongodb ${MONGODB_SERVICE_ID}
        docker stop ${MONGODB_SERVICE_ID} && docker rm ${MONGODB_SERVICE_ID}
    done
  fi
  docker image prune -af
  docker container prune -f
  docker volume prune -f
}

cleanup_services() {
  export SERVICE_TYPE=$(pmm-admin list | grep ${cleanup_service_name} | awk -F" " '{print $1}' | awk '{print tolower($0)}')
  pmm-admin remove ${SERVICE_TYPE} ${cleanup_service_name}
  docker stop ${cleanup_service_name} && docker rm ${cleanup_service_name}
  docker container prune -f
  docker image prune -af
  docker volume prune -f
}

sysbench_prepare(){
  port=$1
  DB_NAME=$2
  user=$3
  if [[ "$user" -eq "msandbox" ]]; then
    pass=$user
  fi
  if [[ ! -e $(which mysql 2> /dev/null) ]] ;then
    MYSQL_CLIENT=$(find . -type f -name mysql | head -n1)
  else
    MYSQL_CLIENT=$(which mysql)
  fi
  if [[ -z "$MYSQL_CLIENT" ]];then
   echo "ERROR! 'mysql' is currently not installed. Please install mysql. Terminating."
   exit 1
  fi
  #Initiate sysbench data load on mysql client instances
  if [ -z "$port" ]; then
  for i in $(sudo pmm-admin list | grep "mysql:metrics[ \t].*_NODE-" | awk -F[\(\)] '{print $2}'  | sort -r) ; do
    DB_NAME=$(echo ${i}  | awk -F[\/\.] '{print $3}')
	DB_NAME="${DB_NAME}_${storage_engine}"
    $MYSQL_CLIENT --user=root --socket=${i} -e "drop database if exists ${DB_NAME};create database ${DB_NAME};"
    sysbench /usr/share/sysbench/oltp_insert.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=root --mysql-storage-engine=$storage_engine  --threads=16 --db-driver=mysql --mysql-socket=${i} prepare  > $WORKDIR/logs/sysbench_prepare_${DB_NAME}.txt 2>&1
    check_script $? "Failed to run sysbench dataload"
  done
  elif [[ ! -z "$user" && ! -z "$DB_NAME" ]]; then
    sysbench /usr/share/sysbench/oltp_insert.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=${user} --mysql-password=${pass} --mysql-storage-engine=$storage_engine --threads=16 --db-driver=mysql --mysql-host=127.0.0.1 --mysql-port=${port} prepare  > $WORKDIR/logs/sysbench_prepare_${DB_NAME}.txt 2>&1
    check_script $? "Failed to run sysbench dataload"
  fi
}

load_instances() {
  export WORKDIR=$PWD
  mkdir $WORKDIR/logs/
  if [[ ! -e $(which mysql 2> /dev/null) ]] ;then
    MYSQL_CLIENT=$(find . -type f -name mysql | head -n1)
  else
    MYSQL_CLIENT=$(which mysql)
  fi
  if [[ -z "$MYSQL_CLIENT" ]];then
   echo "ERROR! 'mysql' is currently not installed. Please install mysql. Terminating."
   exit 1
  fi
  if [[ $(pmm-admin list | grep "MySQL" | grep "ps" | awk -F" " '{print $2}') ]]; then
    #Initiate sysbench data load on all mysql client instances
    for i in $(pmm-admin list | grep "MySQL" | grep "ps" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
      DB_NAME="sbtest_ps_${i}"
      touch $WORKDIR/logs/sysbench_prepare_ps_${i}.txt
      $MYSQL_CLIENT --user=root --port=${i} -p${PS_PASSWORD} -h 127.0.0.1 -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'ps';"
      $MYSQL_CLIENT --user=root --port=${i} -p${PS_PASSWORD} -h 127.0.0.1 -e "drop database if exists ${DB_NAME};create database ${DB_NAME};"
      sysbench /usr/share/sysbench/oltp_insert.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=root --mysql-password=${PS_PASSWORD} --mysql-host=127.0.0.1 --mysql-port=${i} --mysql-storage-engine=$storage_engine  --threads=16 --db-driver=mysql prepare  > $WORKDIR/logs/sysbench_prepare_ps_${i}.txt 2>&1
      check_script $? "Failed to run sysbench dataload"
    done

    for i in $(pmm-admin list | grep "MySQL" | grep "ps" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
      DB_NAME="sbtest_ps_${i}"
      touch $WORKDIR/logs/sysbench_run_ps_${i}.txt
      sysbench /usr/share/sysbench/oltp_read_write.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=root --mysql-password=${PS_PASSWORD} --mysql-host=127.0.0.1 --mysql-port=${i} --mysql-storage-engine=$storage_engine --threads=16 --time=3600 --events=1870000000 --db-driver=mysql --db-ps-mode=disable run  > $WORKDIR/logs/sysbench_run_ps_${i}.txt 2>&1 &
      check_script $? "Failed to run sysbench oltp"
    done
  fi

  if [[ $(pmm-admin list | grep "MySQL" | grep "mysql" | awk -F" " '{print $2}') ]]; then
    #Initiate sysbench data load on all mysql client instances
    for i in $(pmm-admin list | grep "MySQL" | grep "mysql" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
      DB_NAME="sbtest_mysql_${i}"
      touch $WORKDIR/logs/sysbench_prepare_mysql_${i}.txt
      $MYSQL_CLIENT --user=msandbox --port=${i} -pmsandbox -h 127.0.0.1 -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
      $MYSQL_CLIENT --user=msandbox --port=${i} -pmsandbox -h 127.0.0.1 -e "drop database if exists ${DB_NAME};create database ${DB_NAME};"
      check_script $? "Failed to run sysbench dataload"
    done

    for i in $(pmm-admin list | grep "MySQL" | grep "mysql" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
      DB_NAME="sbtest_mysql_${i}"
      touch $WORKDIR/logs/sysbench_run_mysql_${i}.txt
      sysbench /usr/share/sysbench/oltp_read_write.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=msandbox --mysql-password=msandbox --mysql-host=127.0.0.1 --mysql-port=${i} --mysql-storage-engine=$storage_engine --threads=16 --time=3600 --events=1870000000 --db-driver=mysql --db-ps-mode=disable run  > $WORKDIR/logs/sysbench_run_mysql_${i}.txt 2>&1 &
      check_script $? "Failed to run sysbench oltp"
    done
  fi
}

sysbench_run(){
  port=$1
  DB_NAME=$2
  user=$3
  if [[ "$user" -eq "msandbox" ]]; then
    pass=$user
  fi
  #Initiate sysbench oltp run on all mysql client instances
  if [[ -z $port ]]; then
  for i in $(sudo pmm-admin list | grep "mysql:metrics[ \t].*_NODE-" | awk -F[\(\)] '{print $2}'  | sort -r) ; do
    DB_NAME=$(echo ${i}  | awk -F[\/\.] '{print $3}')
	   DB_NAME="${DB_NAME}_${storage_engine}"
    sysbench /usr/share/sysbench/oltp_read_write.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=root  --mysql-storage-engine=$storage_engine --threads=16 --time=3600 --events=1870000000 --db-driver=mysql --db-ps-mode=disable --mysql-socket=${i} run  > $WORKDIR/logs/sysbench_run_${DB_NAME}.txt 2>&1 &
    check_script $? "Failed to run sysbench oltp"
  done
  elif [[ ! -z "$user" && ! -z "$DB_NAME" ]]; then
    sysbench /usr/share/sysbench/oltp_read_write.lua --table-size=10000 --tables=16 --mysql-db=${DB_NAME} --mysql-user=${user} --mysql-password=${pass} --mysql-storage-engine=$storage_engine --threads=16 --time=3600 --events=1870000000 --db-driver=mysql --db-ps-mode=disable --mysql-host=127.0.0.1 --mysql-port=${port} run  > $WORKDIR/logs/sysbench_run_${DB_NAME}.txt 2>&1 &
    check_script $? "Failed to run sysbench oltp"
  fi
}

check_dbdeployer(){
  if ! dbdeployer --version | grep 'dbdeployer version 1.' > /dev/null ; then
      echo "ERROR! dbdeployer not installed attempting to install"
      install_dbdeployer
  fi
}

install_dbdeployer(){
  wget https://github.com/datacharmer/dbdeployer/releases/download/v1.62.0/dbdeployer-1.62.0.linux.tar.gz
  tar -xzf dbdeployer-1.62.0.linux.tar.gz
  chmod +x dbdeployer-1.62.0.linux
  sudo mv dbdeployer-1.62.0.linux /usr/local/bin/dbdeployer
}

setup_alertmanager() {
  docker pull prom/alertmanager
  docker run -d -p 9093:9093 --name alert-manager prom/alertmanager:latest
  sleep 20
  export SERVER_CONTAINER_NAME=$(docker ps | grep pmm-server | awk '{print $NF}')
}

run_workload() {
  touch docker-build.log
  docker build --tag php-db $SCRIPT_PWD/ > docker-build.log 2>&1
  IFS=$'\n'
  if [[ $(pmm-admin list | grep "MySQL" | awk -F" " '{print $2}') ]]; then
    for i in $(pmm-admin list | grep "MySQL" | grep "ps" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
        echo "$i"
        export MYSQL_PORT=${i}
        export MYSQL_HOST=127.0.0.1
        export MYSQL_password=${PS_PASSWORD}
        export MYSQL_USER=root
        export MYSQL_DATABASE=mysql
        export TEST_TARGET_QPS=1000
        export TEST_QUERIES=100
        touch ps_$i.log
        sleep 5
        php $SCRIPT_PWD/schema_table_query.php > ps_${i}.log 2>&1 &
        PHP_PID=$!
        echo $PHP_PID
        jobs -l
        echo "Load Triggered check log"
    done
    for i in $(pmm-admin list | grep "MySQL" | grep "pxc" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
        echo "$i"
        export MYSQL_PORT=${i}
        export MYSQL_HOST=127.0.0.1
        export MYSQL_PASSWORD=test
        export MYSQL_USER=sysbench
        export MYSQL_DATABASE=mysql
        export TEST_TARGET_QPS=1000
        export TEST_QUERIES=100
        touch pxc_${i}.log
        sleep 5
        php $SCRIPT_PWD/schema_table_query.php > pxc_${i}.log 2>&1 &
        PHP_PID=$!
        echo $PHP_PID
        jobs -l
        echo "Load Triggered check log"
    done
    for i in $(pmm-admin list | grep "MySQL" | grep "md" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
        echo "$i"
        export MYSQL_PORT=${i}
        export MYSQL_HOST=127.0.0.1
        export MYSQL_PASSWORD=${MD_PASSWORD}
        export MYSQL_USER=root
        export MYSQL_DATABASE=mysql
        export TEST_TARGET_QPS=1000
        export TEST_QUERIES=100
        touch md_${i}.log
        sleep 5
        php $SCRIPT_PWD/schema_table_query.php > md_${i}.log 2>&1 &
        PHP_PID=$!
        echo $PHP_PID
        jobs -l
        echo "Load Triggered check log"
    done
  fi
  if [[ $(pmm-admin list | grep "PostgreSQL" | awk -F" " '{print $2}') ]]; then
    for i in $(pmm-admin list | grep "PostgreSQL" | grep "PGSQL" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
        echo "$i"
        export PGSQL_PORT=${i}
        export PGSQL_HOST=localhost
        export PGSQL_USER=postgres
        export TEST_TARGET_QPS=100
        export TEST_QUERIES=1000
        touch pgsql_$i.log
        docker run --rm --name pgsql_php_$i -d -e PGSQL_PORT=${PGSQL_PORT} -e TEST_TARGET_QPS=${TEST_TARGET_QPS} -e TEST_QUERIES=${TEST_QUERIES} -d --network=host -v $SCRIPT_PWD:/usr/src/myapp -w /usr/src/myapp php-db php pgsql_schema_table_query.php
        sleep 5
        docker logs pgsql_php_$i
        echo "Load Triggered check log"
    done
  fi
  if [[ $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $2}') ]]; then
    for i in $(pmm-admin list | grep "MongoDB" | grep "mongodb_rs" | awk -F" " '{print $3}' | awk -F":" '{print $2}') ; do
        echo "$i"
        export MONGODB_PORT=${i}
        export TEST_TARGET_QPS=5
        export TEST_COLLECTION=5
        export TEST_DB=5
        touch mongodb_$i.log
        docker run --rm --name mongodb_$i --network=host -v $SCRIPT_PWD:/usr/src/myapp -w /usr/src/myapp php-db composer require mongodb/mongodb
        docker run --rm --name mongodb_$i -d -e MONGODB_PORT=${MONGODB_PORT} -e TEST_TARGET_QPS=${TEST_TARGET_QPS} -e TEST_COLLECTION=${TEST_COLLECTION} -e TEST_DB=${TEST_DB} --network=host -v $SCRIPT_PWD:/usr/src/myapp -w /usr/src/myapp php-db php mongodb_query.php
        sleep 5
        echo "Load Triggered check Docker logs, load should run only for Primary Nodes"
    done
  fi
}

setup_replication_ps_pmm2 () {
  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "$ADMIN_PASSWORD" ]
  then
     export ADMIN_PASSWORD="admin"
  fi
  echo "Waiting for PMM Server to start..."
  sleep 20

  sudo bash ./pmm2-client-setup.sh --pmm_server_ip $PMM_SERVER_IP --client_version $CLIENT_VERSION --admin_password $ADMIN_PASSWORD --use_metrics_mode no

  check_dbdeployer
  setup_db_tar ps "Percona-Server-${ps_version}*" "Percona Server binary tar ball" ${ps_version}
  if [ -d "$WORKDIR/ps" ]; then
    rm -Rf $WORKDIR/ps;
  fi
  mkdir $WORKDIR/ps
  dbdeployer unpack Percona-Server-${ps_version}* --sandbox-binary $WORKDIR/ps --overwrite
  rm -Rf Percona-Server-${ps_version}*
  if [[ ! -z $group ]]; then
    dbdeployer deploy $replication_param replication --topology=group $VERSION_ACCURATE --single-primary --sandbox-binary $WORKDIR/ps --force
    node_port=`dbdeployer sandboxes --header | grep $VERSION_ACCURATE |  grep 'group-single-primary' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
  else
    dbdeployer deploy $replication_param replication $VERSION_ACCURATE  --sandbox-binary $WORKDIR/ps --force
    node_port=`dbdeployer sandboxes --header | grep $VERSION_ACCURATE | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
  fi
  writer_port=$node_port

  for j in `seq 1  3`;do
   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_rate_limit=1;"
   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_admin_statements=ON;"
   mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL log_slow_slave_statements=ON;"
    if [[ -z $use_socket ]]; then
      sudo pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ps-prod --cluster=ps-prod-cluster --replication-set=ps-repl ps_group_replication_node_$j --debug 127.0.0.1:$node_port
    else
      sudo pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --socket=/tmp/mysql_sandbox$node_port.sock --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps_group_replication_node_$j --debug
    fi
    node_port=$(($node_port + 1))
    sleep 20
  done
  #run_workload 127.0.0.1 msandbox msandbox $node_port mysql percona-server-group-replication-node

  ## Start Running Load
  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $writer_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
  mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $writer_port -e "drop database if exists sbtest;create database sbtest;"
  sleep 10

  sysbench_prepare "$writer_port" "sbtest" "msandbox"
  sleep 20
  sysbench_run "$writer_port" "sbtest" "msandbox"
}

add_annotation_pmm2 () {
  pmm-admin annotate "pmm-annotate-without-tags"
  sleep 20
  pmm-admin annotate "pmm-annotate-tags" --tags="pmm-testing-tag1,pmm-testing-tag2"
}

setup_pmm2_client_docker_image () {
  if [ -z ${DOCKER_VERSION+x} ]; then
    export DOCKER_VERSION=perconalab/pmm-server:dev-latest
  fi
  if [ -z ${CLIENT_DOCKER_VERSION+x} ]; then
    export CLIENT_DOCKER_VERSION=perconalab/pmm-client:dev-latest
  fi
  docker network create docker-client-check
  sleep 5

  # Start PMM-Server on a different port for testing purpose
  docker run -p 8081:80 -p 445:443 -p 9095:9093 --name docker-client-check-pmm-server -d --network docker-client-check -e PMM_DEBUG=1 ${DOCKER_VERSION}
  sleep 20
  echo "PMM Server Dev Latest connected using port 8081"

  # Start pmm-client and use same network, connect it to pmm-server
  docker run -e PMM_AGENT_SERVER_ADDRESS=docker-client-check-pmm-server:443 -e PMM_AGENT_SERVER_USERNAME=admin -e PMM_AGENT_SERVER_PASSWORD=admin -e PMM_AGENT_SERVER_INSECURE_TLS=1 -e PMM_AGENT_SETUP=1 -e PMM_AGENT_CONFIG_FILE=pmm-agent.yml -d --network docker-client-check --name=pmm-client ${CLIENT_DOCKER_VERSION}
  sleep 20
  echo "PMM Client Start and connected to PMM-Server"
  ## Start Percona Server 5.7 latest image and connect it to same network

  docker run -e PMM_AGENT_SERVER_ADDRESS=docker-client-check-pmm-server:443 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_USER=pmm-agent -e MYSQL_PASSWORD=pmm-agent -d --network docker-client-check --name=ps5.7 percona:5.7
  sleep 20

  ## Add mysql instance for monitoring.
  docker exec pmm-client pmm-admin add mysql --username=root --password=root --service-name=ps5.7 --query-source=perfschema --host=ps5.7 --port=3306 --server-url=http://admin:admin@docker-client-check-pmm-server/
  sleep 5

  ## Add Percona Server for MongoDB instance for monitoring
  docker run -e PMM_AGENT_SERVER_ADDRESS=docker-client-check-pmm-server:443 -d --network docker-client-check --name mongodb mongo:4.0
  sleep 10
  docker exec mongodb mongo --eval 'db.setProfilingLevel(2)'
  docker exec pmm-client pmm-admin add mongodb --service-name=mongodb-4.0  --host=mongodb --port=27017 --server-url=http://admin:admin@docker-client-check-pmm-server/

  ## Add PostgreSQL instance for Monitoring
  docker run  -e PMM_AGENT_SERVER_ADDRESS=docker-client-check-pmm-server:443 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -d --network docker-client-check --name=postgres-10 postgres:10
  sleep 10
  docker exec pmm-client pmm-admin add postgresql --query-source=pgstatements --username=postgres --password=postgres --service-name=postgres-10  --host=postgres-10 --port=5432 --server-url=http://admin:admin@docker-client-check-pmm-server/
  sleep 5
}

setup_external_service () {
  wget https://github.com/oliver006/redis_exporter/releases/download/v1.14.0/redis_exporter-v1.14.0.linux-386.tar.gz
  export NODE_PROCESS_EXPORTER_VERSION="0.7.5"
  tar -xvf redis_exporter-v1.14.0.linux-386.tar.gz
  rm redis_exporter*.tar.gz
  mv redis_* redis_exporter
  cd redis_exporter
  docker run --name=redis_container -d -p 6379:6379 redis '--requirepass oFukiBRg7GujAJXq3tmd'
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
  pmm-admin add external --group=processes  --listen-port=9256 --service-name=external_nodeprocess
}

setup_custom_queries () {
  echo "Creating Custom Queries"
  git clone https://github.com/Percona-Lab/pmm-custom-queries
  sudo cp pmm-custom-queries/mysql/*.yml /usr/local/percona/pmm2/collectors/custom-queries/mysql/high-resolution/
  echo "Adding Custom Queries for postgres"
  sudo cp pmm-custom-queries/postgresql/*.yaml /usr/local/percona/pmm2/collectors/custom-queries/postgresql/high-resolution/
  echo 'node_role{role="my_monitored_server_1"} 1' > node_role.prom
  sudo cp node_role.prom /usr/local/percona/pmm2/collectors/textfile-collector/high-resolution/
  sudo pkill -f mysqld_exporter
  sudo pkill -f postgres_exporter
  sudo pkill -f node_exporter
  sleep 5
  echo "Setup for Custom Queries Completed along with custom text file collector Metrics"
}

setup_custom_prometheus_config () {
  echo "Creating Custom Prometheus Configuration"
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker cp /srv/pmm-qa/pmm-tests/prometheus.base.yml $PMM_SERVER_DOCKER_CONTAINER:/srv/prometheus/prometheus.base.yml
  docker exec $PMM_SERVER_DOCKER_CONTAINER supervisorctl restart pmm-managed
}

setup_grafana_plugin () {
  echo "Installing alexanderzobnin-zabbix-app Plugin for Grafana"
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  export pmm_minor_v=$(get_minor_version ${PMM_SERVER_DOCKER_CONTAINER})
  if [ "${pmm_minor_v}" -gt "22" ]; then
    docker exec -e GF_PLUGIN_DIR=/srv/grafana/plugins/ $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins install alexanderzobnin-zabbix-app
  else
   docker exec $PMM_SERVER_DOCKER_CONTAINER grafana-cli plugins install alexanderzobnin-zabbix-app
  fi
}

setup_custom_ami_instance() {
  echo "Setting up AMI instance with Custom Configuration"
  sudo cp /srv/pmm-qa/pmm-tests/prometheus.base.yml /srv/prometheus/prometheus.base.yml
  sudo supervisorctl restart pmm-managed
  sudo grafana-cli plugins install alexanderzobnin-zabbix-app
}

## Method is called with Client Docker Setup to run on the PXC stage for testsuite, tests are part of docker bats tests
setup_clickhouse_client () {
  echo "Setting up ClickHouse Client to Connect to Clickhouse server on PMM-Server"
  sudo yum install -y yum-utils
  sudo yum-config-manager --add-repo https://packages.clickhouse.com/rpm/clickhouse.repo
  sudo yum install -y clickhouse-client
}

setup_docker_compose() {
  sudo curl -L https://github.com/docker/compose/releases/download/1.29.0/docker-compose-`uname -s`-`uname -m` | sudo tee docker-compose > /dev/null
  md5sum docker-compose > checkmd5.md5
  md5sum -c --strict  checkmd5.md5
  sudo mv docker-compose /usr/bin/docker-compose
  sudo chmod +x /usr/bin/docker-compose
}

setup_mongodb_ssl () {
  echo "Setting up mongodb ssl"
  sudo yum install -y ansible
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  export PMM_CLIENT_VERSION=$(pmm-admin --version | grep -m1 'Version:' | awk -F' ' '{print $2}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/tls-ssl-setup
  if echo "$mo_version" | grep '4.4'; then
    export MONGODB_VERSION=4.4
  fi
  if echo "$mo_version" | grep '4.2'; then
    export MONGODB_VERSION=4.2
  fi
  if echo "$mo_version" | grep '4.0'; then
    export MONGODB_VERSION=4.0
  fi
  if echo "$mo_version" | grep '5.0'; then
    export MONGODB_VERSION=5.0
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    if [ -z "$PMM_CLIENT_VERSION" ]
    then
      export CLIENT_VERSION=dev-latest
    else
      export CLIENT_VERSION=${PMM_CLIENT_VERSION}
    fi
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
    fi
  fi
  export MONGODB_SSL_CONTAINER=mongodb_${MONGODB_VERSION}
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 mongodb_tls_setup.yml
  popd
}

setup_mysql_ssl () {
  echo "Setting up mysql ssl"
  sudo yum install -y ansible
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  export PMM_CLIENT_VERSION=$(pmm-admin --version | grep -m1 'Version:' | awk -F' ' '{print $2}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/tls-ssl-setup
  if echo "$ps_version" | grep '5.7'; then
    export MYSQL_VERSION=5.7
  fi
  if echo "$ps_version" | grep '8.0'; then
    export MYSQL_VERSION=8.0
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    if [ -z "$PMM_CLIENT_VERSION" ]
    then
      export CLIENT_VERSION=dev-latest
    else
      export CLIENT_VERSION=${PMM_CLIENT_VERSION}
    fi
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
    fi
  fi
  export MYSQL_SSL_CONTAINER=mysql_${MYSQL_VERSION}
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 mysql_tls_setup.yml
  popd
}

setup_postgres_ssl () {
  echo "Setting up postgres ssl"
  sudo yum install -y ansible
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  export PMM_CLIENT_VERSION=$(pmm-admin --version | grep -m1 'Version:' | awk -F' ' '{print $2}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/tls-ssl-setup
  if echo "$pdpgsql_version" | grep '13'; then
    export PGSQL_VERSION=13
  fi
  if echo "$pdpgsql_version" | grep '11'; then
    export PGSQL_VERSION=11
  fi
  if echo "$pdpgsql_version" | grep '12'; then
    export PGSQL_VERSION=12
  fi
  if echo "$pdpgsql_version" | grep '14'; then
    export PGSQL_VERSION=14
  fi
  if echo "$pdpgsql_version" | grep '15'; then
    export PGSQL_VERSION=15
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    if [ -z "$PMM_CLIENT_VERSION" ]
    then
      export CLIENT_VERSION=dev-latest
    else
      export CLIENT_VERSION=${PMM_CLIENT_VERSION}
    fi
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
    fi
  fi
  export PGSQL_SSL_CONTAINER=pgsql_${PGSQL_VERSION}
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 postgresql_tls_setup.yml
  popd
}

setup_pmm_pgsm_integration () {
  echo "Setting up PMM and PGSM Integration"
  sudo yum install -y ansible
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/
  if echo "$pdpgsql_version" | grep '13'; then
    export PGSQL_VERSION=13
  fi
  if echo "$pdpgsql_version" | grep '11'; then
    export PGSQL_VERSION=11
  fi
  if echo "$pdpgsql_version" | grep '12'; then
    export PGSQL_VERSION=12
  fi
  if echo "$pdpgsql_version" | grep '14'; then
    export PGSQL_VERSION=14
  fi
  if echo "$pdpgsql_version" | grep '15'; then
    export PGSQL_VERSION=15
  fi
  if [ -z "$PGSTAT_MONITOR_BRANCH" ]
  then
    export PGSTAT_MONITOR_BRANCH=main
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "${PGSQL_PGSM_CONTAINER}" ]
  then
    export PGSQL_PGSM_CONTAINER=pgsql_pgsm_${PGSQL_VERSION}
  fi
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 pgsql_pgsm_setup.yml
  popd
}

setup_pmm_pgss_integration () {
  echo "Setting up PMM and PGStatements Integration"
  sudo yum install -y ansible
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/
  if echo "$pgsql_version" | grep '13'; then
    export PGSQL_VERSION=13
  fi
  if echo "$pgsql_version" | grep '11'; then
    export PGSQL_VERSION=11
  fi
  if echo "$pgsql_version" | grep '12'; then
    export PGSQL_VERSION=12
  fi
  if echo "$pgsql_version" | grep '14'; then
    export PGSQL_VERSION=14
  fi
  if echo "$pgsql_version" | grep '15'; then
    export PGSQL_VERSION=15
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "${PGSQL_PGSS_CONTAINER}" ]
  then
    export PGSQL_PGSS_CONTAINER=pgsql_pgss_${PGSQL_VERSION}
  fi

  export PGSQL_PGSS_PORT=$pgsql_pgss_port

  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 pgsql_pgss_setup.yml
  popd
}

setup_pxc_client_container () {
  echo "Setting up PMM and PXC Integration"

  ## only doing it for jenkins workers, need ansible installed on the host
  sudo yum install -y ansible || true
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/
  if [ -z "$ADMIN_PASSWORD" ]
  then
    export ADMIN_PASSWORD="admin"
  fi
  if [ -z "$PXC_VERSION" ]
  then
    export PXC_VERSION=${pxc_version}
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "${PXC_CONTAINER}" ]
  then
    export PXC_CONTAINER=pxc_container_${PXC_VERSION}
  fi
  if [ -z "$QUERY_SOURCE" ]
  then
    export QUERY_SOURCE=${query_source}
  fi
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 pxc_proxysql_setup.yml
  popd
}

setup_pmm_psmdb_integration () {
  echo "Setting up PMM and PSMDB Integration"

  ## only doing it for jenkins workers, need ansible installed on the host
  sudo yum install -y ansible || true
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/
  if [ -z "$PSMDB_VERSION" ]
  then
    export PSMDB_VERSION=${mo_version}
  fi
  if echo "$with_sharding" | grep '1'; then
    export PSMDB_SETUP=sharded
  elif echo "$with_replica" | grep '1'; then
    export PSMDB_SETUP=replica
  else
    export PSMDB_SETUP=regular
  fi

  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "${PSMDB_CONTAINER}" ]
  then
    export PSMDB_CONTAINER=psmdb_pmm_${PSMDB_VERSION}_${PSMDB_SETUP}
  fi
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 psmdb_setup.yml
  popd
}

setup_checks_basic () {
  echo "Setting up basic Checks Trigger"
  export password=oFukiBRg7GujAJXq3tmd

  docker run -d --name mongodb-advisor-checks \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=${password} \
  -p 27047:27017 \
  percona/percona-server-mongodb:4.2.20

  docker run -d --name postgres-advisor-checks \
  -e POSTGRES_USER=pmm-agent \
  -e POSTGRES_PASSWORD=${password} \
  -p 5440:5432 \
  postgres:14.1

  docker run -d --name mysql-advisor-checks \
  -e MYSQL_ROOT_PASSWORD=${password} \
  -p 3310:3306 \
  percona:5.7.35

  sleep 30

  ## Adding those services
  pmm-admin add mysql --username=root --port=3310 --password=${password} --query-source=perfschema mysql_checks_service
  pmm-admin add postgresql --query-source=pgstatements --username=pmm-agent --port=5440 --password=${password}  postgres_checks_service
  pmm-admin add mongodb --username=root --port=27047 --password=${password} mongodb_checks_service
}

setup_pmm_ps_integration () {
  echo "Setting up PMM and Percona Server Integration"

  ## only doing it for jenkins workers, need ansible installed on the host
  sudo yum install -y ansible || true
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/
  if [ -z "$PS_VERSION" ]
  then
    export PS_VERSION=${ps_version}
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "$QUERY_SOURCE" ]
  then
    export QUERY_SOURCE=${query_source}
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "${PS_CONTAINER}" ]
  then
    export PS_CONTAINER=ps_pmm_${PS_VERSION}
  fi
  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ps_pmm_setup.yml
  popd
}

setup_pmm_ms_integration () {
  echo "Setting up PMM and MySQL Server Integration"

  ## only doing it for jenkins workers, need ansible installed on the host
  sudo yum install -y ansible || true
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  docker network create pmm-qa || true
  docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
  pushd $SCRIPT_PWD/
  if [ -z "$MS_VERSION" ]
  then
    export MS_VERSION=${ms_version}
  fi
  if [ -z "$CLIENT_VERSION" ]
  then
    export CLIENT_VERSION=dev-latest
  fi
  if [ -z "$QUERY_SOURCE" ]
  then
    export QUERY_SOURCE=${query_source}
  fi
  if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
  then
    if [ ! -z "${PMM2_SERVER_IP}" ]
    then
      export PMM_SERVER_IP=${PMM2_SERVER_IP}
    else
      export PMM_SERVER_IP=127.0.0.1
    fi
  else
    export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
  fi
  if [ -z "${MS_CONTAINER}" ]
  then
    export MS_CONTAINER=ms_pmm_${MS_VERSION}
  fi
    if [ ! -z "${ADDCLIENTS_COUNT}" ]; then
     export MS_NODES=${ADDCLIENTS_COUNT}
  fi
  if [[ ! -z $setup_group_replication ]]; then
     export GROUP_REPLICATION=$setup_group_replication
  fi
  if [ -z "$ADMIN_PASSWORD" ]
  then
     export ADMIN_PASSWORD="admin"
  fi

  export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
  ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 ms_pmm_setup.yml
  popd
}

setup_remote_db_docker_compose () {
  echo "Setting up remote db's for AMI/OVF instances"
  setup_docker_compose
  mkdir -p /tmp/remote_db || :
  pushd /tmp/remote_db
  if [ ! -d "pmm-ui-tests" ]; then
    git clone https://github.com/percona/pmm-ui-tests
  fi
  pushd pmm-ui-tests
  PWD=$(pwd) docker-compose -f docker-compose-ami-db-setup.yml up -d
  sleep 30
  sudo bash -x testdata/db_setup.sh
  popd
  echo "Remote Instances Setup for OVF/AMI compose file present at /tmp/remote_db"
  popd
}

setup_mongo_replica_for_backup() {
  echo "Setting up MongoDB replica set with PBM"
  setup_docker_compose
  export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
  if [ $PMM_SERVER_DOCKER_CONTAINER != "pmm-server" ]; then
    export PMM_SERVER_CONTAINER_ADDRESS=${PMM_SERVER_DOCKER_CONTAINER}:443
  fi
  mkdir -p /tmp/mongodb_backup_replica || :
  pushd /tmp/mongodb_backup_replica
  if [ ! -d "qa-integration" ]; then
    git clone -b main https://github.com/Percona-Lab/qa-integration
  fi
  mkdir /tmp/backup_data && chmod 777 /tmp/backup_data
  pushd qa-integration/pmm_psmdb-pbm_setup
  PSMDB_VERSION=4.4.18-18 ./start-rs-only.sh
  popd
  popd
}

setup_bm_mysql() {
  echo "Setting up mysql for Backup"
  sudo yum install -y ansible
  export pmm_client_minor_v=$(get_client_minor_version)
  if [ "${pmm_client_minor_v}" -gt "23" ]; then
    if [ "$ps_version" == "5.7" ]; then
      ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 $SCRIPT_PWD/backup/ps_57_bm.yml
    fi
    if [ "$ps_version" == "8.0" ]; then
      ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 $SCRIPT_PWD/backup/ps_80_bm.yml
    fi
  fi
  sudo cat /var/log/mysqld.log
  pmm-admin add mysql --username=root --password=PMM_userk12456 --query-source=perfschema bm_mysql_pmm_qa_$ps_version
}

setup_ssl_services() {
  setup_mongodb_ssl
  setup_postgres_ssl
  setup_mysql_ssl
}

setup_pgsql_vacuum() {
  sudo chmod +x ${DIRNAME}/pgsql-vacuum.sh
  if [ ! -z $pgsql_version ]; then
    ${DIRNAME}/pgsql-vacuum.sh $pgsql_version
  else
    ${DIRNAME}/pgsql-vacuum.sh
  fi
}

prepare_service_name() {
  random_service_name=$1
  if [ ! -z $service_custom_name ]; then
    echo $service_name
  else
    echo $random_service_name
  fi
}

get_minor_version() {
  export PMM_SERVER_VERSION=$(docker exec $1 pmm-admin status | grep 'Version:' | awk -F' ' '{print $2}')
  versions=${PMM_SERVER_VERSION:2:2}
  echo ${versions};
}

get_client_minor_version() {
  export PMM_CLIENT_VERSION=$(pmm-admin --version | grep -m1 'Version:' | awk -F' ' '{print $2}')
  versions=${PMM_CLIENT_VERSION:2:2}
  echo ${versions};
}

if [ ! -z $setup_remote_db ]; then
  setup_remote_db_docker_compose
fi

if [ ! -z $setup_pgsql_vacuum ]; then
  setup_pgsql_vacuum
fi

if [ ! -z $setup_pmm_ps_integration ]; then
  setup_pmm_ps_integration
fi

if [ ! -z $setup_checks_basic ]; then
  setup_checks_basic
fi

if [ ! -z $wipe_clients ]; then
  clean_clients
fi

if [ ! -z $wipe_pmm2_clients ]; then
  wipe_pmm2_clients
fi

if [ ! -z $setup_alertmanager ]; then
  setup_alertmanager
fi

if [ ! -z $delete_package ]; then
  remove_packages
fi

if [ ! -z $wipe_docker_clients ]; then
  clean_docker_clients
fi

if [ ! -z $wipe_server ]; then
  clean_server
fi

if [ ! -z $wipe ]; then
  clean_clients
  clean_docker_clients
  clean_server
fi

if [ ! -z $list ]; then
  sudo pmm-admin list
fi

if [ ! -z $setup ]; then
  setup
fi

#if [ ! -z $PMM2 ]; then
#  configure_client;
#fi

if [ ! -z $upgrade_server ]; then
  upgrade_server
fi

if [ ! -z $upgrade_client ]; then
  upgrade_client
fi

if [ ${#ADDCLIENT[@]} -ne 0 ]; then
  if [[ "$pmm_server" == "custom" ]];then
    if ! sudo pmm-admin ping | grep -q "OK, PMM server is alive"; then
      echo "ERROR! PMM Server is not running. Please check PMM server status. Terminating"
      exit 1
    fi
  else
    sanity_check
  fi
  add_clients
fi

if [ ! -z $with_proxysql ]; then
  if [ ! -z $PMM2 ]; then
    echo "proxysql2 already setup with PXC";
  else
    pxc_proxysql_setup
  fi
fi

if [ ! -z $sysbench_data_load ]; then
  sysbench_prepare
fi

if [ ! -z $sysbench_oltp_run ]; then
  sysbench_run
fi

if [ ! -z $mongo_sysbench ]; then
  mongo_sysbench
fi
if [ ! -z $add_docker_client ]; then
  sanity_check
  pmm_docker_client_startup
fi

if [ ! -z $run_load_pmm2 ]; then
  run_workload
fi

if [ ! -z $add_annotation ]; then
  add_annotation_pmm2
fi

if [ ! -z $setup_replication_ps_pmm2 ]; then
  setup_replication_ps_pmm2
fi

if [ ! -z $setup_pmm_client_docker ]; then
  setup_pmm2_client_docker_image
  setup_clickhouse_client
fi

if [ ! -z $setup_external_service ]; then
  setup_external_service
fi

if [ ! -z $setup_with_custom_settings ]; then
  setup_custom_queries
  setup_custom_prometheus_config
  setup_grafana_plugin
fi

if [ ! -z $setup_with_custom_queries ]; then
  setup_custom_queries
fi

if [ ! -z $setup_custom_ami ]; then
  setup_custom_ami_instance
fi

if [ ! -z $postgres_ssl_setup ]; then
  export pmm_client_minor_v=$(get_client_minor_version)
  setup_postgres_ssl
fi

if [ ! -z $mysql_ssl_setup ]; then
  export pmm_client_minor_v=$(get_client_minor_version)
  setup_mysql_ssl
fi

if [ ! -z $mongodb_ssl_setup ]; then
  export pmm_client_minor_v=$(get_client_minor_version)
  setup_mongodb_ssl
fi

if [ ! -z $mongo_replica_for_backup ]; then
  setup_mongo_replica_for_backup
fi

if [ ! -z $cleanup_services ]; then
  cleanup_services
fi

if [ ! -z $setup_bm_mysql ]; then
  setup_bm_mysql
fi

if [ ! -z $setup_pmm_pgsm_integration ]; then
  setup_pmm_pgsm_integration
fi

if [ ! -z $setup_pmm_pgss_integration ]; then
  setup_pmm_pgss_integration
fi


if [ ! -z $setup_ssl_services ]; then
  setup_ssl_services
fi

if [ ! -z $MONGOMAGIC ]; then
  setup_pmm_psmdb_integration
fi

exit 0
