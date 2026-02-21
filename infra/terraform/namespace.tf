resource "kubernetes_namespace" "fieldops" {
  metadata {
    name = "fieldops-${var.environment}"
    labels = {
      "app.kubernetes.io/part-of" = "fieldops360"
      "environment"               = var.environment
    }
  }
}
