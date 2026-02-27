# FieldOps360 - Observability Stack (Terraform)
# Deploys kube-prometheus-stack (Prometheus + Grafana + Node Exporter + Alertmanager)

# --- Monitoring Namespace ---
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
  }
}

# --- kube-prometheus-stack (Prometheus + Grafana) ---
resource "helm_release" "kube_prometheus" {
  name       = "kube-prometheus"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "65.1.0"
  timeout    = 900
  wait       = true

  values = [<<-YAML
    # --- Grafana Configuration ---
    grafana:
      enabled: true
      adminUser: admin
      adminPassword: ${var.grafana_password}

      # Serve Grafana under /grafana path (behind Traefik)
      grafana.ini:
        server:
          root_url: "http://192.168.50.10/grafana"
          serve_from_sub_path: true

      # Auto-configure Loki as data source (no manual setup!)
      additionalDataSources:
        - name: Loki
          type: loki
          url: http://loki.monitoring.svc.cluster.local:3100
          access: proxy
          isDefault: false

      # Lightweight resources for 8GB VM
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          memory: 512Mi

    # --- Prometheus Configuration ---
    prometheus:
      prometheusSpec:
        retention: 7d                  # Keep 7 days of metrics
        storageSpec:
          volumeClaimTemplate:
            spec:
              storageClassName: local-path
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: 5Gi
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            memory: 1Gi

        # Scrape all namespaces (fieldops-dev, argocd, monitoring, kube-system)
        serviceMonitorSelectorNilUsesHelmValues: false
        podMonitorSelectorNilUsesHelmValues: false

    # --- Alertmanager (lightweight) ---
    alertmanager:
      alertmanagerSpec:
        resources:
          requests:
            cpu: 10m
            memory: 32Mi
          limits:
            memory: 128Mi

    # --- Node Exporter (VM metrics: CPU, RAM, disk) ---
    nodeExporter:
      enabled: true

    # --- kube-state-metrics (K8s object metrics) ---
    kubeStateMetrics:
      enabled: true
  YAML
  ]
}

# --- Enable Traefik Prometheus Metrics (K3s HelmChartConfig) ---
# K3s manages Traefik via HelmChart CRD. This config enables the metrics
# entrypoint so Prometheus can scrape HTTP request data.
resource "kubernetes_manifest" "traefik_metrics_config" {
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
            port        = 9100
            expose      = true
            exposedPort = 9100
          }
        }
      })
    }
  }
}


# --- Traefik ServiceMonitor (scrape HTTP request metrics) ---
# This tells Prometheus to scrape Traefik's /metrics endpoint
# giving us: requests/sec, latency, status codes (2xx/4xx/5xx)
resource "kubernetes_manifest" "traefik_service_monitor" {
  depends_on = [helm_release.kube_prometheus]

  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "traefik"
      namespace = "monitoring"
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
      endpoints = [{
        port     = "metrics"
        path     = "/metrics"
        interval = "30s"
      }]
    }
  }
}

