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

        # Scrape all namespaces (fieldops-dev, argocd, monitoring)
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
