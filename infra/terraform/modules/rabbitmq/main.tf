resource "helm_release" "rabbitmq" {
  name       = "rabbitmq"
  namespace  = var.namespace
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "rabbitmq"
  version    = "12.15.0"
  timeout    = 900
  wait       = false
  force_update   = true
  recreate_pods  = true

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
    customLivenessProbe:
      exec:
        command:
          - /bin/bash
          - -ec
          - rabbitmq-diagnostics -q ping
      initialDelaySeconds: 120
      periodSeconds: 30
      timeoutSeconds: 20
      successThreshold: 1
      failureThreshold: 6
    customReadinessProbe:
      exec:
        command:
          - /bin/bash
          - -ec
          - rabbitmq-diagnostics -q check_running && rabbitmq-diagnostics -q check_local_alarms
      initialDelaySeconds: 20
      periodSeconds: 10
      timeoutSeconds: 5
      successThreshold: 1
      failureThreshold: 6
  YAML
  ]
}
