#!/usr/bin/env bash
# Publish the site to S3 + CloudFront.
# First run creates the stack from site.yaml (CloudFront takes ~5-10 minutes
# to come up); every run after that just uploads changed files.
#
#   ./deploy/aws/deploy.sh
#   DOMAIN=www.example.ca CERT_ARN=arn:aws:acm:us-east-1:... ./deploy/aws/deploy.sh
#
# Needs the AWS CLI with credentials allowed to manage CloudFormation, S3 and CloudFront.
set -euo pipefail

STACK="${STACK:-young-mobile-mechanic}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ca-central-1}}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Deploying stack '$STACK' in $REGION..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$ROOT/deploy/aws/site.yaml" \
  --parameter-overrides "DomainName=${DOMAIN:-}" "CertificateArn=${CERT_ARN:-}" \
  --no-fail-on-empty-changeset

output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET="$(output BucketName)"
DIST="$(output DistributionId)"
URL="$(output SiteURL)"

# Upload only the public files, never the repo's docs or deploy scripts.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$ROOT/index.html" "$ROOT/favicon.svg" "$ROOT/assets" "$STAGE/"

echo "Uploading to s3://$BUCKET ..."
# Fonts, libraries and images: cached for a month.
aws s3 sync "$STAGE" "s3://$BUCKET" --region "$REGION" --delete \
  --exclude 'index.html' --exclude 'assets/css/*' --exclude 'assets/js/main.js' --exclude 'assets/fonts/*' \
  --cache-control 'public, max-age=2592000'
aws s3 sync "$STAGE/assets/fonts" "s3://$BUCKET/assets/fonts" --region "$REGION" --delete \
  --content-type 'font/woff2' --cache-control 'public, max-age=2592000'
# The site's own CSS and JS aren't fingerprinted: cached for an hour.
aws s3 sync "$STAGE" "s3://$BUCKET" --region "$REGION" \
  --exclude '*' --include 'assets/css/*' --include 'assets/js/main.js' \
  --cache-control 'public, max-age=3600'
# The page itself is always revalidated.
aws s3 cp "$STAGE/index.html" "s3://$BUCKET/index.html" --region "$REGION" \
  --content-type 'text/html; charset=utf-8' --cache-control 'public, max-age=0, must-revalidate'

aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query 'Invalidation.Id' --output text >/dev/null
echo "Done. Live at $URL (a first deploy can take a few more minutes to reach every edge location)."
