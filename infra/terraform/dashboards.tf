resource "kubernetes_config_map" "grafana_dashboard_auth" {
  metadata {
    name      = "grafana-dashboard-auth-service"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      # This label tells the grafana sidecar to automatically mount this ConfigMap!
      grafana_dashboard = "1"
    }
  }

  data = {
    "auth-service-dashboard.json" = <<-JSON
    {
      "title": "Auth Service Traffic",
      "tags": ["auth-service", "traefik"],
      "timezone": "browser",
      "schemaVersion": 30,
      "refresh": "10s",
      "panels": [
        {
          "title": "Total Auth Requests (per minute)",
          "type": "stat",
          "datasource": "Prometheus",
          "gridPos": { "h": 6, "w": 8, "x": 0, "y": 0 },
          "targets": [
            {
              "expr": "sum(rate(traefik_service_requests_total{service=~\"fieldops-dev-auth-service.*\"}[1m])) * 60",
              "legendFormat": "Requests / min"
            }
          ]
        },
        {
          "title": "HTTP Status Codes",
          "type": "timeseries",
          "datasource": "Prometheus",
          "gridPos": { "h": 8, "w": 16, "x": 8, "y": 0 },
          "targets": [
            {
              "expr": "sum by (code) (rate(traefik_service_requests_total{service=~\"fieldops-dev-auth-service.*\"}[2m]))",
              "legendFormat": "Status {{code}}"
            }
          ]
        },
        {
          "title": "Requests by Endpoint (Inferred from Traefik)",
          "type": "barchart",
          "datasource": "Prometheus",
          "gridPos": { "h": 10, "w": 12, "x": 0, "y": 8 },
          "targets": [
            {
              "expr": "sum by (method) (increase(traefik_service_requests_total{service=~\"fieldops-dev-auth-service.*\"}[10m]))",
              "legendFormat": "{{method}}"
            }
          ]
        },
        {
          "title": "P99 Response Latency (ms)",
          "type": "gauge",
          "datasource": "Prometheus",
          "gridPos": { "h": 10, "w": 12, "x": 12, "y": 8 },
          "targets": [
            {
              "expr": "histogram_quantile(0.99, sum(rate(traefik_service_request_duration_seconds_bucket{service=~\"fieldops-dev-auth-service.*\"}[5m])) by (le)) * 1000",
              "legendFormat": "P99 Latency"
            }
          ]
        }
      ]
    }
    JSON
  }
}
