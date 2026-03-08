variable "namespace" {
  type        = string
  description = "Kubernetes namespace for MinIO"
}

variable "access_key" {
  type        = string
  sensitive   = true
  description = "MinIO root user / access key"
}

variable "secret_key" {
  type        = string
  sensitive   = true
  description = "MinIO root password / secret key"
}

variable "storage_size" {
  type        = string
  description = "Persistent volume size"
  default     = "2Gi"
}

variable "cpu_request" {
  type        = string
  description = "CPU request"
  default     = "50m"
}

variable "memory_request" {
  type        = string
  description = "Memory request"
  default     = "128Mi"
}

variable "memory_limit" {
  type        = string
  description = "Memory limit"
  default     = "512Mi"
}

variable "chart_version" {
  type        = string
  description = "Bitnami MinIO chart version"
  default     = "14.0.0"
}

variable "create_buckets" {
  type        = bool
  description = "Create default buckets (uploads, backups, terraform-state)"
  default     = true
}
