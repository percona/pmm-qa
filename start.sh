#!/bin/bash

if [ ! $# == 1 ]; then
  echo "Usage: $0 url_to_pmm-server"
  exit
fi

URL=$1
protractor --baseUrl=$URL config.js
