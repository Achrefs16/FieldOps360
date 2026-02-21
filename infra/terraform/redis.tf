resource "helm_release" "redis" {
  depends_on = [helm_release.postgresql]

  name       = "redis"
  namespace  = kubernetes_namespace.fieldops.metadata[0].name
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "redis"
  timeout    = 600
  wait       = true

  values = [<<-YAML
    architecture: standalone
    auth:
      existingSecret: "fieldops-secrets"
      existingSecretPasswordKey: "redis-password"
    master:
      persistence:
        storageClass: local-path
        size: 1Gi
      resources:
        requests:
          cpu: 25m
          memory: 64Mi
        limits:
          memory: 256Mi
  YAML
  ]
}
