resource "kubernetes_persistent_volume_claim" "rabbitmq" {
  metadata {
    name      = "rabbitmq-data"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = "local-path"
    resources {
      requests = { storage = "1Gi" }
    }
  }
}

resource "kubernetes_deployment" "rabbitmq" {
  depends_on = [
    helm_release.redis,
    kubernetes_secret.fieldops_secrets
  ]

  metadata {
    name      = "rabbitmq"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
    labels    = { app = "rabbitmq" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "rabbitmq" } }
    template {
      metadata { labels = { app = "rabbitmq" } }
      spec {
        container {
          name  = "rabbitmq"
          image = "rabbitmq:3-management"
          port { container_port = 5672 }
          port { container_port = 15672 }
          env {
            name = "RABBITMQ_DEFAULT_USER"
            value = "fieldops"
          }
          env {
            name = "RABBITMQ_DEFAULT_PASS"
            value_from {
              secret_key_ref {
                name = "fieldops-secrets"
                key  = "rabbitmq-password"
              }
            }
          }
          resources {
            requests = { cpu = "50m", memory = "128Mi" }
            limits   = { memory = "512Mi" }
          }
          volume_mount {
            name       = "data"
            mount_path = "/var/lib/rabbitmq"
          }
        }
        volume {
          name = "data"
          persistent_volume_claim { claim_name = "rabbitmq-data" }
        }
      }
    }
  }
}

resource "kubernetes_service" "rabbitmq" {
  metadata {
    name      = "rabbitmq"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
  }
  spec {
    selector = { app = "rabbitmq" }
    port {
      name = "amqp"
      port = 5672
    }
    port {
      name = "management"
      port = 15672
    }
  }
}
