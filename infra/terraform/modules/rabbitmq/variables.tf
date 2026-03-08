variable "namespace" {
  type        = string
  description = "Kubernetes namespace for RabbitMQ"
}

variable "password" {
  type        = string
  sensitive   = true
  description = "RabbitMQ password"
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
  description = "Bitnami RabbitMQ chart version"
  default     = "14.0.0"
}
