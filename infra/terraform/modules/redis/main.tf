resource "helm_release" "redis" {
  name       = "redis"
  namespace  = var.namespace
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "redis"
  version    = var.chart_version
  timeout    = 900
  wait       = true

  values = [<<-YAML
    architecture: standalone
    auth:
      password: "${var.password}"
    master:
      persistence:
        storageClass: local-path
        size: ${var.storage_size}
      resources:
        requests:
          cpu: ${var.cpu_request}
          memory: ${var.memory_request}
        limits:
          memory: ${var.memory_limit}
  YAML
  ]
}
