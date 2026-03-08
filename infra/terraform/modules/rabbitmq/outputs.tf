output "release_name" {
  value       = helm_release.rabbitmq.name
  description = "Helm release name"
}

output "service_name" {
  value       = "rabbitmq"
  description = "RabbitMQ service name (internal DNS)"
}

output "port" {
  value       = 5672
  description = "RabbitMQ AMQP port"
}

output "management_port" {
  value       = 15672
  description = "RabbitMQ management UI port"
}
