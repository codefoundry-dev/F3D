output "bucket_name" {
  description = "Name of the uploads bucket. Plug into the backend's S3_BUCKET env var."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "ARN of the bucket. Pass to compute-ec2's s3_bucket_arns input so the instance role gets least-privilege access."
  value       = aws_s3_bucket.this.arn
}

output "bucket_regional_domain_name" {
  description = "Regional S3 endpoint for the bucket. Useful when constructing absolute URLs."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}
