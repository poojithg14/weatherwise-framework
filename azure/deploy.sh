#!/usr/bin/env bash
# ============================================================================
# WeatherWise -- Azure Container Apps Deployment
# ============================================================================
# Deploys all 4 services (db, backend, ml, frontend) to Azure Container Apps.
#
# Prerequisites:
#   - Azure CLI logged in (az login)
#   - Docker images pushed to an Azure Container Registry (ACR)
#
# Usage:
#   ./azure/deploy.sh
#
# Environment variables (set before running or edit defaults below):
#   RESOURCE_GROUP    - Azure resource group name
#   LOCATION          - Azure region (default: eastus)
#   ACR_NAME          - Azure Container Registry name
#   ENV_NAME          - Container Apps Environment name
#   DB_PASSWORD       - PostgreSQL password (required)
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via environment variables)
# ---------------------------------------------------------------------------
RESOURCE_GROUP="${RESOURCE_GROUP:-weatherwise-rg}"
LOCATION="${LOCATION:-eastus}"
ACR_NAME="${ACR_NAME:-weatherwiseacr}"
ENV_NAME="${ENV_NAME:-weatherwise-env}"
DB_PASSWORD="${DB_PASSWORD:?ERROR: Set DB_PASSWORD environment variable}"
DB_USERNAME="${DB_USERNAME:-postgres}"

ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

echo "============================================"
echo "  WeatherWise Azure Deployment"
echo "============================================"
echo "  Resource Group:  ${RESOURCE_GROUP}"
echo "  Location:        ${LOCATION}"
echo "  ACR:             ${ACR_LOGIN_SERVER}"
echo "  Environment:     ${ENV_NAME}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Create resource group
# ---------------------------------------------------------------------------
echo "[1/8] Creating resource group ..."
az group create \
  --name "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --output none

# ---------------------------------------------------------------------------
# Step 2: Create ACR (if not exists)
# ---------------------------------------------------------------------------
echo "[2/8] Ensuring Container Registry exists ..."
az acr show --name "${ACR_NAME}" --output none 2>/dev/null || \
  az acr create \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${ACR_NAME}" \
    --sku Basic \
    --admin-enabled true \
    --output none

# ---------------------------------------------------------------------------
# Step 3: Build and push images
# ---------------------------------------------------------------------------
echo "[3/8] Building and pushing Docker images ..."

az acr login --name "${ACR_NAME}"

# Backend
echo "  Building backend ..."
az acr build \
  --registry "${ACR_NAME}" \
  --image weatherwise-backend:latest \
  --file backend/Dockerfile \
  backend/

# ML service
echo "  Building ML service ..."
az acr build \
  --registry "${ACR_NAME}" \
  --image weatherwise-ml:latest \
  --file ml/Dockerfile \
  ml/

# Frontend
echo "  Building frontend ..."
az acr build \
  --registry "${ACR_NAME}" \
  --image weatherwise-frontend:latest \
  --file frontend/Dockerfile \
  frontend/

# ---------------------------------------------------------------------------
# Step 4: Create Container Apps environment
# ---------------------------------------------------------------------------
echo "[4/8] Creating Container Apps environment ..."
az containerapp env create \
  --name "${ENV_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --output none 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 5: Deploy PostgreSQL (Azure Database for PostgreSQL Flexible Server)
# ---------------------------------------------------------------------------
echo "[5/8] Creating PostgreSQL Flexible Server ..."
PG_SERVER_NAME="weatherwise-pg"

az postgres flexible-server show \
  --name "${PG_SERVER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --output none 2>/dev/null || \
az postgres flexible-server create \
  --name "${PG_SERVER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --admin-user "${DB_USERNAME}" \
  --admin-password "${DB_PASSWORD}" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0 \
  --output none

# Create database
az postgres flexible-server db show \
  --server-name "${PG_SERVER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --database-name weatherwise \
  --output none 2>/dev/null || \
az postgres flexible-server db create \
  --server-name "${PG_SERVER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --database-name weatherwise \
  --output none

# Enable PostGIS
az postgres flexible-server parameter set \
  --server-name "${PG_SERVER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --name azure.extensions \
  --value POSTGIS \
  --output none 2>/dev/null || true

PG_FQDN=$(az postgres flexible-server show \
  --name "${PG_SERVER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query fullyQualifiedDomainName -o tsv)

DB_URL="jdbc:postgresql://${PG_FQDN}:5432/weatherwise?sslmode=require"
echo "  PostgreSQL: ${PG_FQDN}"

# Get ACR credentials
ACR_PASSWORD=$(az acr credential show \
  --name "${ACR_NAME}" \
  --query "passwords[0].value" -o tsv)

# ---------------------------------------------------------------------------
# Step 6: Deploy ML service
# ---------------------------------------------------------------------------
echo "[6/8] Deploying ML service ..."
az containerapp create \
  --name weatherwise-ml \
  --resource-group "${RESOURCE_GROUP}" \
  --environment "${ENV_NAME}" \
  --image "${ACR_LOGIN_SERVER}/weatherwise-ml:latest" \
  --registry-server "${ACR_LOGIN_SERVER}" \
  --registry-username "${ACR_NAME}" \
  --registry-password "${ACR_PASSWORD}" \
  --target-port 5000 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    ML_PORT=5000 \
    CORS_ORIGINS="*" \
  --output none 2>/dev/null || \
az containerapp update \
  --name weatherwise-ml \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${ACR_LOGIN_SERVER}/weatherwise-ml:latest" \
  --output none

ML_FQDN=$(az containerapp show \
  --name weatherwise-ml \
  --resource-group "${RESOURCE_GROUP}" \
  --query "properties.configuration.ingress.fqdn" -o tsv)
ML_URL="https://${ML_FQDN}"
echo "  ML service: ${ML_URL}"

# ---------------------------------------------------------------------------
# Step 7: Deploy Backend
# ---------------------------------------------------------------------------
echo "[7/8] Deploying Backend ..."
az containerapp create \
  --name weatherwise-backend \
  --resource-group "${RESOURCE_GROUP}" \
  --environment "${ENV_NAME}" \
  --image "${ACR_LOGIN_SERVER}/weatherwise-backend:latest" \
  --registry-server "${ACR_LOGIN_SERVER}" \
  --registry-username "${ACR_NAME}" \
  --registry-password "${ACR_PASSWORD}" \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    DB_URL="${DB_URL}" \
    DB_USERNAME="${DB_USERNAME}" \
    DB_PASSWORD="${DB_PASSWORD}" \
    ML_SERVICE_URL="${ML_URL}" \
    SPRING_PROFILES_ACTIVE=prod \
    NWS_API_BASE_URL=https://api.weather.gov \
    OSRM_API_URL=http://router.project-osrm.org \
  --output none 2>/dev/null || \
az containerapp update \
  --name weatherwise-backend \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${ACR_LOGIN_SERVER}/weatherwise-backend:latest" \
  --set-env-vars \
    DB_URL="${DB_URL}" \
    DB_USERNAME="${DB_USERNAME}" \
    DB_PASSWORD="${DB_PASSWORD}" \
    ML_SERVICE_URL="${ML_URL}" \
  --output none

BACKEND_FQDN=$(az containerapp show \
  --name weatherwise-backend \
  --resource-group "${RESOURCE_GROUP}" \
  --query "properties.configuration.ingress.fqdn" -o tsv)
BACKEND_URL="https://${BACKEND_FQDN}"
echo "  Backend: ${BACKEND_URL}"

# ---------------------------------------------------------------------------
# Step 8: Deploy Frontend
# ---------------------------------------------------------------------------
echo "[8/8] Deploying Frontend ..."
az containerapp create \
  --name weatherwise-frontend \
  --resource-group "${RESOURCE_GROUP}" \
  --environment "${ENV_NAME}" \
  --image "${ACR_LOGIN_SERVER}/weatherwise-frontend:latest" \
  --registry-server "${ACR_LOGIN_SERVER}" \
  --registry-username "${ACR_NAME}" \
  --registry-password "${ACR_PASSWORD}" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --output none 2>/dev/null || \
az containerapp update \
  --name weatherwise-frontend \
  --resource-group "${RESOURCE_GROUP}" \
  --image "${ACR_LOGIN_SERVER}/weatherwise-frontend:latest" \
  --output none

FRONTEND_FQDN=$(az containerapp show \
  --name weatherwise-frontend \
  --resource-group "${RESOURCE_GROUP}" \
  --query "properties.configuration.ingress.fqdn" -o tsv)
FRONTEND_URL="https://${FRONTEND_FQDN}"
echo "  Frontend: ${FRONTEND_URL}"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo "  Frontend:  ${FRONTEND_URL}"
echo "  Backend:   ${BACKEND_URL}"
echo "  GraphQL:   ${BACKEND_URL}/graphql"
echo "  ML:        ${ML_URL}"
echo "  Database:  ${PG_FQDN}"
echo ""
echo "  Run simulation against cloud:"
echo "    python evaluation/run_simulation.py --backend-url ${BACKEND_URL}/graphql"
echo ""
