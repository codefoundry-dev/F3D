output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "CIDR block assigned to the VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs ordered [AZ-a, AZ-b]."
  value       = [aws_subnet.public["public_a"].id, aws_subnet.public["public_b"].id]
}

output "private_subnet_ids" {
  description = "Private subnet IDs ordered [AZ-a, AZ-b]. These subnets have no internet route."
  value       = [aws_subnet.private["private_a"].id, aws_subnet.private["private_b"].id]
}

output "availability_zones" {
  description = "Availability zones used by this module, ordered [AZ-a, AZ-b]."
  value       = var.availability_zones
}
