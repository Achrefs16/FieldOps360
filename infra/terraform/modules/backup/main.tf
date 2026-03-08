# Backups are managed via K8s CronJob manifests in infra/k8s/cronjobs/
# with Vault Agent Injector for secrets. This module is intentionally
# kept empty to avoid conflicts with the ArgoCD-managed manifests.
#
# Active backup jobs:
#   - k8s/cronjobs/pg-backup-daily.yaml   (daily PostgreSQL dump at 02:00)
#   - k8s/cronjobs/redis-backup.yaml      (daily Redis dump at 02:30)
#   - k8s/cronjobs/restore-test.yaml      (monthly restore test at 03:00)
