import subprocess
import argparse
import os
import sys
import requests
import re
import shutil
import yaml
from scripts.get_env_value import get_value
from scripts.database_options import database_options as database_configs
from scripts.run_ansible_playbook import run_ansible_playbook

LATEST_TARBALL_URL = "https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz"


def normalize_client_version(client_version):
    if client_version == "latest-tarball":
        return LATEST_TARBALL_URL
    return client_version


def get_running_container_name():
    container_image_name = "pmm-server"
    container_name = ''
    try:
        # Run 'docker ps' to get a list of running containers
        output = subprocess.check_output(['docker', 'ps', '--format', 'table {{.ID}}\t{{.Image}}\t{{.Names}}'])
        # Split the output into a list of container
        containers = output.strip().decode('utf-8').split('\n')[1:]
        # Check each line for the docker image name
        for line in containers:
            # Extract the image name
            info_parts = line.split('\t')[0]
            image_info = info_parts.split()[1]
            # Check if the container is in the list of running containers
            # and establish N/W connection with it.
            if container_image_name in image_info:
                container_name = info_parts.split()[2]
                # Check if pmm-qa n/w exists and already connected to running container n/w
                # if not connect it.
                result = subprocess.run(['docker', 'network', 'inspect', 'pmm-qa'], capture_output=True, text=True)
                if result.returncode != 0:
                    subprocess.run(['docker', 'network', 'create', 'pmm-qa'])
                    subprocess.run(['docker', 'network', 'connect', 'pmm-qa', container_name])
                else:
                    networks = result.stdout
                    if container_name not in networks:
                        subprocess.run(['docker', 'network', 'connect', 'pmm-qa', container_name])
                return container_name

    except subprocess.CalledProcessError:
        # Handle the case where the 'docker ps' command fails
        return None

    return None

def setup_ps(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Check Setup Types
    setup_type = ''
    no_of_nodes = 1
    setup_type_value = get_value('SETUP_TYPE', db_type, args, db_config).lower()
    if setup_type_value == "gr":
        setup_type = 1
        no_of_nodes = 1
    elif setup_type_value =="replication":
        setup_type = ''
        no_of_nodes = 2

    # Gather Version details
    ps_version = os.getenv('PS_VERSION') or db_version or database_configs[db_type]["versions"][-1]
    ps_version_int = int(ps_version.replace(".", ""))
    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'SETUP_TYPE': setup_type_value,
        'NODES_COUNT': get_value('NODES_COUNT', db_type, args, db_config),
        'QUERY_SOURCE': get_value('QUERY_SOURCE', db_type, args, db_config),
        'PS_VERSION': ps_version,
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'MY_ROCKS': get_value('MY_ROCKS', db_type, args, db_config),
        'ENCRYPTED_CLIENT_CONFIG': get_value('ENCRYPTED_CLIENT_CONFIG', db_type, args, db_config),
        'CLIENT_DEBUG': args.client_debug,
    }

    run_ansible_playbook('percona_server_for_mysql/percona-server-setup.yml', env_vars, args)

def setup_mysql(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running.., Exiting")
        exit()

    # Gather Version details
    ms_version = os.getenv('MS_VERSION') or db_version or database_configs[db_type]["versions"][-1]

    # Check Setup Types
    setup_type = ''
    no_of_nodes = 1
    setup_type_value = get_value('SETUP_TYPE', db_type, args, db_config).lower()
    if setup_type_value == "gr":
        setup_type = 1
        no_of_nodes = 1
    elif setup_type_value == "replication":
        setup_type = ''
        no_of_nodes = 2

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'GROUP_REPLICATION': setup_type,
        'MS_NODES': no_of_nodes,
        'MS_VERSION': ms_version,
        'SETUP_TYPE': setup_type_value,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'MS_CONTAINER': 'mysql_pmm_' + str(ms_version),
        'CLIENT_VERSION': client_version,
        'QUERY_SOURCE': get_value('QUERY_SOURCE', db_type, args, db_config),
        'MS_TARBALL': get_value('TARBALL', db_type, args, db_config),
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'ENCRYPTED_CLIENT_CONFIG': get_value('ENCRYPTED_CLIENT_CONFIG', db_type, args, db_config),
        'CLIENT_DEBUG': args.client_debug,
    }

    run_ansible_playbook('mysql/mysql-setup.yml', env_vars, args)

def setup_ssl_mysql(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Check Setup Types
    setup_type = None
    no_of_nodes = 1
    setup_type_value = get_value('SETUP_TYPE', db_type, args, db_config).lower()

    # Gather Version details
    ms_version = os.getenv('MS_VERSION') or db_version or database_configs[db_type]["versions"][-1]
    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'MYSQL_VERSION': ms_version,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'MYSQL_SSL_CONTAINER': 'mysql_ssl_' + str(ms_version),
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'CLIENT_DEBUG': args.client_debug,
    }

    # Ansible playbook filename
    playbook_filename = 'tls-ssl-setup/mysql_tls_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_pdpgsql(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    pdpgsql_version = os.getenv('PDPGSQL_VERSION') or db_version or database_configs[db_type]["versions"][-1]
    setup_type_value = get_value('SETUP_TYPE', db_type, args, db_config).lower()
    pgsm_branch = get_value('PGSM_BRANCH', db_type, args, db_config).lower()

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PGSTAT_MONITOR_BRANCH': 'main',
        'PDPGSQL_VERSION': pdpgsql_version,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'PDPGSQL_PGSM_CONTAINER': 'pdpgsql_pgsm_pmm_' + str(pdpgsql_version),
        'CLIENT_VERSION': client_version,
        'USE_SOCKET': get_value('USE_SOCKET', db_type, args, db_config),
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PDPGSQL_PGSM_PORT': 5447,
        'DISTRIBUTION': '',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'SETUP_TYPE': setup_type_value,
        'PGSM_BRANCH': pgsm_branch,
        'ENCRYPTED_CLIENT_CONFIG': get_value('ENCRYPTED_CLIENT_CONFIG', db_type, args, db_config),
        'CLIENT_DEBUG': args.client_debug,
    }

    # Ansible playbook filename
    playbook_filename = 'percona-distribution-postgresql/percona-distribution-postgres-setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_ssl_pdpgsql(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    pdpgsql_version = os.getenv('PDPGSQL_VERSION') or db_version or database_configs[db_type]["versions"][-1]

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PGSTAT_MONITOR_BRANCH': 'main',
        'PGSQL_VERSION': pdpgsql_version,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'PGSQL_SSL_CONTAINER': 'pdpgsql_pgsm_ssl_' + str(pdpgsql_version),
        'CLIENT_VERSION': client_version,
        'USE_SOCKET': get_value('USE_SOCKET', db_type, args, db_config),
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'CLIENT_DEBUG': args.client_debug,
    }

    # Ansible playbook filename
    playbook_filename = 'tls-ssl-setup/postgresql_tls_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_pgsql(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    pgsql_version = os.getenv('PGSQL_VERSION') or db_version or database_configs[db_type]["versions"][-1]
    setup_type_value = get_value('SETUP_TYPE', db_type, args, db_config).lower()

    print(f"Setup type is {setup_type_value}")
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))

    if setup_type_value == "replication":
        # Define environment variables for playbook
        env_vars = {
            'PGSQL_VERSION': pgsql_version,
            'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
            'PGSQL_PGSS_CONTAINER': 'pgsql_pgss_pmm_' + str(pgsql_version),
            'CLIENT_VERSION': client_version,
            'USE_SOCKET': get_value('USE_SOCKET', db_type, args, db_config),
            'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
            'PGSQL_PGSS_PORT': 5448,
            'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
            'SETUP_TYPE': setup_type_value,
            'ENCRYPTED_CLIENT_CONFIG': get_value('ENCRYPTED_CLIENT_CONFIG', db_type, args, db_config),
            'CLIENT_DEBUG': args.client_debug,
        }

        # Ansible playbook filename
        playbook_filename = 'postgresql/postgresql-setup.yml'
    else:
        # Define environment variables for playbook
        env_vars = {
            'PGSQL_VERSION': pgsql_version,
            'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
            'PGSQL_PGSS_CONTAINER': 'pgsql_pgss_pmm_' + str(pgsql_version),
            'CLIENT_VERSION': client_version,
            'USE_SOCKET': get_value('USE_SOCKET', db_type, args, db_config),
            'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
            'PGSQL_PGSS_PORT': 5448,
            'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
            'CLIENT_DEBUG': args.client_debug,
        }

        # Ansible playbook filename
        playbook_filename = 'pgsql_pgss_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_haproxy(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'HAPROXY_CONTAINER': 'haproxy_pmm',
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'CLIENT_DEBUG': args.client_debug,
    }

    # Ansible playbook filename
    playbook_filename = 'haproxy_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_external(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    redis_version = os.getenv('REDIS_VERSION') or db_version or database_configs["EXTERNAL"]["REDIS"]["versions"][-1]
    nodeprocess_version = os.getenv('NODE_PROCESS_VERSION') or db_version or \
                          database_configs["EXTERNAL"]["NODEPROCESS"]["versions"][-1]

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'REDIS_EXPORTER_VERSION': redis_version,
        'NODE_PROCESS_EXPORTER_VERSION': nodeprocess_version,
        'EXTERNAL_CONTAINER': 'external_pmm',
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3'
    }

    # Ansible playbook filename
    playbook_filename = 'external_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_mlaunch_psmdb(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    psmdb_version = os.getenv('PSMDB_VERSION') or db_version or \
                    database_configs[db_type]["versions"][-1]

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PSMDB_VERSION': psmdb_version,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'PSMDB_CONTAINER': 'psmdb_pmm_' + str(psmdb_version),
        'PSMDB_SETUP': get_value('SETUP_TYPE', db_type, args, db_config),
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3'
    }

    # Ansible playbook filename
    playbook_filename = 'mlaunch_psmdb_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_mlaunch_modb(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    modb_version = os.getenv('MODB_VERSION') or db_version or \
                   database_configs[db_type]["versions"][-1]

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'MODB_VERSION': modb_version,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'MODB_CONTAINER': 'modb_pmm_' + str(modb_version),
        'MODB_SETUP': get_value('SETUP_TYPE', db_type, args, db_config),
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3'
    }

    # Ansible playbook filename
    playbook_filename = 'mlaunch_modb_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def execute_shell_scripts(shell_scripts, project_relative_scripts_dir, env_vars, args):
    # Get script directory
    current_directory = os.getcwd()
    shell_scripts_path = os.path.abspath(os.path.join(current_directory, os.pardir, project_relative_scripts_dir))

    # Get the original working directory
    original_dir = os.getcwd()

    if args.verbose:
        print(f'Options set after considering defaults: {env_vars}')

    # Set environment variables if provided
    if env_vars:
        for key, value in env_vars.items():
            os.environ[key] = value

    # Execute each shell script
    for script in shell_scripts:
        result: subprocess.CompletedProcess
        try:
            print(f'running script {script}')
            # Change directory to where the script is located
            os.chdir(shell_scripts_path)
            print(f'changed directory {os.getcwd()}')
            result = subprocess.run(['bash', script], capture_output=True, text=True, check=True)
            print("Output:")
            print(result.stdout)
            print(f"Shell script '{script}' executed successfully.")
        except subprocess.CalledProcessError as e:
            print(
                f"Shell script '{script}' failed with return code: {e.returncode}! \n {e.stderr} \n Output: \n {e.stdout} ")
            exit(e.returncode)
        except Exception as e:
            print("Unexpected error occurred:", e)
        finally:
            # Return to the original working directory
            os.chdir(original_dir)


# Temporary method for Sharding Setup.
def mongo_sharding_setup(script_filename, args):
    # Get script directory
    script_path = os.path.abspath(sys.argv[0])
    script_dir = os.path.dirname(script_path)
    scripts_path = script_dir + "/../pmm_psmdb-pbm_setup/"

    # Temporary shell script filename
    shell_file_path = scripts_path + script_filename

    # Temporary docker compose filename
    compose_filename = f'docker-compose-sharded-no-server.yaml'
    compose_file_path = scripts_path + compose_filename

    # Create pmm-qa n/w used in workaround
    result = subprocess.run(['docker', 'network', 'inspect', 'pmm-qa'], capture_output=True)
    if not result:
        subprocess.run(['docker', 'network', 'create', 'pmm-qa'])

    no_server = True
    # Add workaround (copy files) till sharding only support is ready.
    try:
        if no_server:
            # Search & Replace content in the temporary compose files
            subprocess.run(
                ['cp', f'{scripts_path}docker-compose-sharded.yaml', f'{compose_file_path}'])
            admin_password = os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin'
            subprocess.run(['sed', '-i', f's/password/{admin_password}/g', f'{compose_file_path}'])
            subprocess.run(['sed', '-i', '/- test-network/a\\      - pmm-qa', f'{compose_file_path}'])
            subprocess.run(['sed', '-i', '/driver: bridge/a\\  pmm-qa:\\n    name: pmm-qa\\n    external: true',
                            f'{compose_file_path}'])
            subprocess.run(
                ['sed', '-i', '/^  pmm-server:/,/^$/{/^  test:/!d}', f'{compose_file_path}'])
            with open(f'{compose_file_path}', 'a') as f:
                subprocess.run(['echo', '   backups: null'], stdout=f, text=True, check=True)

            # Search replace content in the temporary shell files
            subprocess.run(['cp', f'{scripts_path}start-sharded.sh', f'{shell_file_path}'])
            subprocess.run(['sed', '-i', '/echo "configuring pmm-server/,/sleep 30/d',
                            f'{shell_file_path}'])
            subprocess.run(['sed', '-i', f's/docker-compose-sharded.yaml/{compose_filename}/g',
                            f'{shell_file_path}'])
    except subprocess.CalledProcessError as e:
        print(f"Error occurred: {e}")


def get_latest_psmdb_version(psmdb_version):
    if psmdb_version == "latest":
        return psmdb_version

    # Define the data to be sent in the POST request
    data = {
        'version': f'percona-server-mongodb-{psmdb_version}'
    }

    # Make the POST request
    response = requests.post('https://www.percona.com/products-api.php', data=data)

    # Extract the version number using regular expression
    version_number = [v.split('|')[0] for v in re.findall(r'value="([^"]*)"', response.text)]


    if version_number:
        # Sort the version numbers and extract the latest one
        latest_version = sorted(version_number, key=lambda x: tuple(map(int, x.split('-')[-1].split('.'))))[-1]

        # Extract the full version number
        major_version = latest_version.split('-')[3].strip()  # Trim spaces
        minor_version = latest_version.split('-')[4].strip()  # Trim spaces

        return f'{major_version}-{minor_version}'
    else:
        return None


def setup_psmdb(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running...Exiting")
        exit(1)

    # Gather Version details
    psmdb_version = os.getenv('PSMDB_VERSION') or get_latest_psmdb_version(db_version) or \
                    database_configs[db_type]["versions"][-1]

    # Handle port address for external or internal address
    server_hostname = container_name
    port = 8443

    if args.pmm_server_ip:
        port = 443
        server_hostname = args.pmm_server_ip

    server_address = f'{server_hostname}:{port}'

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PSMDB_VERSION': psmdb_version,
        'PMM_SERVER_CONTAINER_ADDRESS': server_address,
        'PSMDB_CONTAINER': 'psmdb_pmm_' + str(psmdb_version),
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_CLIENT_VERSION': client_version,
        'COMPOSE_PROFILES': get_value('COMPOSE_PROFILES', db_type, args, db_config),
        'MONGO_SETUP_TYPE': get_value('SETUP_TYPE', db_type, args, db_config),
        'MONGO_STORAGE_ENGINE': get_value('STORAGE_ENGINE', db_type, args, db_config),
        'OL_VERSION': get_value('OL_VERSION', db_type, args, db_config),
        'GSSAPI': get_value('GSSAPI', db_type, args, db_config),
        'TESTS': 'no',
        'CLEANUP': 'no',
        'CLIENT_DEBUG': f'{args.client_debug}',
    }

    shell_scripts = []
    scripts_folder = "pmm_psmdb-pbm_setup"
    setup_type = get_value('SETUP_TYPE', db_type, args, db_config).lower()

    if setup_type in ("pss", "psa"):
        shell_scripts = ['start-rs-only.sh']
    elif setup_type in ("shards", "sharding"):
        shell_scripts = ['start-sharded-no-server.sh']
        mongo_sharding_setup(shell_scripts[0], args)

    # Execute shell scripts
    if not shell_scripts == []:
        execute_shell_scripts(shell_scripts, scripts_folder, env_vars, args)


# Temporary method for Mongo SSL Setup.
def mongo_ssl_setup(script_filename, args):
    # Get script directory
    script_path = os.path.abspath(sys.argv[0])
    script_dir = os.path.dirname(script_path)
    scripts_path = script_dir + "/../pmm_psmdb_diffauth_setup/"

    # Temporary shell script filename
    shellscript_file_path = scripts_path + script_filename

    # Temporary docker compose filename
    compose_filename = f'docker-compose-psmdb.yml'
    compose_file_path = scripts_path + compose_filename
    compose_file_folder = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/pmm_psmdb_diffauth_setup/'

    # Create pmm-qa n/w used in workaround
    result = subprocess.run(['docker', 'network', 'inspect', 'pmm-qa'], capture_output=True)
    if not result:
        subprocess.run(['docker', 'network', 'create', 'pmm-qa'])

    no_server = True
    # Add workaround (copy files) till sharding only support is ready.
    try:
        if no_server:
            shutil.copy(compose_file_folder + 'docker-compose-pmm-psmdb.yml', compose_file_folder + compose_filename)
            print(f'File location is: {compose_file_folder + compose_filename}')
            admin_password = os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin'
            with open(compose_file_folder + compose_filename, 'r') as f:
                data = yaml.safe_load(f)

            if 'services' in data and 'pmm-server' in data['services']:
                del data['services']['pmm-server']

            if 'services' in data and 'kerberos' in data['services']:
                del data['services']['kerberos']

            if 'pmm-agent setup 2' in data:
                data = data.replace('pmm-agent setup 2', 'pmm-agent setup --server-insecure-tls 2')

            for service in data.get('services', {}).values():
                networks = service.get('networks', [])
                if isinstance(networks, list):
                    if 'pmm-qa' not in networks:
                        networks.append('pmm-qa')
                    service['networks'] = networks
                elif isinstance(networks, dict):
                    networks['pmm-qa'] = {}
                else:
                    service['networks'] = ['pmm-qa']

            # Ensure the network is declared globally
            if 'networks' not in data:
                data['networks'] = {}

            data['networks']['pmm-qa'] = {'external': True, 'name': 'pmm-qa'}

            psmdb_service = data.get('services', {}).get('psmdb-server')
            if psmdb_service:
                env = psmdb_service.get('environment', [])

                # If environment is a list (common in Docker Compose)
                if isinstance(env, list):
                    for i, entry in enumerate(env):
                        if entry.startswith('PMM_AGENT_SERVER_PASSWORD='):
                            env[i] = f'PMM_AGENT_SERVER_PASSWORD={admin_password}'
                            break
                    else:
                        env.append(f'PMM_AGENT_SERVER_PASSWORD={admin_password}')
                    psmdb_service['environment'] = env

                # If environment is a dict (less common but valid)
                elif isinstance(env, dict):
                    env['PMM_AGENT_SERVER_PASSWORD'] = admin_password
                    psmdb_service['environment'] = env

                depends_on = psmdb_service.get('depends_on')
                print(f'Service depends on: {depends_on}')
                if 'pmm-server' in depends_on or 'kerberos' in depends_on:
                    del psmdb_service['depends_on']

            # Save it back
            with open(compose_file_path, 'w') as f:
                yaml.dump(data, f, sort_keys=False, default_flow_style=False)
    except yaml.YAMLError as e:
        print(f"Error occurred: {e}")

    try:
        subprocess.run(['sed', '-i', f's/docker-compose-pmm-psmdb.yml/{compose_filename}/g', f'{shellscript_file_path}'])
    except subprocess.CalledProcessError as e:
        print(f"Error occurred: {e}")

def setup_ssl_psmdb(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running...Exiting")
        exit(1)

    # Gather Version details
    psmdb_version = os.getenv('PSMDB_VERSION') or get_latest_psmdb_version(db_version) or \
                    database_configs[db_type]["versions"][-1]

    # Handle port address for external or internal address
    server_hostname = container_name
    port = 8443

    if args.pmm_server_ip:
        port = 443
        server_hostname = args.pmm_server_ip

    server_address = f'{server_hostname}:{port}'

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PSMDB_VERSION': psmdb_version,
        'PMM_SERVER_CONTAINER_ADDRESS': server_address,
        'PSMDB_CONTAINER': 'psmdb_pmm_' + str(psmdb_version),
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_CLIENT_VERSION': client_version,
        'COMPOSE_PROFILES': get_value('COMPOSE_PROFILES', db_type, args, db_config),
        'MONGO_SETUP_TYPE': get_value('SETUP_TYPE', db_type, args, db_config),
        'TESTS': 'no',
        'CLEANUP': 'no'
    }

    scripts_folder = "pmm_psmdb_diffauth_setup"

    shell_scripts = ['test-auth.sh']
    mongo_ssl_setup(shell_scripts[0], args)

    # Execute shell scripts
    if not shell_scripts == []:
        execute_shell_scripts(shell_scripts, scripts_folder, env_vars, args)


def setup_ssl_mlaunch(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running...Exiting")
        exit(1)

        # Gather Version details
    psmdb_version = os.getenv('PSMDB_VERSION') or db_version or \
                    database_configs[db_type]["versions"][-1]

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'MONGODB_VERSION': psmdb_version,
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'MONGODB_SSL_CONTAINER': 'psmdb_ssl_pmm_' + str(psmdb_version),
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3'
    }

    # Ansible playbook filename
    playbook_filename = 'tls-ssl-setup/mlaunch_tls_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_pxc_proxysql(db_type, db_version=None, db_config=None, args=None):
    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    pxc_version = os.getenv('PXC_VERSION') or db_version or database_configs[db_type]["versions"][-1]
    proxysql_version = os.getenv('PROXYSQL_VERSION') or database_configs["PROXYSQL"]["versions"][-1]

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PXC_NODES': '3',
        'PXC_VERSION': pxc_version,
        'PROXYSQL_VERSION': proxysql_version,
        'PXC_TARBALL': get_value('TARBALL', db_type, args, db_config),
        'PROXYSQL_PACKAGE': get_value('PACKAGE', 'PROXYSQL', args, db_config),
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'PXC_CONTAINER': 'pxc_proxysql_pmm_' + str(pxc_version),
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'QUERY_SOURCE': get_value('QUERY_SOURCE', db_type, args, db_config),
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'CLIENT_DEBUG': args.client_debug,
    }

    # Ansible playbook filename
    playbook_filename = 'pxc_proxysql_setup.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)


def setup_dockerclients(db_type, db_version=None, db_config=None, args=None):
    # Define environment variables for shell script
    env_vars = {}

    # Shell script filename
    shell_scripts = ['setup_docker_client_images.sh']
    shell_scripts_path = 'pmm_qa'

    # Call the function to run the setup_docker_client_images script
    execute_shell_scripts(shell_scripts, shell_scripts_path, env_vars, args)

def setup_valkey(db_type, db_version=None, db_config=None, args=None):

    # Check if PMM server is running
    container_name = get_running_container_name()
    if container_name is None and args.pmm_server_ip is None:
        print(f"Check if PMM Server is Up and Running..Exiting")
        exit()

    # Gather Version details
    valkey_version = os.getenv('VALKEY_VERSION') or db_version or database_configs[db_type]["versions"][-1]
    setup_type_value = get_value('SETUP_TYPE', db_type, args, db_config).lower()

    # Define environment variables for playbook
    client_version = normalize_client_version(get_value('CLIENT_VERSION', db_type, args, db_config))
    env_vars = {
        'PMM_SERVER_IP': args.pmm_server_ip or container_name or '127.0.0.1',
        'VALKEY_VERSION': valkey_version,
        'CLIENT_VERSION': client_version,
        'ADMIN_PASSWORD': os.getenv('ADMIN_PASSWORD') or args.pmm_server_password or 'admin',
        'PMM_QA_GIT_BRANCH': os.getenv('PMM_QA_GIT_BRANCH') or 'v3',
        'SETUP_TYPE': setup_type_value,
        'ENCRYPTED_CLIENT_CONFIG': get_value('ENCRYPTED_CLIENT_CONFIG', db_type, args, db_config),
        'CLIENT_DEBUG': args.client_debug,
    }

    # Choose playbook based on SETUP_TYPE (cluster is default; sentinel only when explicitly requested)
    if setup_type_value in ("sentinel", "sentinels"):
        playbook_filename = 'valkey/valkey-sentinel.yml'
    else:
        playbook_filename = 'valkey/valkey-cluster.yml'

    # Call the function to run the Ansible playbook
    run_ansible_playbook(playbook_filename, env_vars, args)

# Set up databases based on arguments received
def setup_database(db_type, db_version=None, db_config=None, args=None):
    if args.verbose:
        if db_version:
            print(f"Setting up {db_type} version {db_version}", end=" ")
        else:
            print(f"Setting up {db_type}", end=" ")

        if db_config:
            print(f"with configuration: {db_config}")
        else:
            print()

    if db_type == 'MYSQL':
        setup_mysql(db_type, db_version, db_config, args)
    elif db_type == 'PS':
        setup_ps(db_type, db_version, db_config, args)
    elif db_type == 'PGSQL':
        setup_pgsql(db_type, db_version, db_config, args)
    elif db_type == 'PDPGSQL':
        setup_pdpgsql(db_type, db_version, db_config, args)
    elif db_type == 'PSMDB':
        setup_psmdb(db_type, db_version, db_config, args)
    elif db_type == 'PXC':
        setup_pxc_proxysql(db_type, db_version, db_config, args)
    elif db_type == 'HAPROXY':
        setup_haproxy(db_type, db_version, db_config, args)
    elif db_type == 'EXTERNAL':
        setup_external(db_type, db_version, db_config, args)
    elif db_type == 'DOCKERCLIENTS':
        setup_dockerclients(db_type, db_version, db_config, args)
    elif db_type == 'SSL_MYSQL':
        setup_ssl_mysql(db_type, db_version, db_config, args)
    elif db_type == 'SSL_PDPGSQL':
        setup_ssl_pdpgsql(db_type, db_version, db_config, args)
    elif db_type == 'SSL_PSMDB':
        setup_ssl_psmdb(db_type, db_version, db_config, args)
    elif db_type == 'MLAUNCH_PSMDB':
        setup_mlaunch_psmdb(db_type, db_version, db_config, args)
    elif db_type == 'MLAUNCH_MODB':
        setup_mlaunch_modb(db_type, db_version, db_config, args)
    elif db_type == 'SSL_MLAUNCH':
        setup_ssl_mlaunch(db_type, db_version, db_config, args)
    elif db_type == 'BUCKET':
        setup_bucket(db_type, db_version, db_config, args)
    elif db_type == 'VALKEY':
        setup_valkey(db_type, db_version, db_config, args)
    else:
        print(f"Database type {db_type} is not recognised, Exiting...")
        exit(1)


def setup_bucket(db_type, db_version=None, db_config=None, args=None):
    print("Setting up bucket")
    bucket_names_value = get_value('BUCKET_NAMES', db_type, args, db_config).lower().replace('"', '').split(';')
    print(bucket_names_value)
    env_vars = {
        'BUCKETS': bucket_names_value
    }

    run_ansible_playbook('tasks/create_minio_container.yml', env_vars, args)


# Main
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='PMM Framework Script to setup Multiple Databases',
                                     usage=argparse.SUPPRESS)
    # Add subparsers for database types
    subparsers = parser.add_subparsers(dest='database_type', help='Choose database type above')

    # Add subparser for each database type dynamically
    for db_type, options in database_configs.items():
        db_parser = subparsers.add_parser(db_type.lower())
        for config, value in options['configurations'].items():
            db_parser.add_argument(f'{config}', metavar='', help=f'{config} for {db_type} (default: {value})')

    # Add arguments
    parser.add_argument("--database", action='append', nargs=1,
                        metavar='db_name[,=version][,option1=value1,option2=value2,...]')
    parser.add_argument("--pmm-server-ip", nargs='?', help='PMM Server IP to connect')
    parser.add_argument("--pmm-server-password", nargs='?', help='PMM Server password')
    parser.add_argument("--client-version", nargs='?', help='PMM Client version/tarball')
    parser.add_argument("--verbose", "--v", action='store_true', help='Display verbose information')
    parser.add_argument("--verbosity-level", nargs='?', help='Display verbose information level')
    parser.add_argument("--client-debug", action='store_true', help='Start PMM client with debug option')
    args = parser.parse_args()

    print(f'Args are: ${args}')

    if args.verbosity_level is not None and not args.verbosity_level.isnumeric():
        print(f"Option {args.verbosity_level} is invalid verbosity level option, please provide number 1-5")
        exit(1)

    # Parse arguments
    try:
        for db in args.database:
            db_parts = db[0].split(',')
            configs = db_parts[0:] if len(db_parts) > 1 else db[0:]
            db_type = None
            db_version = None
            db_config = {}

            if configs:
                for config in configs:
                    if "=" in config:
                        key, value = config.split('=')
                    else:
                        key, value = config, None

                    # Convert all arguments/options only to uppercase
                    key = key.upper()

                    try:
                        if key in database_configs:
                            db_type = key
                            if "versions" in database_configs[db_type]:
                                if value in database_configs[db_type]["versions"]:
                                    db_version = value
                                else:
                                    if args.verbose:
                                        print(
                                            f"Value {value} is not recognised for Option {key}, will be using Default value")
                        elif key in database_configs[db_type]["configurations"]:
                            db_config[key] = value
                        else:
                            if args.verbose:
                                print(f"Option {key} is not recognised, will be using default option")
                                continue
                    except KeyError as e:
                        print(f"Option {key} is not recognised with error {e}, Please check and try again")
                        parser.print_help()
                        exit(1)
                # Set up the specified databases
                setup_database(db_type, db_version, db_config, args)
    except argparse.ArgumentError as e:
        print(f"Option is not recognised:", e)
        parser.print_help()
        exit(1)
    except Exception as e:
        print("An unexpected error occurred:", e)
        parser.print_help()
        exit(1)
