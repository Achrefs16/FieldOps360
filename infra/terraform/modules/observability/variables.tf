variable "namespace" {
  type        = string
  description = "Kubernetes namespace for observability stack"
}

variable "grafana_password" {
  type        = string
  sensitive   = true
  description = "Grafana admin password"
}

variable "grafana_root_url" {
  type        = string
  description = "Grafana root URL for host-based ingress. Override with your VM IP/domain if needed."
  default     = "https://grafana.fieldops.local"
}

# --- Chart Versions ---
variable "prometheus_chart_version" {
  type    = string
  default = "65.1.0"
}

variable "loki_chart_version" {
  type    = string
  default = "6.6.2"
}

variable "promtail_chart_version" {
  type    = string
  default = "6.16.4"
}

variable "jaeger_chart_version" {
  type    = string
  default = "3.3.1"
}

# --- Prometheus Resources ---
variable "prometheus_storage_size" {
  type    = string
  default = "5Gi"
}

variable "prometheus_retention" {
  type    = string
  default = "7d"
}

variable "prometheus_cpu_request" {
  type    = string
  default = "100m"
}

variable "prometheus_memory_request" {
  type    = string
  default = "128Mi"
}

variable "prometheus_memory_limit" {
  type    = string
  default = "512Mi"
}

# --- Grafana Resources ---
variable "grafana_cpu_request" {
  type    = string
  default = "100m"
}

variable "grafana_memory_request" {
  type    = string
  default = "128Mi"
}

variable "grafana_memory_limit" {
  type    = string
  default = "256Mi"
}

# --- Loki Resources ---
variable "loki_storage_size" {
  type    = string
  default = "5Gi"
}

variable "loki_cpu_request" {
  type    = string
  default = "50m"
}

variable "loki_memory_request" {
  type    = string
  default = "128Mi"
}

variable "loki_memory_limit" {
  type    = string
  default = "256Mi"
}

# --- Jaeger Resources ---
variable "jaeger_cpu_request" {
  type    = string
  default = "100m"
}

variable "jaeger_memory_request" {
  type    = string
  default = "256Mi"
}

variable "jaeger_memory_limit" {
  type    = string
  default = "256Mi"
}

# --- Feature Flags ---
variable "enable_traefik_metrics" {
  type        = bool
  description = "Enable Traefik Prometheus metrics scraping"
  default     = true
}
