output "instance_id" {
  value = linode_instance.runner.id
}

output "ip_address" {
  value = element(tolist(linode_instance.runner.ipv4), 0)
}

output "label" {
  value = local.label
}

output "ssh_private_key_path" {
  value = local_sensitive_file.ssh_private_key.filename
}
