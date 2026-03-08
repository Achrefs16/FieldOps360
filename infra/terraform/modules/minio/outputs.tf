output "release_name" {
  value       = helm_release.minio.name
  description = "Helm release name"
}

output "service_name" {
  value       = "minio"
  description = "MinIO service name (internal DNS)"
}

output "api_port" {
  value       = 9000
  description = "MinIO S3 API port"
}

output "console_port" {
  value       = 9001
  description = "MinIO console UI port"
}
