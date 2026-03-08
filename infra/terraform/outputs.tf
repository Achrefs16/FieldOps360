# Outputs are only available when enable_modular_stack is true
# because the module resources are conditionally created.

output "namespace" {
  value = var.enable_modular_stack ? module.logical_namespaces["data"].name : "N/A (modular stack disabled)"
}

output "postgresql_host" {
  value = var.enable_modular_stack ? "postgresql.${module.logical_namespaces["data"].name}.svc.cluster.local" : "N/A"
}

output "redis_host" {
  value = var.enable_modular_stack ? "redis-master.${module.logical_namespaces["data"].name}.svc.cluster.local" : "N/A"
}

output "rabbitmq_host" {
  value = var.enable_modular_stack ? "rabbitmq.${module.logical_namespaces["data"].name}.svc.cluster.local" : "N/A"
}

output "minio_host" {
  value = var.enable_modular_stack ? "minio.${module.logical_namespaces["data"].name}.svc.cluster.local" : "N/A"
}

output "argocd_dashboard" {
  value = var.public_base_url == "" ? "Set var.public_base_url to build this URL" : "${trimsuffix(var.public_base_url, "/")}/argocd"
}

output "grafana_dashboard" {
  value = var.public_base_url == "" ? "Set var.public_base_url to build this URL" : "${trimsuffix(var.public_base_url, "/")}/grafana"
}

output "argocd_path" {
  value = "/argocd"
}

output "grafana_path" {
  value = "/grafana"
}
