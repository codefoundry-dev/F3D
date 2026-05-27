locals {
  # Subnet layout, derived from var.cidr via cidrsubnet() so it adapts if the
  # VPC CIDR is overridden. With the default 10.0.0.0/16 this yields:
  #   public_a  = 10.0.1.0/24
  #   private_a = 10.0.2.0/24
  #   public_b  = 10.0.11.0/24
  #   private_b = 10.0.12.0/24
  public_subnets = {
    public_a = {
      az         = var.availability_zones[0]
      cidr_block = cidrsubnet(var.cidr, 8, 1)
      purpose    = "public-a"
    }
    public_b = {
      az         = var.availability_zones[1]
      cidr_block = cidrsubnet(var.cidr, 8, 11)
      purpose    = "public-b"
    }
  }

  private_subnets = {
    private_a = {
      az         = var.availability_zones[0]
      cidr_block = cidrsubnet(var.cidr, 8, 2)
      purpose    = "private-a"
    }
    private_b = {
      az         = var.availability_zones[1]
      cidr_block = cidrsubnet(var.cidr, 8, 12)
      purpose    = "private-b"
    }
  }
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-igw"
  })
}

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  availability_zone       = each.value.az
  cidr_block              = each.value.cidr_block
  map_public_ip_on_launch = true
  vpc_id                  = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-${each.value.purpose}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  availability_zone = each.value.az
  cidr_block        = each.value.cidr_block
  vpc_id            = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-${each.value.purpose}"
    Tier = "private"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
  route_table_id         = aws_route_table.public.id
}

# Private route table is intentionally isolated — no NAT Gateway by design.
# RDS, ElastiCache and any other private-subnet workloads have no outbound
# internet need. Add a NAT (and the corresponding route) when the first
# workload appears that genuinely needs egress.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-private-rt"
  })
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  route_table_id = aws_route_table.public.id
  subnet_id      = each.value.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  route_table_id = aws_route_table.private.id
  subnet_id      = each.value.id
}
