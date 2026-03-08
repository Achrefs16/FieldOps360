# Prod environment
# SECURITY: Do NOT commit real passwords to Git!
# Use environment variables: TF_VAR_db_password="..." etc.

environment          = "prod"
enable_modular_stack = true
db_password          = "CHANGE_ME"
redis_password       = "CHANGE_ME"
rabbitmq_password    = "CHANGE_ME"
minio_access_key     = "fieldops_prod"
minio_secret_key     = "CHANGE_ME"
db_storage_size      = "20Gi"
minio_storage_size   = "50Gi"
grafana_password     = "CHANGE_ME"
