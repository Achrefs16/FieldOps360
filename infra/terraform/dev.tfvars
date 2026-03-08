# Dev environment - 8GB RAM VM
# SECURITY: Set real passwords before deploying!
# Alternatively, pass via environment variables: TF_VAR_db_password="..." etc.

environment          = "dev"
enable_modular_stack = true
db_password          = "CHANGE_ME"
redis_password       = "CHANGE_ME"
rabbitmq_password    = "CHANGE_ME"
minio_access_key     = "fieldops_admin"
minio_secret_key     = "CHANGE_ME"
db_storage_size      = "1Gi"
minio_storage_size   = "2Gi"
grafana_password     = "CHANGE_ME"
enable_observability = false
