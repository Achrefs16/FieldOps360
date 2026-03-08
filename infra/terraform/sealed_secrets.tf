# FieldOps360 - Sealed Secrets (Terraform)
# Installs Bitnami Sealed Secrets controller to encrypt K8s secrets

resource "helm_release" "sealed_secrets" {
  count      = var.enable_argocd ? 1 : 0
  name       = "sealed-secrets"
  namespace  = "kube-system"
  repository = "https://bitnami-labs.github.io/sealed-secrets"
  chart      = "sealed-secrets"
  timeout    = 600
  wait       = true

  values = [<<-YAML
    fullnameOverride: "sealed-secrets-controller"
    crds:
      create: true
      keep: true
  YAML
  ]
}
