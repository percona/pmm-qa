#!/bin/sh
set -eu

cat >/etc/krb5.conf <<'EOF'
[libdefaults]
 default_realm = PERCONATEST.COM
 dns_lookup_realm = false
 dns_lookup_kdc = false
 rdns = false
[realms]
 PERCONATEST.COM = {
  kdc = kerberos
  admin_server = kerberos
 }
[domain_realm]
 .perconatest.com = PERCONATEST.COM
 perconatest.com = PERCONATEST.COM
EOF

kdb5_util -P password create -s
kadmin.local -q 'addprinc -pw password root/admin'
kadmin.local -q 'addprinc -pw password1 pmm'
rm -f /keytabs/mongodb.keytab
for host in $MONGO_HOSTS; do
  kadmin.local -q "addprinc -pw mongodb mongodb/$host"
  kadmin.local -q "ktadd -k /keytabs/mongodb.keytab mongodb/$host@PERCONATEST.COM"
done
chmod 644 /keytabs/mongodb.keytab
exec krb5kdc -n
