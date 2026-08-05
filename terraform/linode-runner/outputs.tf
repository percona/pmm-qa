output "instance_id" {
  value = linode_instance.runner.id
}

output "ip_address" {
  value = element(tolist(linode_instance.runner.ipv4), 0)
}

output "label" {
  value = local.label
}

output "exec_token" {
  value     = random_password.exec_token.result
  sensitive = true
}
