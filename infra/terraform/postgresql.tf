resource "helm_release" "postgresql" {
  name       = "postgresql"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "postgresql"
  timeout    = 600
  wait       = true

  values = [<<-YAML
    architecture: standalone
    auth:
      existingSecret: "fieldops-secrets"
      secretKeys:
        adminPasswordKey: "postgresql-password"
      database: fieldops_platform
    primary:
      persistence:
        storageClass: local-path
        size: ${var.db_storage_size}
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
        limits:
          memory: 512Mi
  YAML
  ]
}
