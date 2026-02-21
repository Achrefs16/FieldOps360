resource "kubernetes_persistent_volume_claim" "minio" {
  metadata {
    name      = "minio-data"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
  }
  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = "local-path"
    resources {
      requests = { storage = var.minio_storage_size }
    }
  }
}

resource "kubernetes_deployment" "minio" {
  depends_on = [kubernetes_deployment.rabbitmq]

  metadata {
    name      = "minio"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
    labels    = { app = "minio" }
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "minio" } }
    template {
      metadata { labels = { app = "minio" } }
      spec {
        container {
          name  = "minio"
          image = "minio/minio:latest"
          args  = ["server", "/data", "--console-address", ":9001"]
          port { container_port = 9000 }
          port { container_port = 9001 }
          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = "fieldops-secrets"
                key  = "minio-access-key"
              }
            }
          }
          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = "fieldops-secrets"
                key  = "minio-secret-key"
              }
            }
          }
          resources {
            requests = { cpu = "25m", memory = "128Mi" }
            limits   = { memory = "512Mi" }
          }
          volume_mount {
            name       = "data"
            mount_path = "/data"
          }
        }
        volume {
          name = "data"
          persistent_volume_claim { claim_name = "minio-data" }
        }
      }
    }
  }
}

resource "kubernetes_service" "minio" {
  metadata {
    name      = "minio"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
  }
  spec {
    selector = { app = "minio" }
    port {
      name = "api"
      port = 9000
    }
    port {
      name = "console"
      port = 9001
    }
  }
}
