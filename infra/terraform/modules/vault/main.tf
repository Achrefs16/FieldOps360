resource "helm_release" "vault" {
  name       = "vault"
  namespace  = var.namespace
  repository = "https://helm.releases.hashicorp.com"
  chart      = "vault"
  version    = var.chart_version
  timeout    = 900
  wait       = true

  values = [<<-YAML
    server:
      ha:
        enabled: true
        replicas: ${var.replicas}
      dataStorage:
        storageClass: local-path
        size: ${var.storage_size}
      standalone:
        enabled: false
    ui:
      enabled: true
    injector:
      enabled: true
  YAML
  ]
}
