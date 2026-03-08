variable "namespace" {
  type = string
}

variable "admin_password" {
  type      = string
  sensitive = true
}

variable "database_name" {
  type    = string
  default = "fieldops_platform"
}

variable "storage_size" {
  type    = string
  default = "1Gi"
}

variable "chart_version" {
  type    = string
  default = null
}
