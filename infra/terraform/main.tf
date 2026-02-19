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
# POSTGRESQL (needs more memory than LimitRange default)
# ============================================================
resource "helm_release" "postgresql" {
  name       = "postgresql"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "postgresql"
  version    = "14.3.3"

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
          memory: 128Mi
        limits:
          memory: 512Mi
  YAML
  ]
}

# ============================================================
# REDIS (LimitRange handles resources)
# ============================================================
resource "helm_release" "redis" {
  name       = "redis"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "redis"
  version    = "18.16.0"

  values = [<<-YAML
    architecture: standalone
    auth:
      password: "${var.redis_password}"
    master:
      persistence:
        storageClass: local-path
        size: 1Gi
  YAML
  ]
}

# ============================================================
# RABBITMQ (LimitRange handles resources)
# ============================================================
resource "helm_release" "rabbitmq" {
  name       = "rabbitmq"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "rabbitmq"
  version    = "13.0.3"

  values = [<<-YAML
    replicaCount: 1
    auth:
      username: fieldops
      password: "${var.rabbitmq_password}"
    persistence:
      storageClass: local-path
      size: 1Gi
    plugins: "rabbitmq_management rabbitmq_prometheus"
  YAML
  ]
}

# ============================================================
# MINIO (LimitRange handles resources)
# ============================================================
resource "helm_release" "minio" {
  name       = "minio"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "minio"
  version    = "13.7.0"

  values = [<<-YAML
    mode: standalone
    auth:
      rootUser: "${var.minio_access_key}"
      rootPassword: "${var.minio_secret_key}"
    persistence:
      storageClass: local-path
      size: ${var.minio_storage_size}
    defaultBuckets: "fieldops-documents,fieldops-photos,fieldops-signatures,fieldops-avatars,fieldops-reports"
  YAML
  ]
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
