#!/bin/bash

if [[ $# -eq 0 ]] ; then
    echo 'Please provide a Sandboxes path for DbDeployer Mysql'
    exit 1
fi

export SANDBOX=$1;
export DBDEPLOYER_SANDBOX_PATH="/home/ec2-user/sandboxes/$SANDBOX";
while true
do
     if [ -f "$DBDEPLOYER_SANDBOX_PATH/status_all" ]; then
          cp $DBDEPLOYER_SANDBOX_PATH/start_all $DBDEPLOYER_SANDBOX_PATH/start 2>/dev/null || :
          cp $DBDEPLOYER_SANDBOX_PATH/status_all $DBDEPLOYER_SANDBOX_PATH/status 2>/dev/null || :
     fi
     FIND=$(bash $DBDEPLOYER_SANDBOX_PATH/status | grep off)
     if [ $? -eq 0 ]; then
          bash $DBDEPLOYER_SANDBOX_PATH/start
     fi
     sleep 30
done
