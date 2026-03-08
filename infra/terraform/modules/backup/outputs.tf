output "cronjob_name" {
  value = kubernetes_manifest.pg_backup_daily.manifest.metadata.name
}
