#!/bin/bash
# deploy-cloudrun.sh — Deploy TalentIQ AI to Google Cloud Run
# Usage: ./deploy/deploy-cloudrun.sh YOUR_PROJECT_ID

set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project)}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
IMAGE="gcr.io/${PROJECT_ID}/talentiq-backend"
SERVICE="talentiq-backend"

echo "Deploying TalentIQ AI to Cloud Run"
echo "  Project: ${PROJECT_ID}"
echo "  Region:  ${REGION}"
echo "  Image:   ${IMAGE}"

# Build and push
echo "Building Docker image..."
docker build -t "${IMAGE}:latest" ./backend/
docker push "${IMAGE}:latest"

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}:latest" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --allow-unauthenticated \
  --memory=4Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=4 \
  --timeout=300 \
  --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO,ENABLE_GEMINI=true" \
  --set-secrets="GEMINI_API_KEY=talentiq-gemini-key:latest,DATABASE_URL=talentiq-db-url:latest"

URL=$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo ""
echo "Deployed successfully!"
echo "URL: ${URL}"
echo "Health: ${URL}/health"
echo "Docs:   ${URL}/docs"
