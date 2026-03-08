resource "helm_release" "postgresql" {
  name       = "postgresql"
  namespace  = var.namespace
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "postgresql"
  version    = var.chart_version
  timeout    = 900
  wait       = true

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
