import os
import ansible_runner
import sys
import subprocess

def run_ansible_playbook(playbook_filename, env_vars, args):
    # Get Script Dir
    script_path = os.path.abspath(sys.argv[0])
    script_dir = os.path.dirname(script_path)
    playbook_path = script_dir + "/" + playbook_filename
    verbosity_level = 1
    # Install community docker plugin for ansible
    subprocess.run(["ansible-galaxy", "collection", "install", "community.docker"], capture_output=True, text=True)
    if args.verbosity_level is not None:
        verbosity_level = int(args.verbosity_level)

    if args.verbose:
        print(f'Options set after considering Defaults: {env_vars}')

    r = ansible_runner.run(
        private_data_dir=script_dir,
        playbook=playbook_path,
        inventory='127.0.0.1',
        cmdline='-l localhost, --connection=local',
        envvars=env_vars,
        suppress_env_files=True,
        verbosity=verbosity_level,
    )

    print(f'{playbook_filename} playbook execution {r.status}')

    if r.rc != 0:
        exit(1)

