resource "helm_release" "minio" {
  name       = "minio"
  namespace  = var.namespace
  repository = "https://charts.min.io/"
  chart      = "minio"
  timeout    = 900
  wait       = false

  values = [<<-YAML
    mode: standalone
    rootUser: "${var.access_key}"
    rootPassword: "${var.secret_key}"
    persistence:
      storageClass: local-path
      size: ${var.storage_size}
    resources:
      requests:
        cpu: ${var.cpu_request}
        memory: ${var.memory_request}
      limits:
        memory: ${var.memory_limit}
    service:
      type: ClusterIP
    consoleService:
      type: ClusterIP
    buckets:
      - name: fieldops-uploads
        policy: none
      - name: fieldops-backups
        policy: none
      - name: fieldops-terraform-state
        policy: none
  YAML
  ]
}
