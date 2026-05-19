# ─────────────────────────────────────────────────────────────
# S3 Module — Document storage + Frontend static hosting
# ─────────────────────────────────────────────────────────────

variable "app_name"    {}
variable "environment" {}

# ─── Document Storage (invoices, receipts) ───────────────────
resource "aws_s3_bucket" "documents" {
  bucket = "${var.app_name}-documents-${var.environment}"
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Frontend Static Hosting ──────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.app_name}-frontend-${var.environment}"
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  index_document { suffix = "index.html" }
  error_document { key = "index.html" }   # SPA — all 404s → index.html
}

resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend.bucket}"
  }

  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.bucket}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"   # React router handles 404s
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ─── Outputs ─────────────────────────────────────────────────
output "documents_bucket_name" { value = aws_s3_bucket.documents.bucket }
output "frontend_bucket_name"  { value = aws_s3_bucket.frontend.bucket }
output "cloudfront_domain"     { value = aws_cloudfront_distribution.frontend.domain_name }
output "cloudfront_id"         { value = aws_cloudfront_distribution.frontend.id }
