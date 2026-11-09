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
# rs101-rs203 are pmm_psmdb-pbm_setup's replica set members, psmdb-server is
# pmm_psmdb_diffauth_setup's; pmm and pmm-test are their client users.
for host in rs101 rs102 rs103 rs201 rs202 rs203 psmdb-server; do
    kadmin.local -q "addprinc -pw mongodb mongodb/$host"
    kadmin.local -q "ktadd -k /keytabs/mongodb.keytab mongodb/$host@PERCONATEST.COM"
done
kadmin.local -q "addprinc -pw password1 pmm"
kadmin.local -q "addprinc -pw password1 pmm-test"

krb5kdc -n
