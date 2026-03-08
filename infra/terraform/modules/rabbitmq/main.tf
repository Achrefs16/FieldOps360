resource "helm_release" "rabbitmq" {
  name       = "rabbitmq"
  namespace  = var.namespace
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "rabbitmq"
  version    = "12.15.0"
  timeout    = 900
  wait       = false

  values = [<<-YAML
    global:
      security:
        allowInsecureImages: true
    image:
      registry: docker.io
      repository: rabbitmq
      tag: 3-management
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
