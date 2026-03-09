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
    readinessProbe:
      enabled: true
      failureThreshold: 6
      initialDelaySeconds: 20
      periodSeconds: 10
      successThreshold: 1
      timeoutSeconds: 5
      exec:
        command:
          - /bin/bash
          - -ec
          - rabbitmq-diagnostics -q check_running && rabbitmq-diagnostics -q check_local_alarms
    livenessProbe:
      enabled: true
      failureThreshold: 6
      initialDelaySeconds: 120
      periodSeconds: 30
      successThreshold: 1
      timeoutSeconds: 20
      exec:
        command:
          - /bin/bash
          - -ec
          - rabbitmq-diagnostics -q ping
  YAML
  ]
}
