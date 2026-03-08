variable "namespace" {
  type        = string
  description = "Kubernetes namespace for Redis"
}

variable "password" {
  type        = string
  sensitive   = true
  description = "Redis password"
}

variable "storage_size" {
  type        = string
  description = "Persistent volume size"
  default     = "1Gi"
}

variable "cpu_request" {
  type        = string
  description = "CPU request"
  default     = "25m"
}

variable "memory_request" {
  type        = string
  description = "Memory request"
  default     = "64Mi"
}

variable "memory_limit" {
  type        = string
  description = "Memory limit"
  default     = "256Mi"
}

variable "chart_version" {
  type        = string
  description = "Bitnami Redis chart version (leave empty for latest)"
  default     = null
}
