resource "helm_release" "minio" {
  name       = "minio"
  namespace  = var.namespace
  repository = "oci://registry-1.docker.io/bitnamicharts"
  chart      = "minio"
  timeout    = 900
  wait       = true

  values = [<<-YAML
    image:
      registry: docker.io
      repository: minio/minio
      tag: latest
    auth:
      rootUser: "${var.access_key}"
      rootPassword: "${var.secret_key}"
    mode: standalone
    defaultBuckets: "fieldops-uploads,fieldops-backups,fieldops-terraform-state"
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
      ports:
        api: 9000
        console: 9001
  YAML
  ]
}

# Initialize default buckets
resource "kubernetes_job" "minio_bucket_init" {
  count = var.create_buckets ? 1 : 0

  metadata {
    name      = "minio-bucket-init"
    namespace = var.namespace
  }

  spec {
    template {
      metadata {}
      spec {
        restart_policy = "OnFailure"
        container {
          name  = "mc"
          image = "minio/mc:latest"
          command = [
            "/bin/sh",
            "-c",
            <<-SCRIPT
              mc alias set minio http://minio:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
              mc mb --ignore-existing minio/fieldops-uploads
              mc mb --ignore-existing minio/fieldops-backups
              mc mb --ignore-existing minio/fieldops-terraform-state
            SCRIPT
          ]
          env {
            name  = "MINIO_ACCESS_KEY"
            value = var.access_key
          }
          env {
            name  = "MINIO_SECRET_KEY"
            value = var.secret_key
          }
        }
      }
    }
  }

  wait_for_completion = true

  depends_on = [helm_release.minio]
}
