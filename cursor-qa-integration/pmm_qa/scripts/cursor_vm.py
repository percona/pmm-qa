import os


def _truthy(value: str | None) -> bool:
    return (value or "").lower() in ("1", "true", "yes")


def is_cursor_vm() -> bool:
    return _truthy(os.getenv("IS_CURSOR_VM")) or _truthy(os.getenv("PMM_QA_NO_SYSTEMD"))


def apply_cursor_vm_env() -> None:
    if is_cursor_vm():
        os.environ["IS_CURSOR_VM"] = "1"
        os.environ["PMM_QA_NO_SYSTEMD"] = "1"


def default_pmm_server_ip(container_name: str | None = None) -> str:
    if container_name:
        return container_name
    return "pmm-server" if is_cursor_vm() else "127.0.0.1"


def resolve_pmm_server_ip(args, container_name: str | None = None) -> str:
    if args.pmm_server_ip:
        return args.pmm_server_ip
    return default_pmm_server_ip(container_name)
