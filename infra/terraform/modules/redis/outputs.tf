output "release_name" {
  value       = helm_release.redis.name
  description = "Helm release name"
}

output "service_name" {
  value       = "redis-master"
  description = "Redis service name (internal DNS)"
}

output "port" {
  value       = 6379
  description = "Redis port"
}
