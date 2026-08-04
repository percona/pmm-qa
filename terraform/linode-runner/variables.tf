variable "run_id" {
  type        = string
  description = "Unique identifier for this ephemeral run (e.g. a ticket key or ISO timestamp slug). Used in the instance label and tags, and by the on-box self-destruct timer to find its own instance by tag."
}

variable "linode_token" {
  type        = string
  sensitive   = true
  description = "Same value as the LINODE_TOKEN env var the provider itself reads. Passed through separately (via TF_VAR_linode_token, never a -var on the command line) so it can be templated into cloud-init for the self-destruct timer, which needs to delete its own instance without any external process. Ends up in this run's local tfstate, same as the generated SSH key already does -- both are gitignored and local-only."
}

variable "role" {
  type        = string
  description = "Which agent workflow provisioned this box: test-runner, test-healer, or an ad-hoc smoke test."
  default     = "unknown"
}

variable "region" {
  type        = string
  description = "Linode region."
  default     = "us-ord"
}

variable "instance_type" {
  type        = string
  description = "Linode plan. g6-standard-6 (12 GB / 4 CPU) comfortably runs PMM Server plus a couple of monitored database containers."
  default     = "g6-standard-6"
}

variable "ttl_hours" {
  type        = number
  description = "How long the instance lives before it deletes itself via an on-box systemd timer (see cloud-init.yaml.tftpl) -- no external reaper process involved. Normal cleanup is still down.sh at the end of the agent workflow; this is the backstop for a run nobody explicitly tore down. Extend a live instance with extend.sh instead of recreating it."
  default     = 24
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "CIDR allowed to reach SSH (22) and the PMM UI (443) on the instance. Tighten this if you have a stable egress IP."
  default     = "0.0.0.0/0"
}
