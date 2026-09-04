#! /env/sh

cat > /etc/krb5.conf << EOL
[libdefaults]
    default_realm = PERCONATEST.COM
    forwardable = true
    dns_lookup_realm = false
    dns_lookup_kdc = false
    ignore_acceptor_hostname = true
    rdns = false
[realms]
    PERCONATEST.COM = {
        kdc_ports = 88
        kdc = kerberos
        admin_server = kerberos
    }
[domain_realm]
    .perconatest.com = PERCONATEST.COM
    perconatest.com = PERCONATEST.COM
    kerberos = PERCONATEST.COM
EOL

kdb5_util -P password create -s
kadmin.local -q "addprinc -pw password root/admin"
for i in 101 102 103 201 202 203; do
    kadmin.local -q "addprinc -pw mongodb mongodb/rs$i"
done
kadmin.local -q "addprinc -pw password1 pmm"
for i in 101 102 103 201 202 203; do
    kadmin.local -q "ktadd -k /keytabs/mongodb.keytab mongodb/rs$i@PERCONATEST.COM"
done

krb5kdc -n
