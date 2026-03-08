# FieldOps360 - Observability Stack Module
# Deploys: Prometheus, Grafana, Loki, Promtail, Jaeger

# --- Prometheus + Grafana (kube-prometheus-stack) ---
resource "helm_release" "kube_prometheus" {
  name       = "kube-prometheus"
  namespace  = var.namespace
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = var.prometheus_chart_version
  timeout    = 900
  wait       = true

  values = [<<-YAML
    grafana:
      enabled: true
      adminUser: admin
      adminPassword: ${var.grafana_password}

      grafana.ini:
        server:
          root_url: "${var.grafana_root_url}"
          serve_from_sub_path: true

      additionalDataSources:
        - name: Loki
          type: loki
          url: http://loki.${var.namespace}.svc.cluster.local:3100
          access: proxy
          isDefault: false

      resources:
        requests:
          cpu: ${var.grafana_cpu_request}
          memory: ${var.grafana_memory_request}
        limits:
          memory: ${var.grafana_memory_limit}

    prometheus:
      prometheusSpec:
        retention: ${var.prometheus_retention}
        storageSpec:
          volumeClaimTemplate:
            spec:
              storageClassName: local-path
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: ${var.prometheus_storage_size}
        resources:
          requests:
            cpu: ${var.prometheus_cpu_request}
            memory: ${var.prometheus_memory_request}
          limits:
            memory: ${var.prometheus_memory_limit}

        serviceMonitorSelectorNilUsesHelmValues: false
        podMonitorSelectorNilUsesHelmValues: false

    alertmanager:
      alertmanagerSpec:
        resources:
          requests:
            cpu: 10m
            memory: 32Mi
          limits:
            memory: 128Mi

    nodeExporter:
      enabled: true

    kubeStateMetrics:
      enabled: true
  YAML
  ]
}

# --- Loki (Log Storage) ---
resource "helm_release" "loki" {
  name       = "loki"
  namespace  = var.namespace
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki"
  version    = var.loki_chart_version
  timeout    = 600
  wait       = true

  values = [<<-YAML
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
          cpu: ${var.loki_cpu_request}
          memory: ${var.loki_memory_request}
        limits:
          memory: ${var.loki_memory_limit}
      persistence:
        storageClass: local-path
        size: ${var.loki_storage_size}

    backend:
      replicas: 0
    read:
      replicas: 0
    write:
      replicas: 0
    gateway:
      enabled: false
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
  namespace  = var.namespace
  repository = "https://grafana.github.io/helm-charts"
  chart      = "promtail"
  version    = var.promtail_chart_version
  timeout    = 600
  wait       = true

  values = [<<-YAML
    config:
      clients:
        - url: http://loki.${var.namespace}.svc.cluster.local:3100/loki/api/v1/push

    resources:
      requests:
        cpu: 25m
        memory: 64Mi
      limits:
        memory: 256Mi
  YAML
  ]

  depends_on = [helm_release.loki]
}

# --- Jaeger (Distributed Tracing) ---
resource "helm_release" "jaeger" {
  name       = "jaeger"
  namespace  = var.namespace
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  version    = var.jaeger_chart_version
  timeout    = 600
  wait       = true

  values = [<<-YAML
    provisionDataStore:
      cassandra: false
      elasticsearch: false
      kafka: false
    storage:
      type: memory
    allInOne:
      enabled: true
      args:
        - "--query.base-path=/jaeger"
      resources:
        requests:
          cpu: ${var.jaeger_cpu_request}
          memory: ${var.jaeger_memory_request}
        limits:
          memory: ${var.jaeger_memory_limit}
    agent:
      enabled: false
    collector:
      enabled: false
    query:
      enabled: false
  YAML
  ]
}

# --- Traefik Metrics Integration ---
resource "kubernetes_manifest" "traefik_metrics_config" {
  count = var.enable_traefik_metrics ? 1 : 0

  manifest = {
    apiVersion = "helm.cattle.io/v1"
    kind       = "HelmChartConfig"
    metadata = {
      name      = "traefik"
      namespace = "kube-system"
    }
    spec = {
      valuesContent = yamlencode({
        metrics = {
          prometheus = {
            entryPoint = "metrics"
          }
        }
        ports = {
          metrics = {
            port = 9100
            expose = {
              default = true
            }
            exposedPort = 9100
          }
        }
      })
    }
  }
}

resource "kubernetes_manifest" "traefik_pod_monitor" {
  count      = var.enable_traefik_metrics ? 1 : 0
  depends_on = [helm_release.kube_prometheus]

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "PodMonitor"
    metadata = {
      name      = "traefik"
      namespace = var.namespace
      labels = {
        release = "kube-prometheus"
      }
    }
    spec = {
      jobLabel = "traefik"
      namespaceSelector = {
        matchNames = ["kube-system"]
      }
      selector = {
        matchLabels = {
          "app.kubernetes.io/name" = "traefik"
        }
      }
      podMetricsEndpoints = [{
        port     = "metrics"
        path     = "/metrics"
        interval = "30s"
      }]
    }
  }
}
