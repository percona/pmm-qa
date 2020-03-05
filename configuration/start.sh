#!/bin/bash

if [ ! $# == 2 ]; then
  echo "Usage: $0 config URL
   where config: configuation file,
          URL: URL address where PMM is installed"
  exit
fi

#nvm use 7.9.0
protractor  $1 --baseUrl=$2
