# Security Improvements

## 1. Secrets Protection

**Problem**: `dev.tfvars` had plaintext passwords in Git  
**Solution**: 
- `.gitignore` excludes `*.tfvars` (except `.example`)
- Use `dev.tfvars.example` as template with `CHANGE_ME` placeholders
- Alternative: Use environment variables (`export TF_VAR_db_password=...`)

## 2. Terraform State Bootstrap

**Problem**: Terraform state stored in MinIO that Terraform deploys (circular dependency)  
**Solution**: Two-phase bootstrap
1. **Phase 1**: Comment out `backend.tf`, deploy with local state
2. **Phase 2**: Uncomment backend, run `terraform init -migrate-state`

Production: Use external state storage (Terraform Cloud, separate MinIO cluster)

## 3. Vault Integration (Optional)

**Current**: Services use K8s secrets (`fieldops-secrets`)  
**Available**: Vault module deployed, not yet integrated with apps

**To enable**: Use `auth-service-vault.yaml` instead of `auth-service.yaml`

Benefits:
- Dynamic secrets with auto-rotation
- Encrypted at rest in Vault (not K8s etcd)
- Audit trail for secret access
- Centralized management

## Quick Start

```bash
# Set secrets via environment
export TF_VAR_db_password="$(openssl rand -base64 32)"
export TF_VAR_redis_password="$(openssl rand -base64 32)"

# Bootstrap with local state
terraform init && terraform apply

# Optional: Migrate to MinIO state after deployment
# Uncomment backend.tf, then:
# terraform init -migrate-state -backend-config="access_key=..." -backend-config="secret_key=..."
```
