# FieldOps360 - Variables

variable "environment" {
  description = "Environment: dev, staging, prod"
  type        = string
}

variable "kubeconfig_path" {
  description = "K3s kubeconfig path"
  type        = string
  default     = "/etc/rancher/k3s/k3s.yaml"
}

# --- Passwords ---
variable "db_password" {
  type      = string
  sensitive = true
}

variable "redis_password" {
  type      = string
  sensitive = true
}

variable "rabbitmq_password" {
  type      = string
  sensitive = true
}

variable "minio_access_key" {
  type      = string
  sensitive = true
}

variable "minio_secret_key" {
  type      = string
  sensitive = true
}

# --- Storage ---
variable "db_storage_size" {
  type    = string
  default = "1Gi"
}

variable "minio_storage_size" {
  type    = string
  default = "2Gi"
}
