# Terraform State Backend (MinIO S3)
# 
# BOOTSTRAP PROCESS:
# 1. First deployment: Keep backend commented out, use local state
#    terraform init && terraform apply
# 2. After MinIO is running: Uncomment backend, migrate state
#    terraform init -migrate-state -backend-config="access_key=..." -backend-config="secret_key=..."

terraform {
  # UNCOMMENT AFTER FIRST DEPLOYMENT
  # backend "s3" {
  #   bucket                      = "fieldops-terraform-state"
  #   key                         = "state/terraform.tfstate"
  #   region                      = "us-east-1"
  #   endpoint                    = "http://minio.fieldops-data.svc.cluster.local:9000"
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  #   force_path_style            = true
  # }
}
