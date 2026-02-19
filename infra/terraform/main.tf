# FieldOps360 - Terraform for K3s
# Simple flat configuration
#
# Usage:
#   terraform init
#   terraform apply -var-file=dev.tfvars

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig_path
  }
}

# ============================================================
# NAMESPACE
# ============================================================
resource "kubernetes_namespace" "fieldops" {
  metadata {
    name = "fieldops-${var.environment}"
    labels = {
      "app.kubernetes.io/part-of" = "fieldops360"
      "environment"               = var.environment
    }
  }
}

# ============================================================
# POSTGRESQL — deploys first
# ============================================================
resource "helm_release" "postgresql" {
  name       = "postgresql"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "postgresql"
  # No version pin — uses latest chart with current images
  timeout    = 600
  wait       = true

  values = [<<-YAML
    architecture: standalone
    auth:
      postgresPassword: "${var.db_password}"
      database: fieldops_platform
    primary:
      persistence:
        storageClass: local-path
        size: ${var.db_storage_size}
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
        limits:
          memory: 512Mi
  YAML
  ]
}

# ============================================================
# REDIS — waits for PostgreSQL
# ============================================================
resource "helm_release" "redis" {
  depends_on = [helm_release.postgresql]

  name       = "redis"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "redis"
  # No version pin — uses latest chart with current images
  timeout    = 600
  wait       = true

  values = [<<-YAML
    architecture: standalone
    auth:
      password: "${var.redis_password}"
    master:
      persistence:
        storageClass: local-path
        size: 1Gi
      resources:
        requests:
          cpu: 25m
          memory: 64Mi
        limits:
          memory: 256Mi
  YAML
  ]
}

# ============================================================
# RABBITMQ — official image (Bitnami deprecated)
# ============================================================
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
  depends_on = [helm_release.redis]

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
            name  = "RABBITMQ_DEFAULT_USER"
            value = "fieldops"
          }
          env {
            name  = "RABBITMQ_DEFAULT_PASS"
            value = var.rabbitmq_password
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

# ============================================================
# MINIO — official image (Bitnami deprecated)
# ============================================================
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
            name  = "MINIO_ROOT_USER"
            value = var.minio_access_key
          }
          env {
            name  = "MINIO_ROOT_PASSWORD"
            value = var.minio_secret_key
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

# ============================================================
# OUTPUTS
# ============================================================
output "namespace" {
  value = kubernetes_namespace.fieldops.metadata[0].name
}

output "postgresql_host" {
  value = "postgresql.${kubernetes_namespace.fieldops.metadata[0].name}.svc.cluster.local"
}

output "redis_host" {
  value = "redis-master.${kubernetes_namespace.fieldops.metadata[0].name}.svc.cluster.local"
}

output "rabbitmq_host" {
  value = "rabbitmq.${kubernetes_namespace.fieldops.metadata[0].name}.svc.cluster.local"
}

output "minio_host" {
  value = "minio.${kubernetes_namespace.fieldops.metadata[0].name}.svc.cluster.local"
}

