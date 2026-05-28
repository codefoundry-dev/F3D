# Example tfvars for the prod env. Copy to prod.auto.tfvars (gitignored) and fill in.

# Required: SNS subscriber for alerts. AWS sends a one-time confirmation link.
notification_email = "alerts@example.com"

# Optional overrides:
# domain_name             = "api.forethread.com"
# web_app_origin          = "https://app.forethread.com"
# ec2_instance_type       = "t4g.small"
# ec2_root_volume_size_gb = 30
# rds_instance_class      = "db.t4g.micro"
# rds_backup_retention_days = 30
# redis_node_type         = "cache.t4g.micro"
# redis_snapshot_retention_limit = 1
