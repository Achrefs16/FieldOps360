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
# RABBITMQ — waits for Redis
# ============================================================
resource "helm_release" "rabbitmq" {
  depends_on = [helm_release.redis]

  name       = "rabbitmq"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "rabbitmq"
  # No version pin — uses latest chart with current images
  timeout    = 600
  wait       = true

  values = [<<-YAML
    replicaCount: 1
    auth:
      username: fieldops
      password: "${var.rabbitmq_password}"
    persistence:
      storageClass: local-path
      size: 1Gi
    resources:
      requests:
        cpu: 50m
        memory: 128Mi
      limits:
        memory: 512Mi
    plugins: "rabbitmq_management rabbitmq_prometheus"
  YAML
  ]
}

# ============================================================
# MINIO — waits for RabbitMQ
# ============================================================
resource "helm_release" "minio" {
  depends_on = [helm_release.rabbitmq]

  name       = "minio"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "minio"
  # No version pin — uses latest chart with current images
  timeout    = 600
  wait       = true

  values = [<<-YAML
    mode: standalone
    auth:
      rootUser: "${var.minio_access_key}"
      rootPassword: "${var.minio_secret_key}"
    persistence:
      storageClass: local-path
      size: ${var.minio_storage_size}
    resources:
      requests:
        cpu: 25m
        memory: 128Mi
      limits:
        memory: 512Mi
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
