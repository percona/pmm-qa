#!/bin/bash

### Download Docker Images
echo "you must have permission to run docker."
docker pull selenoid/vnc_chrome:80.0
docker pull selenoid/video-recorder:latest-release
docker pull aerokube/selenoid-ui

###create env file
echo PWD=${PWD} > .env

###
docker-compose up -d
sleep 20

### Run tests with configuration file local.codecept.json, make sure PMM server url is mentioned correctly.
echo "using local.codecept.json file for configuration";
./node_modules/.bin/codeceptjs run-multiple parallel --steps --debug --reporter mocha-multi -c local.codecept.json --grep '(?=.*)^(?!.*@visual-test)'
echo "Please check Live test execution on localhost:8080"