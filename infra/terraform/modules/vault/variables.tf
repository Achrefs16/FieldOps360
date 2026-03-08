variable "namespace" {
  type = string
}

variable "replicas" {
  type    = number
  default = 3
}

variable "storage_size" {
  type    = string
  default = "5Gi"
}

variable "chart_version" {
  type    = string
  default = "0.27.0"
}
