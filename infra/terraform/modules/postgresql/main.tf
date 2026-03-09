resource "helm_release" "postgresql" {
  name       = "postgresql"
  namespace  = var.namespace
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "postgresql"
  version    = "13.2.24"
  timeout    = 900
  wait       = false

  values = [<<-YAML
    architecture: standalone
    auth:
      postgresPassword: "${var.admin_password}"
      database: "${var.database_name}"
    primary:
      persistence:
        enabled: true
        storageClass: local-path
        size: ${var.storage_size}
  YAML
  ]
}
