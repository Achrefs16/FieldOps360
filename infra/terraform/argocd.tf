# FieldOps360 - ArgoCD GitOps (Terraform)
# Installs ArgoCD via Helm and configures it to watch infra/k8s/

# --- ArgoCD Namespace ---
resource "kubernetes_namespace" "argocd" {
  count = var.enable_argocd ? 1 : 0

  metadata {
    name = "argocd"
  }
}

# --- ArgoCD Helm Release ---
resource "helm_release" "argocd" {
  count      = var.enable_argocd ? 1 : 0
  name       = "argocd"
  namespace  = kubernetes_namespace.argocd[0].metadata[0].name
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  timeout    = 900
  wait       = true

  values = [<<-YAML
    server:
      insecure: true
    configs:
      params:
        server.insecure: true
        server.rootpath: "/argocd"
  YAML
  ]
}

# --- Traefik IngressRoute for ArgoCD Dashboard ---
resource "kubernetes_manifest" "argocd_ingress" {
  count      = var.enable_argocd ? 1 : 0
  depends_on = [helm_release.argocd]

  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "argocd-server"
      namespace = "argocd"
    }
    spec = {
      entryPoints = ["web"]
      routes = [{
        match = "PathPrefix(`/argocd`)"
        kind  = "Rule"
        services = [{
          name = "argocd-server"
          port = 80
        }]
      }]
    }
  }
}

# --- ArgoCD Application (watches infra/k8s/) ---
resource "kubernetes_manifest" "argocd_app" {
  count      = var.enable_argocd ? 1 : 0
  depends_on = [helm_release.argocd]

  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "fieldops-${var.environment}"
      namespace = "argocd"
    }
    spec = {
      project = "default"
      source = {
        repoURL        = var.argocd_repo_url
        targetRevision = var.argocd_target_branch
        path           = "infra/k8s"
        directory = {
          recurse = true
          exclude = "00-crds/*"
        }
      }
      destination = {
        server = "https://kubernetes.default.svc"
      }
      syncPolicy = {
        automated = {
          prune    = true
          selfHeal = true
        }
        syncOptions = ["CreateNamespace=true"]
      }
      ignoreDifferences = [{
        group = "apps"
        kind  = "Deployment"
        jsonPointers = [
          "/spec/template/metadata/annotations/kubectl.kubernetes.io~1restartedAt",
          "/spec/template/spec/containers/0/image"
        ]
      }]
    }
  }
}
