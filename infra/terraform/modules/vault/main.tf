resource "helm_release" "vault" {
  name       = "vault"
  namespace  = var.namespace
  repository = "https://helm.releases.hashicorp.com"
  chart      = "vault"
  version    = var.chart_version
  timeout    = 900
  wait       = false

  values = [<<-YAML
    server:
      ha:
        enabled: ${var.replicas > 1 ? true : false}
        replicas: ${var.replicas}
      dataStorage:
        storageClass: local-path
        size: ${var.storage_size}
      standalone:
        enabled: ${var.replicas > 1 ? false : true}
    ui:
      enabled: true
    injector:
      enabled: true
  YAML
  ]
}
