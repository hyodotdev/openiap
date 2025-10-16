#!/bin/bash

# OpenIAP Deployment Script
# This script deploys to Vercel and creates a GitHub release

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 OpenIAP Deployment Script${NC}"
echo ""

# Check if version is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Version number is required${NC}"
    echo -e "${YELLOW}Usage: npm run deploy <version>${NC}"
    echo -e "${YELLOW}Example: npm run deploy 1.2.0${NC}"
    exit 1
fi

VERSION=$1

# Validate version format
if [[ "$VERSION" == v* ]]; then
    echo -e "${RED}❌ Error: Version must not start with 'v'${NC}"
    echo -e "${YELLOW}Please use format: 1.2.0 (not v1.2.0)${NC}"
    exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+(\.[0-9]+){2}(-[0-9A-Za-z.-]+)?$ ]]; then
    echo -e "${RED}❌ Error: Version must follow semantic versioning${NC}"
    echo -e "${YELLOW}Example: 1.2.0 or 1.2.0-beta.1${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Version format validated: $VERSION${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed${NC}"
    echo -e "${YELLOW}Install it from: https://cli.github.com/${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}🔑 Please authenticate with GitHub...${NC}"
    gh auth login
fi

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
echo -e "${BLUE}📦 Step 1: Building and deploying to Vercel...${NC}"

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
echo -e "${BLUE}🏷️  Step 2: Creating GitHub release...${NC}"

# Trigger the workflow
gh workflow run release.yml -f version=$VERSION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ GitHub Actions workflow triggered successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Workflow Status:${NC}"
    echo -e "   View at: ${GREEN}https://github.com/hyodotdev/openiap/actions${NC}"
    echo ""
    echo -e "${BLUE}ℹ️  The workflow will:${NC}"
    echo -e "   1. Validate the version format"
    echo -e "   2. Regenerate types for all platforms"
    echo -e "   3. Create release artifacts (TypeScript, Dart, Kotlin, Swift)"
    echo -e "   4. Create Git tag: ${GREEN}v$VERSION${NC}"
    echo -e "   5. Create GitHub release with artifacts"
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${YELLOW}💡 Tip: Check the Actions tab on GitHub to monitor progress${NC}"

    # Wait a moment and try to show the latest workflow run
    sleep 2
    echo ""
    echo -e "${BLUE}📋 Recent workflow runs:${NC}"
    gh run list --workflow=release.yml --limit=3
else
    echo -e "${RED}❌ Failed to trigger workflow${NC}"
    exit 1
fi
