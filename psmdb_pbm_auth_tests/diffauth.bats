#!/usr/bin/env bats
#
# Adds psmdb-server (pmm_psmdb_diffauth_setup) to PMM with each authentication
# method and checks its exporter's metrics.
#
# X509, LDAP, Kerberos and AWS rely on mongod to authenticate with that method
# and authorize through LDAP, so $external holds no users. mongod maps the
# authenticated name onto the LDAP user cn=pmm-test,ou=users,dc=example,dc=org,
# which inherits the privileges of cn=readers,ou=users,dc=example,dc=org:
#   [{match: "arn:aws:iam::(.+):user/(.+)|CN=(.+)|([^@]+)@PERCONATEST.COM", substitution: "cn={1}{2}{3},ou=users,dc=example,dc=org"}]

load helper

TLS='--tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem'

pmm_admin() {
  timeout 30 docker exec psmdb-server sh -c "$1"
}

# Replace any earlier psmdb-server service with the one ADD_COMMAND adds, then
# check its metrics once the exporter serves them (up to 30 s).
run_test() {
  local list name _
  list=$(pmm_admin 'pmm-admin list --json') && jq -e . <<<"$list" >/dev/null ||
    fail "Failed to get or parse service list from pmm-admin" || return
  for name in $(jq -r '.service[]? | select(.service_type == "SERVICE_TYPE_MONGODB_SERVICE" and (.service_name | startswith("psmdb-server"))) | .service_name' <<<"$list"); do
    pmm_admin "pmm-admin remove mongodb $name" >/dev/null 2>&1 || true
  done
  pmm_admin "$1" >/dev/null || fail "Fail to add MongoDB to pmm-admin" || return
  for _ in $(seq 1 30); do
    check_metrics psmdb-server ${2:+"$2"} 2>/dev/null && return
    sleep 1
  done
  check_metrics psmdb-server ${2:+"$2"}
}

aws_ready() {
  [[ -n ${AWS_ACCESS_KEY_ID:-} && -n ${AWS_SECRET_ACCESS_KEY:-} && -n ${AWS_USERNAME:-} && ${SKIP_AWS_TESTS:-} != true ]]
}

@test "test_simple_auth_wo_tls" {
  run_test 'pmm-admin add mongodb psmdb-server --agent-password=mypass --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" --host psmdb-server --port 27017'
}

@test "test_simple_auth_tls" {
  run_test "pmm-admin add mongodb psmdb-server --agent-password=mypass --username=pmm_mongodb --password=\"5M](Q%q/U+YQ<^m\" --host psmdb-server --port 27017 $TLS --cluster=mycluster"
}

@test "test_x509_auth" {
  run_test "pmm-admin add mongodb psmdb-server --agent-password=mypass --host=psmdb-server --port 27017 $TLS --authentication-mechanism=MONGODB-X509 --authentication-database='\$external' --cluster=mycluster"
}

@test "test_ldap_auth_wo_tls" {
  run_test "pmm-admin add mongodb psmdb-server --agent-password=mypass --username=\"CN=pmm-test\" --password=password1 --host=psmdb-server --port 27017 --authentication-mechanism=PLAIN --authentication-database='\$external' --cluster=mycluster"
}

@test "test_ldap_auth_tls" {
  run_test "pmm-admin add mongodb psmdb-server --agent-password=mypass --username=\"CN=pmm-test\" --password=password1 --host=psmdb-server --port 27017 --authentication-mechanism=PLAIN --authentication-database='\$external' $TLS --cluster=mycluster"
}

@test "test_kerberos_auth_wo_tls" {
  skip "Kerberos support in PMM was reverted"
  run_test "pmm-admin add mongodb psmdb-server --username=\"pmm-test@PERCONATEST.COM\" --password=password1 --host=psmdb-server --port 27017 --authentication-mechanism=GSSAPI --authentication-database='\$external' --cluster=mycluster" gssapi
}

@test "test_kerberos_auth_tls" {
  skip "Kerberos support in PMM was reverted"
  run_test "pmm-admin add mongodb psmdb-server --username=\"pmm-test@PERCONATEST.COM\" --password=password1 --host=psmdb-server --port 27017 --authentication-mechanism=GSSAPI --authentication-database='\$external' $TLS --cluster=mycluster" gssapi
}

@test "test_aws_auth_wo_tls" {
  aws_ready || skip "One or more of AWS env var isn't defined or SKIP_AWS_TESTS is set to true"
  run_test "pmm-admin add mongodb psmdb-server --agent-password=mypass --username=$AWS_ACCESS_KEY_ID --password=$AWS_SECRET_ACCESS_KEY --host=psmdb-server --port 27017 --authentication-mechanism=MONGODB-AWS --authentication-database='\$external' --cluster=mycluster"
}

@test "test_aws_auth_tls" {
  aws_ready || skip "One or more of AWS env var isn't defined or SKIP_AWS_TESTS is set to true"
  run_test "pmm-admin add mongodb psmdb-server --agent-password=mypass --username=$AWS_ACCESS_KEY_ID --password=$AWS_SECRET_ACCESS_KEY --host=psmdb-server --port 27017 --authentication-mechanism=MONGODB-AWS --authentication-database='\$external' $TLS --cluster=mycluster"
}
