#!/bin/bash

if [ ! $# == 2 ]; then
  echo "Usage: $0 config URL
   where config: configuation file,
          URL: URL address where PMM is installed"
  exit
fi

config_file=$1
protractor  $config_file --baseUrl=$2
