#!/bin/bash

# OpenIAP.dev Vercel Deployment Script
# This script handles local deployment to Vercel for organization repositories

set -euo pipefail

echo "🚀 Starting OpenIAP.dev deployment to Vercel..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
VERCEL_CLI_VERSION="54.0.0"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing v${VERCEL_CLI_VERSION} globally...${NC}"
    npm install -g "vercel@$VERCEL_CLI_VERSION"
    echo -e "${GREEN}✅ Vercel CLI installed successfully${NC}"
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}🔑 Please log in to Vercel...${NC}"
    vercel login
fi

echo -e "${BLUE}📦 Building project...${NC}"

# Run type checking and build
if ! bun run typecheck; then
    echo -e "${RED}❌ TypeScript errors found. Please fix them before deploying.${NC}"
    exit 1
fi

if ! bun run build; then
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Deploy to Vercel
echo -e "${BLUE}🚀 Deploying to Vercel...${NC}"

# Check if this is the first deployment
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${YELLOW}🔧 First time deployment detected. Setting up project...${NC}"
    vercel --prod
else
    vercel --prod
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo -e "${BLUE}🔗 Your site is now live on Vercel${NC}"
else
    echo -e "${RED}❌ Deployment failed. Check the errors above.${NC}"
    exit 1
fi
