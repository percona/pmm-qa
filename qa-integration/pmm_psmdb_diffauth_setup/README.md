# PSMDB with TLS, LDAP and Kerberos

The compose stack behind the `SSL_PSMDB` setup of
[pmm-framework](../pmm_qa/pmm-framework/README.md): one `psmdb-server` that
authenticates clients with X509, LDAP, Kerberos and AWS, and an OpenLDAP
server. Run it through the framework, which overrides the stack's own PMM
Server and Kerberos services with its own.

- `docker-compose-pmm-psmdb.yaml`: the stack.
- `generate_certs.sh`: the CA, server and client certificates, made with
  easy-rsa into `certs/` (git-ignored); the CodeceptJS TLS tests read them.
- `conf/mongod.conf`, `init/setup_psmdb.js`: mongod's config and the users and
  roles it starts with.

The tests for this stack are in [`psmdb_pbm_auth_tests`](../../psmdb_pbm_auth_tests/README.md)
(`diffauth.bats`).
