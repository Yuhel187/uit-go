output "alb_dns_name" {
  description = "DNS cua Load Balancer (Dung de truy cap App)"
  value       = aws_lb.main.dns_name
}

output "k6_server_ip" {
  description = "IP Public cua may K6 Load Test"
  value       = aws_instance.k6_server.public_ip
}

output "rds_endpoint" {
  description = "Endpoint cua PostgreSQL Primary (Write/Read)"
  value       = aws_db_instance.postgres.endpoint
}

output "replica_endpoint" {
  description = "Endpoint cua PostgreSQL Read Replica (Read Only)"
  value       = aws_db_instance.postgres_replica.address
}

output "redis_endpoint" {
  description = "Endpoint cua Redis Cluster"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "sqs_queue_url" {
  description = "URL cua SQS Queue (Trip Queue)"
  value       = aws_sqs_queue.trip_queue.url
}