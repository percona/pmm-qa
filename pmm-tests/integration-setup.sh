#!/bin/bash

# Internal variables
DIRNAME=$(dirname "$0")

options=(
  "--setup-pmm-pgss-integration"
  "--setup-pgsql-vacuum"
)

# Check if all provided parameters are valid.
for arg in $@; do
  if [[  ! "${options[*]}" =~ (^|[[:space:]])$arg($|[[:space:]]) ]];then
    exit 1
  fi
done

for var in "$@"
do
  if [[ $var == "--setup-pmm-pgss-integration" ]];then
    echo "Hello World"
    shift
  elif [[ $var == "--setup-pgsql-vacuum" ]];then
    sudo chmod +x ${DIRNAME}/postgres/pgsql-vacuum-setup.sh
    if [ ! -z $pgsql_version ]; then
      ${DIRNAME}/postgres/pgsql-vacuum-setup.sh $pgsql_version
    else
      ${DIRNAME}/postgres/pgsql-vacuum-setup.sh
    fi  
  fi
done