#!/bin/bash

# Installs DBs: ps, ms, md, mo, modb, pgsql, pxc

# Internal variables
WORKDIR=${PWD}
SCRIPT_PWD=$(cd `dirname $0` && pwd)
RPORT=$(( RANDOM%21 + 10 ))
RBASE="$(( RPORT*1000 ))"
SERVER_START_TIMEOUT=100
OUSER="admin"
OPASS="passw0rd"
ADDR="127.0.0.1"
download_link=0
disable_ssl=0
create_pgsql_user=0
PGSQL_PORT=5432
PS_PORT=43306
with_replica=1
mysqld_startup_options="--user=root"

usage () {
  echo "Usage: [ options ]"
  echo "Options:"
  echo " --addclient=ps,2               Add Percona (ps), MySQL (ms), MariaDB (md), Percona XtraDB Cluster (pxc), and/or mongodb (mo) pmm-clients to the currently live PMM server (as setup by --setup)"
  echo "                                You can add multiple client instances simultaneously. eg : --addclient=ps,2  --addclient=ms,2 --addclient=md,2 --addclient=mo,2 --addclient=pxc,3"
  echo " --download                     This will help us to download pmm client binary tar balls"
  echo " --dbdeployer                   This option will use dbdeployer tool for deploying PS, MS Databases"
  echo " --package-name                 Name of the Server package installed [ps, psmyr, ms, pgsql, md, pxc, mo]"
  echo " --ps-version                   Pass Percona Server version info"
  echo " --modb-version                 Pass MongoDB version info, from MongoDB!!"
  echo " --ms-version                   Pass MySQL Server version info"
  echo " --pgsql-version                Pass Postgre SQL server version Info"
  echo " --md-version                   Pass MariaDB Server version info"
  echo " --pxc-version                  Pass Percona XtraDB Cluster version info"
  echo " --mysqld-startup-options       Pass MySQL startup options. eg : --mysqld-startup-options='--innodb_buffer_pool_size=1G --innodb_log_file_size=1G'"
  echo " --with-proxysql                This allow to install PXC with proxysql"
  echo " --storage-engine               This will create sysbench tables with specific storage engine"
  echo " --mongo-storage-engine         Pass storage engine for MongoDB"
  echo " --mo-version                   Pass MongoDB Server version info"
  echo " --replcount                    You can configure multiple mongodb replica sets with this oprion"
  echo " --with-replica                 This will configure mongodb replica setup"
  echo " --with-sharding                This will configure mongodb sharding setup"
  echo " --mongo-sysbench               This option initiates sysbench oltp prepare and run for MongoDB instance"
  echo " --disable-ssl                  Disable SSL mode on exporter"
  echo " --create-pgsql-user            Set this option if a Dedicated PGSQl User creation is required username: psql and no password"
  echo " --query-source                 Set query source (perfschema or slowlog)"
  echo " --compare-query-count          This will help us to compare the query count between PMM client instance and PMM QAN/Metrics page"
  echo " --disable-tablestats           Disable table statistics collection (only works with PS Node)"
  echo " --add-annotation               Pass this to add Annotation to All reports and dashboard"
  echo " --use-socket                   Use DB Socket for PMM Client Connection"
  echo " --mongomagic                   Use this option for experimental MongoDB setup with PMM2"
}

# Check if we have a functional getopt(1)
if ! getopt --test
  then
  go_out="$(getopt --options=u: --longoptions=addclient:,replcount:,query-source:,pmm2,mongomagic,disable-tablestats,with-replica,with-arbiter,with-sharding,download,ps-version:,modb-version:,ms-version:,pgsql-version:,md-version:,pxc-version:,mysqld-startup-options:,mo-version:,add-annotation,use-socket,create-pgsql-user,with-proxysql,mongo-sysbench,storage-engine:,mongo-storage-engine:,compare-query-count,help \
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
    --setup-db )
    ADDCLIENT=('ps,1' 'ms,1' 'mo,1' 'modb,1' 'pgsql,1' 'md,1' 'pxc,1')
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
    --package-name )
    package_name="$2"
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
    --pmm2 )
    shift
    PMM2=1
    ;;
    --mongomagic )
    shift
    MONGOMAGIC=1
    ;;
    --disable-tablestats )
    shift
    DISABLE_TABLESTATS=1
    ;;
    --add-annotation )
    shift
    add_annotation=1
    ;;
    --use-socket )
    shift
    use_socket=1
    ;;
    --create-pgsql-user )
    shift
    create_pgsql_user=1
    ;;
    --with-proxysql )
    shift
    with_proxysql=1
    ;;
    --storage-engine )
    storage_engine="$2"
    shift 2
    ;;
    --mongo-sysbench )
    shift
    mongo_sysbench=1
    ;;
    --compare-query-count )
    shift
    compare_query_count=1
    ;;
    --help )
    usage
    exit 0
    ;;
  esac
done

if [[ -z "$storage_engine" ]];then
  storage_engine=INNODB
fi

if [[ -z "$create_pgsql_user" ]]; then
  create_pgsql_user=0
fi

if [[ "$with_sharding" == "1" ]];then
  with_replica=1
fi

if [[ -z "${ps_version}" ]]; then ps_version="5.7"; fi
if [[ -z "${modb_version}" ]]; then modb_version="4.2.0"; fi
if [[ -z "${pxc_version}" ]]; then pxc_version="5.7"; fi
if [[ -z "${ms_version}" ]]; then ms_version="8.0"; fi
if [[ -z "${md_version}" ]]; then md_version="10.5"; fi
if [[ -z "${mo_version}" ]]; then mo_version="4.2"; fi
if [[ -z "${REPLCOUNT}" ]]; then REPLCOUNT="1"; fi
if [[ -z "${pgsql_version}" ]]; then pgsql_version="12";fi

if [[ -z "$query_source" ]];then
  query_source=perfschema
fi

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
    if [ ! -f $SCRIPT_PWD/../get_download_link.sh ] ; then
      curl -OL https://raw.githubusercontent.com/Percona-QA/percona-qa/master/get_download_link.sh
      chmod +x get_download_link.sh
      mv get_download_link.sh $SCRIPT_PWD/../
    fi
    LINK=`$SCRIPT_PWD/../get_download_link.sh --product=${PRODUCT_NAME} --distribution=$DISTRUBUTION --version=$VERSION`
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

setup_db_tar(){
  PRODUCT_NAME=$1
  SERVER_STRING=$2
  CLIENT_MSG=$3
  VERSION=$4
  if cat /etc/os-release | grep rhel >/dev/null ; then
    DISTRUBUTION=centos
  fi
  if [ ! -f $SCRIPT_PWD/../get_download_link.sh ] ; then
    curl -OL https://raw.githubusercontent.com/Percona-QA/percona-qa/master/get_download_link.sh
    chmod +x get_download_link.sh
    mv get_download_link.sh $SCRIPT_PWD/../
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

check_port (){
  PORT=$1
  DB=$2
  if [[ $(sudo docker ps | grep $DB | grep 0.0.0.0:$PORT) ]] || [[ $(lsof -i -P -n | grep LISTEN | grep $PORT) ]]; then
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

check_dbdeployer(){
  if ! dbdeployer --version | grep 'dbdeployer version 1.' > /dev/null ; then
    echo "ERROR! dbdeployer not installed attempting to install"
    install_dbdeployer
  fi
  dbdeployer delete all --skip-confirm
}

install_dbdeployer(){
  wget https://github.com/datacharmer/dbdeployer/releases/download/v1.45.0/dbdeployer-1.45.0.linux.tar.gz
  tar -xzf dbdeployer-1.45.0.linux.tar.gz
  chmod +x dbdeployer-1.45.0.linux
  sudo mv dbdeployer-1.45.0.linux /usr/local/bin/dbdeployer
}

# install_dbdeployer_v1_53_2(){
#   wget https://github.com/datacharmer/dbdeployer/releases/download/v1.53.2/dbdeployer-1.53.2.linux.tar.gz
#   tar -xzf dbdeployer-1.53.2.linux.tar.gz
#   chmod +x dbdeployer-1.53.2.linux
#   sudo mv dbdeployer-1.53.2.linux /usr/local/bin/dbdeployer
# }


# *********** Main AddClient function **********
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
    elif [[ "${CLIENT_NAME}" == "mo" ]]; then
      get_basedir psmdb "percona-server-mongodb-${mo_version}*" "Percona Server Mongodb binary tar ball" ${mo_version}
    fi
    if [[ "${CLIENT_NAME}" != "md"  && "${CLIENT_NAME}" != "mo" && "${CLIENT_NAME}" != "pgsql" ]]; then
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

    ADDCLIENTS_COUNT=$(echo "${i}" | sed 's|[^0-9]||g') # Number of DB clients of that type to be added
    if  [[ "${CLIENT_NAME}" == "mo" && -z $MONGOMAGIC ]]; then
      rm -rf $BASEDIR/data
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
              pmm-admin add mongodb --debug --cluster mongodb_cluster mongodb_inst_rpl${p}_${r}_$IP_ADDRESS localhost:$PORT
            else
              pmm-admin add mongodb --debug --cluster mongodb_cluster --socket=/tmp/mongodb-$PORT.sock  mongodb_inst_rpl${p}_${r}_$IP_ADDRESS
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
                pmm-admin add mongodb --debug --cluster mongodb_cluster --socket=/tmp/mongodb-$PORT.sock mongodb_inst_config_rpl${m}_$IP_ADDRESS
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
    elif [[ "${CLIENT_NAME}" == "pgsql" && -z $PMM2  ]]; then
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
          sudo pmm-admin add postgresql --user postgres --host localhost --port ${PGSQL_PORT} --disable-ssl PGSQL-${NODE_NAME}-${j}
          check_disable_ssl PGSQL-${NODE_NAME}-${j}
        else
          sudo pmm-admin add postgresql --user postgres --host localhost --port ${PGSQL_PORT} PGSQL-${NODE_NAME}-${j}
        fi
      done
    elif [[ "${CLIENT_NAME}" == "pgsql" && ! -z $PMM2 ]]; then
      PGSQL_PORT=5432
      docker pull postgres:${pgsql_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $PGSQL_PORT postgres
        docker run --name PGSQL_${pgsql_version}_${IP_ADDRESS}_$j -p $PGSQL_PORT:5432 -d -e POSTGRES_HOST_AUTH_METHOD=trust postgres:${pgsql_version} -c shared_preload_libraries='pg_stat_statements' -c pg_stat_statements.max=10000 -c pg_stat_statements.track=all
        sleep 20
        docker exec PGSQL_${pgsql_version}_${IP_ADDRESS}_$j psql -h localhost -U postgres -c 'create extension pg_stat_statements'
        docker exec PGSQL_${pgsql_version}_${IP_ADDRESS}_$j psql -h localhost -U postgres -c 'ALTER SYSTEM SET track_io_timing=ON;'
        docker exec PGSQL_${pgsql_version}_${IP_ADDRESS}_$j psql -h localhost -U postgres -c 'SELECT pg_reload_conf();'

        echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
        echo -e "Port: $PGSQL_PORT" >> db_config.txt
        echo -e "Version: $pgsql_version" >> db_config.txt
        if [ $(( ${j} % 2 )) -eq 0 ]; then
          "PMM Command: pmm-admin add postgresql --environment=pgsql-prod --cluster=pgsql-prod-cluster --replication-set=pgsql-repl2 PGSQL_${pgsql_version}_${IP_ADDRESS}_$j localhost:$PGSQL_PORT" >> db_config.txt
        else
          "PMM Command: pmm-admin add postgresql --environment=pgsql-dev --cluster=pgsql-dev-cluster --replication-set=pgsql-repl1 PGSQL_${pgsql_version}_${IP_ADDRESS}_$j localhost:$PGSQL_PORT" >> db_config.txt
        fi
        echo -e "\n******\n" >> db_config.txt
        PGSQL_PORT=$((PGSQL_PORT+j))
      done
    elif [[ "${CLIENT_NAME}" == "ms" && ! -z $PMM2 ]]; then
      check_dbdeployer
      setup_db_tar mysql "mysql-${ms_version}*" "MySQL Server binary tar ball" ${ms_version}
      if [ -d "$WORKDIR/mysql" ]; then
        rm -Rf $WORKDIR/mysql;
      fi
      mkdir $WORKDIR/mysql
      dbdeployer unpack mysql-${ms_version}* --sandbox-binary $WORKDIR/mysql --overwrite
      rm -Rf mysql-${ms_version}*
      if [[ "${ADDCLIENTS_COUNT}" == "1" ]]; then
        dbdeployer deploy single $VERSION_ACCURATE --sandbox-binary $WORKDIR/mysql --force
        node_port=`dbdeployer sandboxes --header | grep $VERSION_ACCURATE | grep 'single' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
        mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
        if [[ "${query_source}" == "slowlog" ]]; then
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
        fi

        echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
        echo -e "Port: $node_port" >> db_config.txt
        echo -e "Query Source: $query_source" >> db_config.txt
        echo -e "Username: msandbox" >> db_config.txt
        echo -e "Password: msandbox" >> db_config.txt
        echo -e "Version: $VERSION_ACCURATE" >> db_config.txt
        # run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-single-$IP_ADDRESS
        if [[ -z $use_socket ]]; then
          echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=dev --cluster=dev-cluster --replication-set=repl1 ms-single-$IP_ADDRESS 127.0.0.1:$node_port" >> db_config.txt
        else
          echo "Use Socket: YES" >> db_config.txt
          echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --socket=/tmp/mysql_sandbox$node_port.sock --environment=dev --cluster=dev-cluster --replication-set=repl1 ms-single-$IP_ADDRESS" >> db_config.txt
        fi
        echo -e "\n******\n" >> db_config.txt
      else
        dbdeployer deploy multiple $VERSION_ACCURATE --sandbox-binary $WORKDIR/mysql --nodes $ADDCLIENTS_COUNT --force
        node_port=`dbdeployer sandboxes --header | grep $VERSION_ACCURATE | grep 'multiple' | awk -F'[' '{print $2}' | awk -F' ' '{print $1}'`
        for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
          mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "ALTER USER 'msandbox'@'localhost' IDENTIFIED WITH mysql_native_password BY 'msandbox';"
          #node_port=`dbdeployer sandboxes --header | grep $VERSION_ACCURATE | grep 'multiple' | awk -F'[' '{print $2}' | awk -v var="$j" -F' ' '{print $var}'`
          if [[ "${query_source}" == "slowlog" ]]; then
            mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL slow_query_log='ON';"
            mysql -h 127.0.0.1 -u msandbox -pmsandbox --port $node_port -e "SET GLOBAL long_query_time=0;"
          fi

          echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
          echo -e "Port: $node_port" >> db_config.txt
          echo -e "Query Source: $query_source" >> db_config.txt
          echo -e "Username: msandbox" >> db_config.txt
          echo -e "Password: msandbox" >> db_config.txt
          echo -e "Version: $VERSION_ACCURATE" >> db_config.txt

          if [[ -z $use_socket ]]; then
            if [ $(( ${j} % 2 )) -eq 0 ]; then
              echo -e "PMM Command: pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-prod --cluster=ms-prod-cluster --replication-set=ms-repl2 ms-multiple-node-$j-$IP_ADDRESS --debug 127.0.0.1:$node_port" >> db_config.txt
            else
              echo -e "PMM Command: pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --environment=ms-dev --cluster=ms-dev-cluster --replication-set=ms-repl1 ms-multiple-node-$j-$IP_ADDRESS --debug 127.0.0.1:$node_port" >> db_config.txt
            fi
          else
            echo "Use Socket: YES" >> db_config.txt
            if [ $(( ${j} % 2 )) -eq 0 ]; then
              echo -e "PMM Command: pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --socket=/tmp/mysql_sandbox$node_port.sock --environment=ms-prod --cluster=ms-prod-cluster --replication-set=ms-repl2 ms-multiple-node-$j-$IP_ADDRESS --debug" >> db_config.txt
            else
              echo -e "PMM Command: pmm-admin add mysql --query-source=$query_source --username=msandbox --password=msandbox --socket=/tmp/mysql_sandbox$node_port.sock --environment=ms-dev --cluster=ms-dev-cluster --replication-set=ms-repl1 ms-multiple-node-$j-$IP_ADDRESS --debug" >> db_config.txt
            fi
          fi

          echo -e "\n******\n" >> db_config.txt
          #run_workload 127.0.0.1 msandbox msandbox $node_port mysql mysql-multiple-node-$j-$IP_ADDRESS
          node_port=$(($node_port + 1))
          sleep 20
        done
      fi
    elif [[ "${CLIENT_NAME}" == "ps" && ! -z $PMM2 ]]; then
      PS_PORT=43306
      docker pull percona:${ps_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $PS_PORT percona
        sudo chmod 777 -R /var/log
        mkdir ps_socket_${PS_PORT}
        sudo chmod 777 -R ps_socket_${PS_PORT}
        docker run --name ps_${ps_version}_${IP_ADDRESS}_$j -v /var/log:/var/log -v ${WORKDIR}/ps_socket_${PS_PORT}/:/var/lib/mysql/ -p $PS_PORT:3306 -e MYSQL_ROOT_PASSWORD=ps -e UMASK=0777 -d percona:${ps_version}
        sleep 20
        mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL userstat=1;"
        mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL innodb_monitor_enable=all;"
        mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'ps';"
        if [[ "$query_source" != "perfschema" ]]; then
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL slow_query_log='ON';"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL long_query_time=0;"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL log_slow_rate_limit=1;"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL log_slow_admin_statements=ON;"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL log_slow_slave_statements=ON;"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL query_response_time_stats=ON;"
          mysql -h 127.0.0.1 -u root -pps --port $PS_PORT -e "SET GLOBAL slow_query_log_file='/var/log/ps_${j}_slowlog.log';"
        fi

        echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
        echo -e "Port: $PS_PORT" >> db_config.txt
        echo -e "Query Source: $query_source" >> db_config.txt
        echo -e "Username: root" >> db_config.txt
        echo -e "Password: ps" >> db_config.txt
        echo -e "Version: $ps_version" >> db_config.txt

        if [[ -z $use_socket ]]; then
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=ps --environment=ps-prod --cluster=ps-prod-cluster --replication-set=ps-repl2 ps_${ps_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$PS_PORT" >> db_config.txt
          else
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=ps --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps_${ps_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$PS_PORT" >> db_config.txt
          fi
          if [[ ! -z $DISABLE_TABLESTATS ]]; then
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=ps --environment=ps-prod --disable-tablestats ps_dts_node_$j --debug 127.0.0.1:$PS_PORT" >> db_config.txt
          fi
        else
          echo "Use Socket: YES" >> db_config.txt
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=ps --environment=ps-prod --cluster=ps-prod-cluster --replication-set=ps-repl2 ps_${ps_version}_${IP_ADDRESS}_$j --debug" >> db_config.txt
          else
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=ps --environment=ps-dev --cluster=ps-dev-cluster --replication-set=ps-repl1 ps_${ps_version}_${IP_ADDRESS}_$j --debug" >> db_config.txt
          fi
          if [[ ! -z $DISABLE_TABLESTATS ]]; then
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --socket=${WORKDIR}/ps_socket_${PS_PORT}/mysql.sock --username=root --password=ps --environment=ps-prod --disable-tablestats ps_dts_node_$j --debug" >> db_config.txt
          fi
        fi
        echo -e "\n******\n" >> db_config.txt
        #run_workload 127.0.0.1 root ps $PS_PORT mysql ps_${ps_version}_${IP_ADDRESS}_$j
        PS_PORT=$((PS_PORT+j))
      done
    elif [[ "${CLIENT_NAME}" == "md" && ! -z $PMM2 ]]; then
      MD_PORT=53306
      docker pull mariadb:${md_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $MD_PORT mariadb
        sudo chmod 777 -R /var/log
        mkdir md_socket_${MD_PORT}
        sudo chmod 777 -R md_socket_${MD_PORT}
        docker run --name md_${md_version}_${IP_ADDRESS}_$j -v /var/log:/var/log -v ${WORKDIR}/md_socket_${MD_PORT}/:/var/run/mysqld/ -p $MD_PORT:3306 -e MYSQL_ROOT_PASSWORD=md -e UMASK=0777 -d mariadb:${md_version} --performance-schema=1
        sleep 20
        if [[ "$query_source" != "perfschema" ]]; then
          mysql -h 127.0.0.1 -u root -pmd --port $MD_PORT -e "SET GLOBAL slow_query_log='ON';"
          mysql -h 127.0.0.1 -u root -pmd --port $MD_PORT -e "SET GLOBAL long_query_time=0;"
          mysql -h 127.0.0.1 -u root -pmd --port $MD_PORT -e "SET GLOBAL log_slow_rate_limit=1;"
          mysql -h 127.0.0.1 -u root -pmd --port $MD_PORT -e "SET GLOBAL slow_query_log_file='/var/log/md_${j}_slowlog.log';"
        fi

        echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
        echo -e "Port: $MD_PORT" >> db_config.txt
        echo -e "Query Source: $query_source" >> db_config.txt
        echo -e "Username: root" >> db_config.txt
        echo -e "Password: md" >> db_config.txt
        echo -e "Version: $md_version" >> db_config.txt

        if [[ -z $use_socket ]]; then
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=md --environment=md-prod --cluster=md-prod-cluster --replication-set=md-repl2 md_${md_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$MD_PORT" >> db_config.txt
          else
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=md --environment=md-dev --cluster=md-dev-cluster --replication-set=md-repl1 md_${md_version}_${IP_ADDRESS}_$j --debug 127.0.0.1:$MD_PORT" >> db_config.txt
          fi
        else
          echo "Use Socket: YES" >> db_config.txt
          echo "Socket: ${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock" >> db_config.txt
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=md --socket=${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock --environment=md-prod --cluster=md-prod-cluster --replication-set=md-repl2 md_${md_version}_${IP_ADDRESS}_$j --debug" >> db_config.txt
          else
            echo "PMM Command: pmm-admin add mysql --query-source=$query_source --username=root --password=md --socket=${WORKDIR}/md_socket_${MD_PORT}/mysqld.sock --environment=md-dev --cluster=md-dev-cluster --replication-set=md-repl1 md_${md_version}_${IP_ADDRESS}_$j --debug" >> db_config.txt
          fi
        fi
        echo -e "\n******\n" >> db_config.txt
        #run_workload 127.0.0.1 root md $MD_PORT mysql md_${md_version}_${IP_ADDRESS}_$j
        MD_PORT=$((MD_PORT+j))
      done
    elif [[ "${CLIENT_NAME}" == "modb" && ! -z $PMM2 ]]; then
      MODB_PORT=27017
      docker pull mongo:${modb_version}
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        check_port $MODB_PORT mongodb
        MODB_PORT_NEXT=$((MODB_PORT+2))
        docker run -d -p $MODB_PORT-$MODB_PORT_NEXT:27017-27019 -v /tmp/:/tmp/ -e UMASK=0777 --name mongodb_node_$j mongo:${modb_version}
        sleep 20
        docker exec mongodb_node_$j mongo --eval 'db.setProfilingLevel(2)'

        echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
        echo -e "Port: $MODB_PORT" >> db_config.txt
        # echo -e "Username: root" >> db_config.txt
        # echo -e "Password: md" >> db_config.txt
        echo -e "Version: $modb_version" >> db_config.txt
        if [[ -z $use_socket ]]; then
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            echo "PMM Command: pmm-admin add mongodb --cluster mongodb_node_$j --environment=modb-prod mongodb_node_$j --debug localhost:$MODB_PORT" >> db_config.txt
          else
            echo "PMM Command: pmm-admin add mongodb --cluster mongodb_node_$j --environment=modb-dev mongodb_node_$j --debug localhost:$MODB_PORT" >> db_config.txt
          fi
        else
          echo "Use Socket: YES" >> db_config.txt
          echo "Socket: /tmp/mongodb-$MODB_PORT.sock" >> db_config.txt
          if [ $(( ${j} % 2 )) -eq 0 ]; then
            echo "PMM Command: pmm-admin add mongodb --cluster mongodb_node_$j --environment=modb-prod mongodb_node_$j --socket=/tmp/mongodb-$MODB_PORT.sock --debug" >> db_config.txt
          else
            echo "PMM Command: pmm-admin add mongodb --cluster mongodb_node_$j --environment=modb-dev mongodb_node_$j --socket=/tmp/mongodb-$MODB_PORT.sock --debug " >> db_config.txt
          fi
        fi
        echo -e "\n******\n" >> db_config.txt
        MODB_PORT=$((MODB_PORT+j+3))
      done
    elif [[ "${CLIENT_NAME}" == "mo" && ! -z $PMM2  && ! -z $MONGOMAGIC ]]; then
      echo "Running MongoDB setup script, using MONGOMAGIC"
      curl -OL https://raw.githubusercontent.com/Percona-QA/percona-qa/master/mongo_startup.sh
      sudo chmod +x mongo_startup.sh
      echo ${BASEDIR}
      echo "DB Name: $CLIENT_NAME" >> db_config.txt
      echo "Mongomagic: True" >> db_config.txt
      echo "Version: $mo_version" >> db_config.txt
      ## Download right PXC version
      if [[ "$with_sharding" == "1" ]]; then
        echo "with_sharding: True" >> db_config.txt
        if [ "$mo_version" == "3.6" ]; then
          bash ./mongo_startup.sh -s -e rocksdb --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        if [ "$mo_version" == "4.0" ]; then
          bash ./mongo_startup.sh -s -e mmapv1 --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        if [ "$mo_version" == "4.2" ]; then
          bash ./mongo_startup.sh -s -e inMemory --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        sleep 20
        echo "PMM Commands:" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --environment=mongodb_shraded_node mongodb_shraded_node --debug 127.0.0.1:27017" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_1 --debug 127.0.0.1:27027" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_2 --debug 127.0.0.1:27028" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_3 --debug 127.0.0.1:27029" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_1 --debug 127.0.0.1:27018" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_2 --debug 127.0.0.1:27019" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_3 --debug 127.0.0.1:27020" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_1 --debug 127.0.0.1:28018" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_2 --debug 127.0.0.1:28019" >> db_config.txt
        echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_3 --debug 127.0.0.1:28020" >> db_config.txt
      elif [[ "$with_replica" == "1" ]]; then
        echo "with_replica: True" >> db_config.txt
        if [ "$mo_version" == "3.6" ]; then
          bash ./mongo_startup.sh -r -e rocksdb --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        if [ "$mo_version" == "4.0" ]; then
          bash ./mongo_startup.sh -r -e mmapv1 --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        if [ "$mo_version" == "4.2" ]; then
          bash ./mongo_startup.sh -r -e inMemory --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        sleep 20
        if [[ -z $use_socket ]]; then
          echo "PMM Commands:" >> db_config.txt
          echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_1 --debug 127.0.0.1:27017" >> db_config.txt
          echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_2 --debug 127.0.0.1:27018" >> db_config.txt
          echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_3 --debug 127.0.0.1:27019" >> db_config.txt
        else
          echo "Use socket: YES" >> db_config.txt
          echo "PMM Commands:" >> db_config.txt
          echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --socket=/tmp/mongodb-27017.sock --environment=mongodb_rs_node mongodb_rs1_1 --debug" >> db_config.txt
          echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --socket=/tmp/mongodb-27018.sock --environment=mongodb_rs_node mongodb_rs1_2 --debug" >> db_config.txt
          echo "pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --socket=/tmp/mongodb-27019.sock --environment=mongodb_rs_node mongodb_rs1_3 --debug" >> db_config.txt
        fi
      else
        if [ "$mo_version" == "3.6" ]; then
          bash ./mongo_startup.sh -m -e rocksdb --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        if [ "$mo_version" == "4.0" ]; then
          bash ./mongo_startup.sh -m -e mmapv1 --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        if [ "$mo_version" == "4.2" ]; then
          bash ./mongo_startup.sh -m -e inMemory --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=${BASEDIR}/bin
        fi
        sleep 20
        echo "PMM Command: pmm-admin add mongodb --cluster mongodb_node_cluster --environment=mongodb_single_node mongodb_rs_single --debug 127.0.0.1:27017" >> db_config.txt
      fi
      echo -e "\n******\n" >> db_config.txt
    elif [[ "${CLIENT_NAME}" == "pxc" && ! -z $PMM2 ]]; then
      echo "Running pxc_proxysql_setup script"
      sh $SCRIPT_PWD/pxc_proxysql_setup.sh ${ADDCLIENTS_COUNT} ${pxc_version} ${query_source}
      sleep 5
      BASEDIR=$(ls -1td Percona-XtraDB-Cluster* 2>/dev/null | grep -v ".tar" | head -n1)
      cd ${BASEDIR}
      echo $node1_port
      echo -e "DB Name: $CLIENT_NAME" >> db_config.txt
      echo -e "Version: $pxc_version" >> db_config.txt
      echo -e "Query Source: $query_source" >> db_config.txt
      echo -e "Username: sysbench" >> db_config.txt
      echo -e "Password: test" >> db_config.txt
      for j in `seq 1  ${ADDCLIENTS_COUNT}`;do
        if [[ -z $use_socket ]]; then
          "PMM Command: pmm-admin add mysql --query-source=$query_source --username=sysbench --password=test --host=127.0.0.1 --port=$(cat node$j.cnf | grep port | awk -F"=" '{print $2}') --environment=pxc-dev --cluster=pxc-dev-cluster --replication-set=pxc-repl pxc_node_${pxc_version}_${IP_ADDRESS}_$j" >> db_config.txt
        else
          echo "Use Socket: YES" >> db_config.txt
          echo "Socket: $(cat node$j.cnf | grep socket | awk -F"=" '{print $2}')"
          "PMM Command: pmm-admin add mysql --query-source=$query_source --username=sysbench --password=test --socket=$(cat node$j.cnf | grep socket | awk -F"=" '{print $2}') --environment=pxc-dev --cluster=pxc-dev-cluster --replication-set=pxc-repl pxc_node_${pxc_version}_${IP_ADDRESS}_$j" >> db_config.txt
        fi
        sleep 5
        #run_workload 127.0.0.1 sysbench test $(cat node$j.cnf | grep port | awk -F"=" '{print $2}') mysql pxc_node_${pxc_version}_${IP_ADDRESS}_$j
      done
      cd ../
      "PMM Command: pmm-admin add proxysql --environment=proxysql-dev --cluster=proxysql-dev-cluster --replication-set=proxysql-repl" >> db_config.txt
      echo -e "\n******\n" >> db_config.txt
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
}

if [ ${#ADDCLIENT[@]} -ne 0 ]; then
  add_clients
fi

if [ ! -z $with_proxysql ]; then
  if [ ! -z $PMM2 ]; then
    echo "proxysql2 already setup with PXC";
  else
    pxc_proxysql_setup
  fi
fi

exit 0