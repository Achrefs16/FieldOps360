output "prometheus_release_name" {
  value       = helm_release.kube_prometheus.name
  description = "Prometheus stack Helm release name"
}

output "loki_release_name" {
  value       = helm_release.loki.name
  description = "Loki Helm release name"
}

output "jaeger_release_name" {
  value       = helm_release.jaeger.name
  description = "Jaeger Helm release name"
}

output "grafana_url" {
  value       = var.grafana_root_url
  description = "Grafana access URL"
}

output "prometheus_service" {
  value       = "kube-prometheus-kube-prome-prometheus"
  description = "Prometheus service name"
}

output "loki_service" {
  value       = "loki"
  description = "Loki service name"
}

output "jaeger_service" {
  value       = "jaeger-query"
  description = "Jaeger query service name"
}
