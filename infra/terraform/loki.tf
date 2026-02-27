# FieldOps360 - Loki Log Aggregation (Terraform)
# Deploys Loki (log storage) + Promtail (log collector from all pods)

# --- Loki (Log Storage) ---
resource "helm_release" "loki" {
  name       = "loki"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki"
  version    = "6.6.2"
  timeout    = 600
  wait       = true

  values = [<<-YAML
    # Single-binary mode (lightweight, perfect for dev/single VM)
    deploymentMode: SingleBinary
    loki:
      auth_enabled: false
      commonConfig:
        replication_factor: 1
      storage:
        type: filesystem
      schemaConfig:
        configs:
          - from: "2024-01-01"
            store: tsdb
            object_store: filesystem
            schema: v13
            index:
              prefix: loki_index_
              period: 24h

    singleBinary:
      replicas: 1
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
        limits:
          memory: 512Mi
      persistence:
        storageClass: local-path
        size: 5Gi

    # Disable components not needed in SingleBinary mode
    backend:
      replicas: 0
    read:
      replicas: 0
    write:
      replicas: 0

    # Disable gateway (we access Loki directly from Grafana)
    gateway:
      enabled: false

    # Disable chunk cache for lightweight setup
    chunksCache:
      enabled: false
    resultsCache:
      enabled: false
  YAML
  ]
}

# --- Promtail (Log Collector) ---
resource "helm_release" "promtail" {
  name       = "promtail"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://grafana.github.io/helm-charts"
  chart      = "promtail"
  version    = "6.16.4"
  timeout    = 600
  wait       = true

  values = [<<-YAML
    config:
      clients:
        - url: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push

    resources:
      requests:
        cpu: 25m
        memory: 64Mi
      limits:
        memory: 256Mi
  YAML
  ]
}
