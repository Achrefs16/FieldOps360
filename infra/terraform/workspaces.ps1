param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("dev", "staging", "prod")]
  [string]$Workspace
)

terraform workspace select $Workspace 2>$null
if ($LASTEXITCODE -ne 0) {
  terraform workspace new $Workspace
}

Write-Host "Selected workspace: $Workspace"
Write-Host "Run plan with: terraform plan -var-file=$Workspace.tfvars"
