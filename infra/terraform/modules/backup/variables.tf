variable "namespace" {
  type = string
}

variable "schedule" {
  type    = string
  default = "0 2 * * *"
}
