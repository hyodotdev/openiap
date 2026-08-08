#!/bin/bash

# OpenIAP Deployment Script
# This script deploys documentation to Vercel

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
VERCEL_CLI_VERSION="54.0.0"

echo -e "${BLUE}🚀 OpenIAP Deployment Script${NC}"
echo ""

# The shared spec is derived from the lower Apple/Google native version.
# Production deployment may only publish that already-recorded floor.
if ! node scripts/release-branch-policy.mjs assert-floor; then
    echo -e "${RED}❌ Refusing to deploy inconsistent version metadata${NC}"
    exit 1
fi

CURRENT_VERSION=$(jq -r '.spec // empty' openiap-versions.json)
if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}❌ Error: Could not read .spec from openiap-versions.json${NC}"
    exit 1
fi

VERSION=$CURRENT_VERSION
if [ -n "${1:-}" ] && [ "$1" != "$VERSION" ]; then
    echo -e "${RED}❌ Error: OpenIAP Spec cannot be bumped independently${NC}"
    echo -e "${YELLOW}Expected the native version floor $VERSION, received $1${NC}"
    exit 1
fi
echo -e "${BLUE}📦 Using derived OpenIAP Spec version: $VERSION${NC}"

# Validate version format
if [[ "$VERSION" == v* ]] || [[ "$VERSION" == gql-* ]]; then
    echo -e "${RED}❌ Error: Version must not start with 'v' or 'gql-'${NC}"
    echo -e "${YELLOW}Please use format: 1.2.0 (not v1.2.0 or gql-1.2.0)${NC}"
    exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+(\.[0-9]+){2}$ ]]; then
    echo -e "${RED}❌ Error: Version must follow semantic versioning${NC}"
    echo -e "${YELLOW}Production docs accept stable versions only (example: 2.1.0)${NC}"
    exit 1
fi

echo -e "${BLUE}📍 Current spec version: $CURRENT_VERSION${NC}"
echo -e "${GREEN}✅ Target version: $VERSION${NC}"
echo ""

# Production docs are stable-only and release from main.
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: $CURRENT_BRANCH${NC}"
if ! node scripts/release-branch-policy.mjs guard docs current false "$CURRENT_BRANCH" "$VERSION"; then
    echo -e "${RED}❌ Production docs must deploy from the stable main branch${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Checking Git status...${NC}"

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}❌ Production deployment requires a clean worktree${NC}"
    git status -s
    exit 1
fi

# Refuse stale, ahead-only, or otherwise unpublished main snapshots. Production
# docs must match the exact commit currently recorded by origin/main.
echo -e "${BLUE}🔄 Verifying origin/main...${NC}"
if ! git fetch --no-tags origin main; then
    echo -e "${RED}❌ Could not refresh origin/main${NC}"
    exit 1
fi
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/main)
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
    echo -e "${RED}❌ Local main must exactly match origin/main before deployment${NC}"
    echo -e "${YELLOW}Run git pull --ff-only origin main, or push/reconcile local commits first.${NC}"
    exit 1
fi

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
echo -e "${BLUE}📦 Step 1: Verifying synchronized version files...${NC}"

# Sync version files from root to packages
echo -e "${BLUE}📦 Syncing version files to packages...${NC}"
if ! ./scripts/sync-versions.sh; then
    echo -e "${RED}❌ Failed to sync version files${NC}"
    exit 1
fi

if [[ -n $(git status -s) ]]; then
    echo -e "${RED}❌ Version metadata was not synchronized on main${NC}"
    echo -e "${YELLOW}Commit the canonical native-derived metadata before deploying.${NC}"
    git status -s
    exit 1
fi

echo ""
echo -e "${BLUE}📦 Step 2: Building and deploying to Vercel...${NC}"

# Deploy to Vercel
cd packages/docs

echo -e "${BLUE}🔨 Running type check...${NC}"
if ! bun run typecheck; then
    echo -e "${RED}❌ TypeScript errors found. Please fix them before deploying.${NC}"
    exit 1
fi

echo -e "${BLUE}🔨 Building project...${NC}"
if ! bun run build; then
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Deploying to Vercel...${NC}"
if ! vercel --prod; then
    echo -e "${RED}❌ Vercel deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Successfully deployed to Vercel${NC}"

cd ../..

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   ✅ Version files verified (derived spec: $VERSION)"
echo -e "   ✅ Documentation deployed to Vercel"
echo ""
DOCS_TAG="docs-$VERSION"
if git ls-remote --exit-code --tags origin "refs/tags/$DOCS_TAG" "refs/tags/$DOCS_TAG^{}" >/dev/null 2>&1; then
    echo -e "${BLUE}ℹ️  $DOCS_TAG already exists, so no new Docs GitHub Release is needed.${NC}"
else
    echo -e "${BLUE}ℹ️  The derived spec has no Docs GitHub Release yet. Run the Release workflow:${NC}"
    echo -e "   ${GREEN}https://github.com/hyodotdev/openiap/actions/workflows/release.yml${NC}"
fi
