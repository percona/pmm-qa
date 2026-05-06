import os
import re
import ansible_runner
import sys
import subprocess


def resolve_shard_namespace():
    raw = os.getenv('SHARD_NAMESPACE') or ''
    sanitized = re.sub(r'[^A-Za-z0-9_-]', '', raw)
    return sanitized.lower()


def apply_shard_namespace(env_vars):
    ns = resolve_shard_namespace()
    if not ns:
        return env_vars

    suffix = f'_{ns}'
    for key, value in list(env_vars.items()):
        if key.endswith('_CONTAINER') and isinstance(value, str) and value:
            if not value.endswith(suffix):
                env_vars[key] = f'{value}{suffix}'

    env_vars['SHARD_NAMESPACE'] = ns
    return env_vars


def run_ansible_playbook(playbook_filename, env_vars, args):
    env_vars = apply_shard_namespace(env_vars)

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

