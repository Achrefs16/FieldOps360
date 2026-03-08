resource "helm_release" "postgresql" {
  name       = "postgresql"
  namespace  = var.namespace
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "postgresql"
  version    = var.chart_version
  timeout    = 900
  wait       = true

  values = [<<-YAML
    architecture: standalone
    auth:
      postgresPassword: "${var.admin_password}"
      database: "${var.database_name}"
    primary:
      extendedConfiguration: |
        wal_level = replica
        archive_mode = on
        archive_command = '/scripts/archive_command.sh %f'
        archive_timeout = 60s
      extraVolumes:
        - name: wal-script
          configMap:
            name: pg-backup-config
            defaultMode: 0755
      extraVolumeMounts:
        - name: wal-script
          mountPath: /scripts
          readOnly: true
      persistence:
        enabled: true
        storageClass: local-path
        size: ${var.storage_size}
  YAML
  ]
}
