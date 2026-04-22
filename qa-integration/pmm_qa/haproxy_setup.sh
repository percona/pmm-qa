#!/bin/sh


while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$metrics_mode" ]
then
      export metrics_mode=push
fi

# Install the dependencies
source ~/.bash_profile || true;
apt-get update
apt-get -y install wget curl git gnupg2 lsb-release
apt-get -y install -y git ca-certificates gcc libc6-dev liblua5.3-dev libpcre3-dev libssl-dev libsystemd-dev make wget zlib1g-dev

## Get Haproxy
git clone https://github.com/haproxy/haproxy.git
cd haproxy
make TARGET=linux-glibc USE_LUA=1 USE_OPENSSL=1 USE_PCRE=1 USE_ZLIB=1 USE_SYSTEMD=1 USE_PROMEX=1
make install-bin
cp /usr/local/sbin/haproxy /usr/sbin/haproxy
