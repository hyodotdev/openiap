#!/bin/bash

# OpenIAP Deployment Script
# This script deploys documentation to Vercel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 OpenIAP Deployment Script${NC}"
echo ""

# Read current version from openiap-versions.json. If no explicit version is
# supplied, deploy the spec version already recorded there.
CURRENT_VERSION=$(jq -r '.spec // empty' openiap-versions.json)
if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}❌ Error: Could not read .spec from openiap-versions.json${NC}"
    exit 1
fi

if [ -z "$1" ]; then
    VERSION=$CURRENT_VERSION
    echo -e "${BLUE}📦 No version supplied; using openiap-versions.json spec: $VERSION${NC}"
else
    VERSION=$1
fi

# Validate version format
if [[ "$VERSION" == v* ]] || [[ "$VERSION" == gql-* ]]; then
    echo -e "${RED}❌ Error: Version must not start with 'v' or 'gql-'${NC}"
    echo -e "${YELLOW}Please use format: 1.2.0 (not v1.2.0 or gql-1.2.0)${NC}"
    exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+(\.[0-9]+){2}(-[0-9A-Za-z.-]+)?$ ]]; then
    echo -e "${RED}❌ Error: Version must follow semantic versioning${NC}"
    echo -e "${YELLOW}Example: 1.2.0 or 1.2.0-beta.1${NC}"
    exit 1
fi

echo -e "${BLUE}📍 Current spec version: $CURRENT_VERSION${NC}"
echo -e "${GREEN}✅ Target version: $VERSION${NC}"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing globally...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed successfully${NC}"
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}🔑 Please log in to Vercel...${NC}"
    vercel login
fi

echo -e "${BLUE}🔍 Checking Git status...${NC}"

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    git status -s
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Deployment cancelled${NC}"
        exit 1
    fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: $CURRENT_BRANCH${NC}"

# Confirm deployment
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  About to deploy version: ${GREEN}$VERSION${NC}"
echo -e "${YELLOW}  From branch: ${GREEN}$CURRENT_BRANCH${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Deployment cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📦 Step 1: Preparing version files...${NC}"

# Update gql and docs versions in openiap-versions.json
if [ "$VERSION" != "$CURRENT_VERSION" ]; then
    jq --arg version "$VERSION" '.spec = $version' openiap-versions.json > openiap-versions.tmp
    mv openiap-versions.tmp openiap-versions.json
    echo -e "${GREEN}✅ Updated openiap-versions.json${NC}"
else
    echo -e "${GREEN}✅ openiap-versions.json already uses spec $VERSION${NC}"
fi

# Sync version files from root to packages
echo -e "${BLUE}📦 Syncing version files to packages...${NC}"
./scripts/sync-versions.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to sync version files${NC}"
    exit 1
fi

# Commit version changes if there are any
if [[ -n $(git status -s openiap-versions.json packages/*/openiap-versions.json 2>/dev/null) ]]; then
    echo -e "${BLUE}📝 Committing version changes...${NC}"
    git add openiap-versions.json packages/*/openiap-versions.json
    git commit -m "chore: bump spec to $VERSION"
    git push origin main
    echo -e "${GREEN}✅ Version changes committed and pushed${NC}"
fi

echo ""
echo -e "${BLUE}📦 Step 2: Building and deploying to Vercel...${NC}"

# Deploy to Vercel
cd packages/docs

echo -e "${BLUE}🔨 Running type check...${NC}"
bun run typecheck
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript errors found. Please fix them before deploying.${NC}"
    exit 1
fi

echo -e "${BLUE}🔨 Building project...${NC}"
bun run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Deploying to Vercel...${NC}"
vercel --prod
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Vercel deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Successfully deployed to Vercel${NC}"

cd ../..

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   ✅ Version files synced (spec: $VERSION)"
echo -e "   ✅ Documentation deployed to Vercel"
echo ""
echo -e "${BLUE}ℹ️  To create a GitHub release, run the Release workflow manually:${NC}"
echo -e "   ${GREEN}https://github.com/hyodotdev/openiap/actions/workflows/release.yml${NC}"
