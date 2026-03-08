# Dev environment - 8GB RAM VM
# SECURITY: Set real passwords via TF_VAR_* environment variables!

environment          = "dev"
enable_modular_stack = true
enable_observability = false # Enable after core services are running (saves ~2.5GB RAM)
enable_argocd        = false # Enable after core services are running
db_password          = "CHANGE_ME"
redis_password       = "CHANGE_ME"
rabbitmq_password    = "CHANGE_ME"
minio_access_key     = "fieldops_admin"
minio_secret_key     = "CHANGE_ME"
db_storage_size      = "1Gi"
minio_storage_size   = "2Gi"
grafana_password     = "CHANGE_ME"
