locals {
  logical_namespaces = {
    gateway = {
      name   = "fieldops-gateway"
      labels = { "app.kubernetes.io/part-of" = "fieldops360", "tier" = "gateway" }
    }
    auth = {
      name   = "fieldops-auth"
      labels = { "app.kubernetes.io/part-of" = "fieldops360", "tier" = "application" }
    }
    core = {
      name   = "fieldops-core"
      labels = { "app.kubernetes.io/part-of" = "fieldops360", "tier" = "application" }
    }
    reporting = {
      name   = "fieldops-reporting"
      labels = { "app.kubernetes.io/part-of" = "fieldops360", "tier" = "application" }
    }
    data = {
      name   = "fieldops-data"
      labels = { "app.kubernetes.io/part-of" = "fieldops360", "tier" = "data" }
    }
    observability = {
      name   = "fieldops-observability"
      labels = { "app.kubernetes.io/part-of" = "fieldops360", "tier" = "monitoring" }
    }
  }
}

module "logical_namespaces" {
  for_each = var.enable_modular_stack ? local.logical_namespaces : {}

  source = "./modules/namespace"
  name   = each.value.name
  labels = each.value.labels
}

module "postgresql_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source         = "./modules/postgresql"
  namespace      = module.logical_namespaces["data"].name
  admin_password = var.db_password
  storage_size   = var.db_storage_size
  database_name  = "fieldops_platform"
}

module "redis_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source    = "./modules/redis"
  namespace = module.logical_namespaces["data"].name
  password  = var.redis_password
}

module "rabbitmq_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source    = "./modules/rabbitmq"
  namespace = module.logical_namespaces["data"].name
  password  = var.rabbitmq_password
}

module "minio_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source         = "./modules/minio"
  namespace      = module.logical_namespaces["data"].name
  storage_size   = var.minio_storage_size
  access_key     = var.minio_access_key
  secret_key     = var.minio_secret_key
  create_buckets = true
}

module "observability_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source                    = "./modules/observability"
  namespace                 = module.logical_namespaces["observability"].name
  grafana_password          = var.grafana_password
  prometheus_storage_size   = "5Gi"
  loki_storage_size         = "5Gi"
  enable_traefik_metrics    = true
}

module "vault_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source       = "./modules/vault"
  namespace    = module.logical_namespaces["data"].name
  replicas     = var.environment == "prod" ? 3 : 1
  storage_size = var.environment == "prod" ? "10Gi" : "5Gi"
}

module "backup_modular" {
  count = var.enable_modular_stack ? 1 : 0

  source    = "./modules/backup"
  namespace = module.logical_namespaces["data"].name
  schedule  = "0 2 * * *"
}
