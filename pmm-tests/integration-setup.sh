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


# Itterate trough all arguments and select correct parameters to be run.
for var in "$@"
do
  case "$arg" in
    --setup-pgsql-vacuum )
      setup_pgsql_vacuum=1
      shift
    ;;
    --setup-pmm-pgss-integration )
      setup_pmm_pgss_integration=1
      shift
    ;;
  esac
done

if [ ! -z $setup_pgsql_vacuum ]; then
  sudo chmod +x ${DIRNAME}/postgres/pgsql-vacuum-setup.sh
  if [ ! -z $pgsql_version ]; then
    ${DIRNAME}/postgres/pgsql-vacuum-setup.sh $pgsql_version
  else
    ${DIRNAME}/postgres/pgsql-vacuum-setup.sh
  fi  
fi

if [ ! -z $setup_pmm_pgss_integration ]; then
  sudo chmod +x ${DIRNAME}/postgres/pmm-pgss-integration-setup.sh
  ${DIRNAME}/postgres/pmm-pgss-integration-setup.sh
fi
