resource "helm_release" "rabbitmq" {
  name       = "rabbitmq"
  namespace  = var.namespace
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "rabbitmq"
  timeout    = 900
  wait       = true

  values = [<<-YAML
    auth:
      username: fieldops
      password: "${var.password}"
    persistence:
      storageClass: local-path
      size: ${var.storage_size}
    resources:
      requests:
        cpu: ${var.cpu_request}
        memory: ${var.memory_request}
      limits:
        memory: ${var.memory_limit}
    service:
      type: ClusterIP
  YAML
  ]
}
