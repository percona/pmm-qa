## Generic bats tests

function checkZipFileContents(){
    ZIP_FILE_NAME=$(echo "${lines[-1]}" | awk '{ print $1 }')
    run unzip -l "$ZIP_FILE_NAME"
}

@test "run pmm-admin under regular(non-root) user privileges" {
if [[ $(id -u) -eq 0 ]] ; then
        skip "Skipping this test, because you are running under root"
fi
run pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}

@test "run pmm-admin under root privileges" {
if [[ $(id -u) -ne 0 ]] ; then
        skip "Skipping this test, because you are NOT running under root"
fi
run pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}

@test "run pmm-admin without any arguments" {
run pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}

@test "run pmm-admin help" {
run pmm-admin help
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}

@test "run pmm-admin -h" {
run pmm-admin -h
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}

@test "run pmm-admin with wrong option" {
run pmm-admin install
echo "$output"
    [ "$status" -eq 1 ]
    echo "${output}" | grep "pmm-admin: error: unexpected argument install"
}

@test "run pmm-admin list to check for available services" {
run pmm-admin list
echo "$output"
    [ "$status" -eq 0 ]
}

@test "run pmm-admin --version" {
 run pmm-admin --version
 echo "$output"
 	[ "$status" -eq 0 ]
	echo "$output" | grep "Version: ${PMM_VERSION}"
}


@test "run pmm-admin summary --help" {
run pmm-admin summary --help
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "Usage: pmm-admin summary" ]
}

@test "run pmm-admin summary -h" {
run pmm-admin summary -h
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "Usage: pmm-admin summary" ]
}

@test "run pmm-admin summary --version" {
run pmm-admin summary --version
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "Version: ${PMM_VERSION}"
}

@test "run pmm-admin status and strict check version admin in output" {
skip "The version number for Feature Build can never be strict matched since packages are downloaded via tarball hence need to skip"
run bash -c "echo $(pmm-admin status | grep pmm-admin | awk -F' ' '{print $3}')"
[ "$output" = "${PMM_VERSION}" ]
}

@test "run pmm-admin status and strict check version agent in output" {
skip "The version number for Feature Build can never be strict matched since packages are downloaded via tarball hence need to skip"
run bash -c "echo $(pmm-admin status | grep pmm-agent | awk -F' ' '{print $3}')"
[ "$output" = "${PMM_VERSION}" ]
}

@test "run pmm-admin summary --server-url with http" {
run pmm-admin summary --server-url='http://admin:admin@localhost'
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep -E "43|44 files"
}

@test "run pmm-admin summary --server-url with https and verify warning" {
run pmm-admin summary --server-url='https://admin:admin@localhost'
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "certificate is not valid for any names"
    echo "${lines[1]}" | grep ".zip created."
}

@test "run pmm-admin summary --server-url --server-insecure-tls with https" {
run pmm-admin summary --server-url='https://admin:admin@localhost' --server-insecure-tls
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[0]}" | grep ".zip created." # there are problems with certificate Get "https://localhost/logs.zip": x509: certificate is not valid for any names, but wanted to match localhost. Despite error archive s still created
    checkZipFileContents
    echo "$output" | grep -E "43|44 files"
}

@test "run pmm-admin summary --debug" {
run pmm-admin summary --debug
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "POST /v1/inventory/Agents/List HTTP/1.1" # there are no request for those urls. but there are requests for /local/status
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --trace" {
run pmm-admin summary --trace
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "(*Runtime).Submit() POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "(*Runtime).Submit() POST /v1/inventory/Agents/List HTTP/1.1" # there are no request for those urls. but there are requests for /local/status
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --json" {
run pmm-admin summary --json
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "{\"filename\":\""
    echo "${lines[-1]}" | grep ".zip\"}"
}

@test "run pmm-admin summary --filename empty" {
run pmm-admin summary --filename=""
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --filename " {
run pmm-admin summary --filename="test.zip"
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --filename=testformat.txt and verify generated file is a ZIP archive " {
FILENAME='testformat.txt'
run pmm-admin summary --filename="$FILENAME"
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep "$FILENAME created."
    run file $FILENAME
    echo "$output" | grep "$FILENAME: Zip archive data, at least v2.0 to extract"
}

@test "run pmm-admin summary --filename --skip-server" {
run pmm-admin summary --filename="test.zip" --skip-server
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep -E "5|6 files"
}

@test "run pmm-admin summary --skip-server" {
run pmm-admin summary --skip-server
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --skip-server --trace" {
run pmm-admin summary --skip-server --trace
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "(*Runtime).Submit() POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "(*Runtime).Submit() POST /v1/inventory/Agents/List HTTP/1.1"
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --skip-server --debug" {
run pmm-admin summary --skip-server --debug
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "POST /v1/inventory/Agents/List HTTP/1.1"
    echo "${lines[-1]}" | grep ".zip created."
}

@test "run pmm-admin summary --skip-server --json --debug --filename=json_export.zip" {
ZIP_FILE_NAME='json_export.zip'
run pmm-admin summary --skip-server --json --debug --filename=$ZIP_FILE_NAME
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "POST /v1/inventory/Agents/List HTTP/1.1"
}

@test "run pmm-admin summary --pprof" {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
    echo "$output" | grep "43 files"
}

@test "run pmm-admin summary --pprof --trace" {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof --trace
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "(*Runtime).Submit() POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "(*Runtime).Submit() POST /v1/inventory/Agents/List HTTP/1.1"
    echo "${lines[-1]}" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
}

@test "run pmm-admin summary --pprof --debug" {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof --debug
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "POST /v1/inventory/Agents/List HTTP/1.1"
    echo "${lines[-1]}" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
}

@test "run pmm-admin summary --pprof --server-url with http" {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof --server-url='http://admin:admin@localhost'
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
    echo "$output" | grep "43 files"
}

@test "run pmm-admin summary --pprof --json" {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof --json
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "{\"filename\":\""
    echo "${lines[-1]}" | grep ".zip\"}"
}

@test "run pmm-admin summary --pprof --filename " {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof --filename="test_pprof.zip"
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep "test_pprof.zip created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
}

@test "run pmm-admin summary --pprof --skip-server" {
skip "skipping because -pprof flag takes a lot of time"
run pmm-admin summary --pprof --skip-server
echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[-1]}" | grep ".zip created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
    echo "$output" | grep "8 files"
}

@test "run pmm-admin summary --pprof --debug --filename --skip-server" {
skip "skipping because -pprof flag takes a lot of time"
ZIP_FILE_NAME='test_pprof_complex.zip'
run pmm-admin summary --pprof --debug --filename=$ZIP_FILE_NAME --skip-server
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "POST /v1/inventory/Services/List HTTP/1.1"
    echo "$output" | grep "POST /v1/inventory/Agents/List HTTP/1.1"
    echo "${lines[-1]}" | grep "$ZIP_FILE_NAME created."
    checkZipFileContents
    echo "$output" | grep "client/pprof/"
    echo "$output" | grep "8 files"
}

@test "run pmm-admin annotate --help" {
run pmm-admin annotate --help
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Usage: pmm-admin annotate <text>" ]]
    [[ ${output} =~ "<text>    Text of annotation" ]] 
    [[ ${output} =~ "Add an annotation to Grafana charts" ]]
}

@test "run pmm-admin annotate 'pmm-testing-check'" {
run pmm-admin annotate "pmm-testing-check"
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "Annotation added."
}

@test "run pmm-admin annotate with text and tags, verify that it should work" {
run pmm-admin annotate --tags="testing" "testing-annotate"
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "Annotation added."
}

@test "run pmm-admin --help to check if Annotation exist in help output" {
run pmm-admin --help
echo "$output"
    [ "$status" -eq 0 ]
     echo "$output" | grep "annotate      Add an annotation to Grafana charts"
}

@test "run pmm-admin annotate without any text and verify it should not work" {
run pmm-admin annotate
echo "$output"
    [ "$status" -eq 1 ]
    echo "$output" | grep "pmm-admin: error: expected \"<text>\""
}

@test "run pmm-admin annotate with tags without text cannot be added" {
run pmm-admin annotate --tags="testing"
echo "$output"
    [ "$status" -eq 1 ]
    echo "$output" | grep "pmm-admin: error: expected \"<text>\""
}

@test "run pmm-admin config --help to check for Metrics Mode option" {
run pmm-admin config --help
echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "metrics-mode=\"auto\""
    echo "${output}" | grep "Metrics flow mode for agents node-exporter,
                                    can be push - agent will push metrics, pull -
                                    server scrape metrics from agent or auto -
                                    chosen by server."
}

check_postgres_encoding() {
    database_name=$1
    container_name="$(docker ps -f name=-server --format "{{ .Names }}")"
    docker exec $container_name su -l postgres -c "psql $database_name -c 'SHOW SERVER_ENCODING'" | grep UTF8

    [ "$status" -eq 0 ]
}

@test "Check that pmm-managed database encoding is UTF8" {
    run check_postgres_encoding pmm-managed
}

@test "Check that template1 database encoding is UTF8" {
    run check_postgres_encoding template1
}

@test "run pmm-admin config without parameters package installation" {
if $(which pmm-admin | grep -q 'pmm2-client'); then
    skip "Skipping this test, because pmm2-client is a tarball setup"
fi
run sudo pmm-admin config
echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "pmm-agent is running."
}

@test "run pmm-admin config without parameters tarball installation" {
if $(which pmm-admin | grep -qv 'pmm2-client'); then
    skip "Skipping this test, because pmm2-client is a package installation"
fi
run pmm-admin config
echo "$output"
    [ "$status" -eq 1 ]
    echo "${output}" | grep "Failed to register pmm-agent on PMM Server: Node with name" # no information about failure reasons is shown
}

function teardown() {
        echo "$output"
}