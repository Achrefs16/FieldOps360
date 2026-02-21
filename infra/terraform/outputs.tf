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
