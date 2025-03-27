import subprocess
import sys

BAD_STATES = ["Waiting", "Done", "Unknown", "Initialization Error", "Stopping"]

# Container name patterns and labels
CONTAINER_PATTERNS = [
    ("ps_pmm_", "ps"),
    ("pgsql_pgss_pmm", "pgsql"),
    ("rs101", "first mongo"),
    ("rs102", "second mongo"),
    ("rs103", "third mongo"),
]

# Get expected version from command-line arguments
EXPECTED_VERSION = sys.argv[1].strip() if len(sys.argv) > 1 else None
assert EXPECTED_VERSION, "❌ Expected version must be passed as the first argument."

errors = []

def run_command(cmd, shell=False):
    """Run a command and return its output as lines."""
    result = subprocess.run(cmd, capture_output=True, text=True, shell=shell)
    return result.stdout.splitlines()


def get_container_name(pattern):
    """Find and return the container name that matches a given pattern."""
    containers = run_command(["docker", "ps", "-a"])
    for line in containers:
        if pattern in line:
            return line.split()[-1]  # container name is usually the last column
    return None


def contains_bad_state(lines):
    """Check if any line contains a bad PMM agent state."""
    return any(state in line for line in lines for state in BAD_STATES)


def check_pmm_output(container_name, label, command):
    """Run pmm-admin command and check for bad states."""
    output = run_command(["docker", "exec", container_name, "pmm-admin", command])
    if contains_bad_state(output):
        errors.append(f"❌ Bad state found in {label} container ({command})")
    return output


def check_local_pmm_output(command, label):
    """Run pmm-admin command locally and check for bad states."""
    output = run_command(["pmm-admin", command])
    if contains_bad_state(output):
        errors.append(f"❌ Bad state found in local PMM client ({label})")
    return output


def get_version_from_output(lines, keyword, label):
    """Extract version for a given keyword from a list of lines."""
    for line in lines:
        if keyword in line:
            parts = line.split()
            if len(parts) >= 3:
                return parts[2]
    errors.append(f"❌ Could not determine version for {keyword} in {label}")
    return None


def main():
    print("🔍 Validating PMM containers and local PMM client...\n")

    # Check containers
    for pattern, label in CONTAINER_PATTERNS:
        container_name = get_container_name(pattern)
        assert container_name, f"❌ Could not find container matching pattern '{pattern}'"
        print(f"✅ Found container '{container_name}' for {label}")

        # Check status and list
        status_output = check_pmm_output(container_name, label, "status")
        list_output = check_pmm_output(container_name, label, "list")

        # Version checks inside container
        admin_version = get_version_from_output(status_output, "pmm-admin", label)
        agent_version = get_version_from_output(status_output, "pmm-agent", label)

        if admin_version and admin_version != EXPECTED_VERSION:
            errors.append(f"❌ PMM admin version in {label} container mismatch: expected {EXPECTED_VERSION}, got {admin_version}")
        if agent_version and agent_version != EXPECTED_VERSION:
            errors.append(f"❌ PMM agent version in {label} container mismatch: expected {EXPECTED_VERSION}, got {agent_version}")
        if admin_version and agent_version and admin_version != agent_version:
            errors.append(f"❌ Version mismatch in {label} container: pmm-admin={admin_version}, pmm-agent={agent_version}")
        else:
            print(f"✅ Version checks passed in {label} container")

    print("\n✅ All container checks done.\n")

    # Check local PMM client
    local_status_output = check_local_pmm_output("status", "status")
    check_local_pmm_output("list", "list")

    local_admin_version = get_version_from_output(local_status_output, "pmm-admin", "local client")
    local_agent_version = get_version_from_output(local_status_output, "pmm-agent", "local client")

    assert local_admin_version, "❌ Could not determine local pmm-admin version"
    assert local_agent_version, "❌ Could not determine local pmm-agent version"

    if local_admin_version != EXPECTED_VERSION:
        errors.append(f"❌ Local PMM admin version mismatch: expected {EXPECTED_VERSION}, got {local_admin_version}")
    if local_agent_version != EXPECTED_VERSION:
        errors.append(f"❌ Local PMM agent version mismatch: expected {EXPECTED_VERSION}, got {local_agent_version}")
    if local_admin_version != local_agent_version:
        errors.append(f"❌ Local version mismatch: pmm-admin={local_admin_version}, pmm-agent={local_agent_version}")
    else:
        print("✅ Local PMM admin and agent versions match")

    print("\n📦 Final Results:\n")
    if errors:
        for err in errors:
            print(err)
        raise AssertionError("🚫 Validation failed. See errors above.")
    else:
        print("🎉 All checks passed! PMM containers and local client are healthy and versions are correct.")


if __name__ == "__main__":
    main()
