# FieldOps360 - Metrics Server (Terraform)
# NOTE: Prometheus, Grafana, Loki, Jaeger now managed by modules/observability
# This file only contains metrics-server (required for HPA)

# --- Metrics Server (required for HPA) ---
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = "3.12.0"
  timeout    = 600
  wait       = true

  set {
    name  = "args[0]"
    value = "--kubelet-insecure-tls"
  }
}
