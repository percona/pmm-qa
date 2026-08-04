variable "run_id" {
  type        = string
  description = "Unique identifier for this ephemeral run (e.g. a ticket key or ISO timestamp slug). Used in the instance label and tags so the reaper and humans can trace ownership."
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
  description = "Advisory max lifetime recorded as a tag for the reaper safety net (terraform/linode-runner/reap.sh). Normal cleanup is down.sh at the end of the agent workflow -- this is only the backstop for an abandoned run."
  default     = 4
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "CIDR allowed to reach SSH (22) and the PMM UI (443) on the instance. Tighten this if you have a stable egress IP."
  default     = "0.0.0.0/0"
}
