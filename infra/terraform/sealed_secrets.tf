# FieldOps360 - Sealed Secrets (Terraform)
# Installs Bitnami Sealed Secrets controller to encrypt K8s secrets

resource "helm_release" "sealed_secrets" {
  name       = "sealed-secrets"
  namespace  = "kube-system" # Standard namespace forcluster-wide controllers
  repository = "https://bitnami-labs.github.io/sealed-secrets"
  chart      = "sealed-secrets"
  version    = "2.16.1"
  timeout    = 600
  wait       = true

  # The controller needs to be able to modify Secrets across all namespaces
  # The default RBAC configuration created by the chart handles this.
  
  values = [<<-YAML
    fullnameOverride: "sealed-secrets-controller"
    # Create the CRD (CustomResourceDefinition) for SealedSecret
    crds:
      create: true
      keep: true
  YAML
  ]
}
