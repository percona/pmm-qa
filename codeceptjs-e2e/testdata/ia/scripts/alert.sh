#!/bin/bash

cat <<EOF > /var/opt/webhookd/scripts/alert.txt
$1
EOF
