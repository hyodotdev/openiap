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
echo -e "${BLUE}📦 Step 1: Syncing version files...${NC}"

# Sync version files from root to packages
./scripts/sync-versions.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to sync version files${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🏷️  Step 2: Checking if tag exists...${NC}"

# Fetch tags from remote to ensure we have the latest
# Use --force to overwrite any conflicting local tags
git fetch --tags --force >/dev/null 2>&1 || true

# Check if tag already exists (with or without v prefix)
TAG_EXISTS=false
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    TAG_EXISTS=true
    EXISTING_TAG="v$VERSION"
elif git rev-parse "$VERSION" >/dev/null 2>&1; then
    TAG_EXISTS=true
    EXISTING_TAG="$VERSION"
fi

if [ "$TAG_EXISTS" = true ]; then
    echo -e "${YELLOW}⚠️  Tag $EXISTING_TAG already exists${NC}"
    echo -e "${BLUE}ℹ️  Skipping GitHub release creation${NC}"
    SKIP_RELEASE=true
else
    echo -e "${GREEN}✅ Tag v$VERSION does not exist${NC}"
    echo -e "${BLUE}🏷️  Creating GitHub release and tag...${NC}"
    SKIP_RELEASE=false

    # Trigger the workflow and wait for completion
    gh workflow run release.yml -f version=$VERSION

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to trigger workflow${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ GitHub Actions workflow triggered${NC}"
    echo -e "${BLUE}⏳ Waiting for workflow to complete (this may take a few minutes)...${NC}"
    echo ""

    # Wait for the workflow to start
    sleep 5

    # Get the workflow run ID
    RUN_ID=$(gh run list --workflow=release.yml --limit=1 --json databaseId --jq '.[0].databaseId')

    if [ -z "$RUN_ID" ]; then
        echo -e "${YELLOW}⚠️  Could not get workflow run ID. Please check manually.${NC}"
        echo -e "   View at: ${GREEN}https://github.com/hyodotdev/openiap/actions${NC}"
    else
        echo -e "${BLUE}📊 Workflow Status:${NC}"
        echo -e "   Run ID: ${GREEN}$RUN_ID${NC}"
        echo -e "   View at: ${GREEN}https://github.com/hyodotdev/openiap/actions/runs/$RUN_ID${NC}"
        echo ""

        # Watch the workflow
        gh run watch $RUN_ID

        # Check if workflow succeeded
        WORKFLOW_STATUS=$(gh run view $RUN_ID --json conclusion --jq '.conclusion')

        if [ "$WORKFLOW_STATUS" != "success" ]; then
            echo -e "${RED}❌ Workflow failed with status: $WORKFLOW_STATUS${NC}"
            echo -e "${YELLOW}Please check the workflow logs and fix any issues before deploying.${NC}"
            exit 1
        fi

        echo -e "${GREEN}✅ Workflow completed successfully${NC}"
        echo -e "   - Git tag ${GREEN}v$VERSION${NC} created"
        echo -e "   - GitHub release created with artifacts"
        echo ""
    fi
fi

echo ""
echo -e "${BLUE}📦 Step 3: Building and deploying to Vercel...${NC}"

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
echo -e "   ✅ Version files synced"

if [ "$SKIP_RELEASE" = true ]; then
    echo -e "   ⏭️  Git tag: ${YELLOW}v$VERSION${NC} (already exists, skipped)"
    echo -e "   ⏭️  GitHub release: ${YELLOW}https://github.com/hyodotdev/openiap/releases/tag/v$VERSION${NC} (already exists)"
else
    echo -e "   ✅ Git tag: ${GREEN}v$VERSION${NC}"
    echo -e "   ✅ GitHub release: ${GREEN}https://github.com/hyodotdev/openiap/releases/tag/v$VERSION${NC}"
    echo ""
    echo -e "${BLUE}ℹ️  Release artifacts available:${NC}"
    echo -e "   - openiap-typescript.zip"
    echo -e "   - openiap-dart.zip"
    echo -e "   - openiap-kotlin.zip"
    echo -e "   - openiap-swift.zip"
fi

echo ""
echo -e "   ✅ Documentation deployed to Vercel"
