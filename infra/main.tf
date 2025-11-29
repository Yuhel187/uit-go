terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-1"
}

# =============================================================================
# 1. NETWORK (VPC & SUBNETS)
# =============================================================================
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "uit-go-vpc" }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-southeast-1a"
  map_public_ip_on_launch = true
  tags = { Name = "uit-go-subnet-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-southeast-1b"
  map_public_ip_on_launch = true
  tags = { Name = "uit-go-subnet-b" }
}

resource "aws_route_table_association" "a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public_rt.id
}
resource "aws_route_table_association" "b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public_rt.id
}

# =============================================================================
# 2. SECURITY GROUPS
# =============================================================================

# 2.1 SG cho Load Balancer (Public: Mở port 80)
resource "aws_security_group" "alb_sg" {
  name        = "uit-go-alb-sg"
  description = "Allow HTTP inbound traffic for ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "uit-go-alb-sg" }
}

# 2.2 SG cho App Server (Private: Chỉ nhận từ ALB và SSH)
resource "aws_security_group" "app_sg" {
  name        = "uit-go-app-sg"
  description = "Allow traffic from ALB and SSH"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] 
  }

  ingress {
    description     = "Allow traffic from ALB only"
    from_port       = 3000
    to_port         = 3002
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id] 
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "uit-go-app-sg" }
}

# 2.3 SG cho Database/Redis
resource "aws_security_group" "db_sg" {
  name        = "uit-go-db-sg"
  description = "Allow App to access DB/Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from App"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }
  ingress {
    description     = "Postgres Public Access (Dev only)"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = ["0.0.0.0/0"] 
  }
  ingress {
    description     = "Redis from App"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
  }
  tags = { Name = "uit-go-db-sg" }
}

# =============================================================================
# 3. DATABASE (RDS - Postgres)
# =============================================================================
resource "aws_db_subnet_group" "default" {
  name       = "uit-go-db-subnet-group"
  subnet_ids = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_db_instance" "postgres" {
  identifier             = "uit-go-db"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15.14"
  instance_class         = "db.t3.micro"
  db_name                = "uitgo_db"
  username               = "postgres"
  password               = "SuperSecret123"
  skip_final_snapshot    = true
  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.default.name
  backup_retention_period = 1
}

# Replica
resource "aws_db_instance" "postgres_replica" {
   identifier             = "uit-go-db-replica"
   replicate_source_db    = aws_db_instance.postgres.identifier
   instance_class         = "db.t3.micro"
   apply_immediately      = true
   publicly_accessible    = true
   skip_final_snapshot    = true
   vpc_security_group_ids = [aws_security_group.db_sg.id]
}

# =============================================================================
# 4. REDIS (ElastiCache)
# =============================================================================
resource "aws_elasticache_subnet_group" "default" {
  name       = "uit-go-redis-subnet-group"
  subnet_ids = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "uit-go-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.default.name
  security_group_ids   = [aws_security_group.db_sg.id]
}

# =============================================================================
# 5. MESSAGE QUEUE (SQS)
# =============================================================================
resource "aws_sqs_queue" "trip_queue" {
  name                      = "uit-go-trip-queue" 
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 86400
  visibility_timeout_seconds = 40
  receive_wait_time_seconds = 10
}

# =============================================================================
# 6. COMPUTE & AUTO SCALING (App Server)
# =============================================================================
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# 6.1 Launch Template
resource "aws_launch_template" "app_lt" {
  name_prefix   = "uit-go-app-lt-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "t3.small"
  key_name      = var.key_name

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.app_sg.id]
  }

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size = 20
      volume_type = "gp3"
    }
  }

  user_data = base64encode(<<-EOF
              #!/bin/bash
              # Setup Swap
              fallocate -l 2G /swapfile
              chmod 600 /swapfile
              mkswap /swapfile
              swapon /swapfile
              echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
              
              # Install Docker
              apt-get update
              apt-get install -y ca-certificates curl gnupg
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg
              echo \
                "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null
              apt-get update
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              usermod -aG docker ubuntu
              EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = { Name = "UIT-GO-App-Node" }
  }
}

# 6.2 Auto Scaling Group
resource "aws_autoscaling_group" "app_asg" {
  name                = "uit-go-asg"
  desired_capacity    = 1
  max_size            = 3
  min_size            = 1
  vpc_zone_identifier = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  launch_template {
    id      = aws_launch_template.app_lt.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "UIT-GO-App-Node"
    propagate_at_launch = true
  }
}

# 6.3 Scaling Policy
resource "aws_autoscaling_policy" "cpu_policy" {
  name                   = "uit-go-cpu-scaling"
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 50.0
  }
}

# =============================================================================
# 7. LOAD BALANCER (ALB)
# =============================================================================
resource "aws_lb" "main" {
  name               = "uit-go-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
  tags = { Name = "uit-go-alb" }
}

# Target Groups
resource "aws_lb_target_group" "user_tg" {
  name     = "uit-go-user-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  target_type = "instance"
  
  health_check { 
    path     = "/auth" 
    matcher  = "200-499"
    interval = 30 
  }
}

resource "aws_lb_target_group" "driver_tg" {
  name     = "uit-go-driver-tg"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  target_type = "instance"
  
  health_check { 
    path    = "/health" 
    matcher = "200" 
  }
}

resource "aws_lb_target_group" "trip_tg" {
  name     = "uit-go-trip-tg"
  port     = 3002
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  target_type = "instance"
  
  health_check { 
    path    = "/health" 
    matcher = "200" 
  }
}

# Listener & Rules
resource "aws_lb_listener" "front_end" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"
  
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "404: Not Found (From UIT-Go ALB)"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "user_rule" {
  listener_arn = aws_lb_listener.front_end.arn
  priority     = 100
  
  action { 
    type             = "forward" 
    target_group_arn = aws_lb_target_group.user_tg.arn 
  }
  
  condition { 
    path_pattern { 
      values = ["/auth/*", "/users/*"] 
    } 
  }
}

resource "aws_lb_listener_rule" "driver_rule" {
  listener_arn = aws_lb_listener.front_end.arn
  priority     = 200
  
  action { 
    type             = "forward" 
    target_group_arn = aws_lb_target_group.driver_tg.arn 
  }
  
  condition { 
    path_pattern { 
      values = ["/drivers", "/drivers/*"] 
    } 
  }
}

resource "aws_lb_listener_rule" "trip_rule" {
  listener_arn = aws_lb_listener.front_end.arn
  priority     = 300
  
  action { 
    type             = "forward" 
    target_group_arn = aws_lb_target_group.trip_tg.arn 
  }
  
  condition { 
    path_pattern { 
      values = ["/trips", "/trips/*"]
    } 
  }
}

# Attach ASG to Target Groups
resource "aws_autoscaling_attachment" "asg_attachment_user" {
  autoscaling_group_name = aws_autoscaling_group.app_asg.id
  lb_target_group_arn    = aws_lb_target_group.user_tg.arn
}
resource "aws_autoscaling_attachment" "asg_attachment_driver" {
  autoscaling_group_name = aws_autoscaling_group.app_asg.id
  lb_target_group_arn    = aws_lb_target_group.driver_tg.arn
}
resource "aws_autoscaling_attachment" "asg_attachment_trip" {
  autoscaling_group_name = aws_autoscaling_group.app_asg.id
  lb_target_group_arn    = aws_lb_target_group.trip_tg.arn
}

# =============================================================================
# 8. K6 LOAD TEST SERVER
# =============================================================================
resource "aws_instance" "k6_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "m7i-flex.large" 
  subnet_id     = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name      = var.key_name
  tags = { Name = "UIT-GO-K6-LoadTest" }

  user_data = <<-EOF
              #!/bin/bash
              # 1. Tối ưu Kernel cho Load Test (Quan trọng)
              echo "fs.file-max = 100000" >> /etc/sysctl.conf
              sysctl -p
              echo "* soft nofile 100000" >> /etc/security/limits.conf
              echo "* hard nofile 100000" >> /etc/security/limits.conf
              ulimit -n 100000

              # 2. Setup Swap
              fallocate -l 2G /swapfile
              chmod 600 /swapfile
              mkswap /swapfile
              swapon /swapfile
              echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

              # 3. Install K6
              apt-get update
              apt-get install -y ca-certificates curl gnupg
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              gpg -k
              gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491B6B8D6D9
              echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | tee /etc/apt/sources.list.d/k6.list
              apt-get update
              apt-get install -y k6
              EOF
}