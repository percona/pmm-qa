#!/bin/bash

if [ ! $# == 1 ]; then
  echo "Usage: $0 config_file"
  exit
fi

config_file=$1
protractor  $config_file
