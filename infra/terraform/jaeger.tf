resource "helm_release" "jaeger" {
  name       = "jaeger"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  version    = "3.3.1"
  timeout    = 600
  wait       = true

  values = [<<-YAML
    provisionDataStore:
      cassandra: false
      elasticsearch: false
      kafka: false
    storage:
      type: memory
    allInOne:
      enabled: true
      resources:
        requests:
          cpu: 100m
          memory: 256Mi
        limits:
          memory: 512Mi
    agent:
      enabled: false
    collector:
      enabled: false
    query:
      enabled: false
  YAML
  ]
}
