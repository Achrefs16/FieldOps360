resource "kubernetes_secret" "fieldops_secrets" {
  metadata {
    name      = "fieldops-secrets"
    namespace = kubernetes_namespace.fieldops.metadata[0].name
  }

  data = {
    postgresql-password = var.db_password
    redis-password      = var.redis_password
    rabbitmq-password   = var.rabbitmq_password
    minio-access-key    = var.minio_access_key
    minio-secret-key    = var.minio_secret_key
  }

  type = "Opaque"
}
