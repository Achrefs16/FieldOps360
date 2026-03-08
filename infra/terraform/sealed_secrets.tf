# FieldOps360 - Sealed Secrets (Terraform)
# Installs Bitnami Sealed Secrets controller to encrypt K8s secrets

resource "helm_release" "sealed_secrets" {
  name             = "sealed-secrets"
  namespace        = "kube-system"
  repository       = "https://bitnami-labs.github.io/sealed-secrets"
  chart            = "sealed-secrets"
  timeout          = 300
  wait             = false
  create_namespace = false

  # If sealed-secrets already exists from a previous run, adopt it
  force_update = true
  replace      = true
  reset_values = true

  values = [<<-YAML
    fullnameOverride: "sealed-secrets-controller"
    crds:
      create: true
      keep: true
  YAML
  ]
}
