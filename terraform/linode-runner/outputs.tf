output "instance_id" {
  value = linode_instance.runner.id
}

output "ip_address" {
  value = element(tolist(linode_instance.runner.ipv4), 0)
}

output "label" {
  value = local.label
}

output "run_tag" {
  value = local.run_tag
}

output "exec_token" {
  value     = random_password.exec_token.result
  sensitive = true
}

output "exec_cert_pem" {
  value = tls_self_signed_cert.exec.cert_pem
}
