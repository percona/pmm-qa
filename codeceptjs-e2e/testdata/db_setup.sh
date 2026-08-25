#!/bin/bash

repo_root=$(pwd)

### Call PS5.7 Setup Scripts
bash -x ${repo_root}/testdata/docker-db-setup-scripts/docker_ps_5_7.sh


### Call PS8.0 Setup Scripts
bash -x ${repo_root}/testdata/docker-db-setup-scripts/docker_ps_8_0.sh

### Call Postgres Docker Setup Script
bash -x ${repo_root}/testdata/docker-db-setup-scripts/docker_postgres_13.sh

### SSL instance setup along with slowlog
##bash -x ${repo_root}/testdata/docker-db-setup-scripts/docker_mysql_ssl_8_0.sh


### SSL instance setup along for Mongodb
##bash -x ${repo_root}/testdata/docker-db-setup-scripts/docker_mongodb_ssl_4_4.sh
