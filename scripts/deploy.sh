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
EXPECTED_VERCEL_PROJECT_ID="prj_ZWRXid0aTL9bzMimBEb4T2PHD3P1"
EXPECTED_VERCEL_ORG_ID="team_qB5U5TU9IKqAL2KyQsj0duy3"

echo -e "${BLUE}🚀 OpenIAP Deployment Script${NC}"
echo ""

# The docs site is not versioned. Only the Client Protocol and the Commerce
# Protocol carry versions, each in its own package manifest.
if [ -n "${1:-}" ]; then
    echo -e "${RED}❌ Error: the docs site has no version to select${NC}"
    echo -e "${YELLOW}Received '$1'. Run the script with no arguments.${NC}"
    exit 1
fi

# Version metadata still has to be internally consistent before it ships.
if ! node scripts/release-branch-policy.mjs assert-client-protocol; then
    echo -e "${RED}❌ Refusing to deploy inconsistent version metadata${NC}"
    exit 1
fi

# Production docs are stable-only and deploy from main.
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: $CURRENT_BRANCH${NC}"
if [ "$CURRENT_BRANCH" != "main" ]; then
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

# Release cards merge before their packages publish, so deploy only once every
# linked GitHub Release exists; workflows push the tag first and release last.
echo -e "${BLUE}🔗 Checking release links...${NC}"
RELEASES_PAGE="packages/docs/src/pages/docs/updates/releases.tsx"
if [ ! -f "$RELEASES_PAGE" ]; then
    echo -e "${RED}❌ $RELEASES_PAGE is missing; update this check${NC}"
    exit 1
fi
# Older cards that link releases which never published; drop each once its card is fixed.
UNPUBLISHED_HISTORY="2.1.6 2.2.2 3.5.0 apple-2.0.0 flutter-iap-10.6.2 google-3.5.3 kmp-iap-3.5.2 maui-iap-1.0.1 maui-iap-2.5.1"
if ! PUBLISHED_RELEASES=$(gh release list --repo hyodotdev/openiap --limit 5000 \
    --exclude-drafts --json tagName --jq '.[].tagName'); then
    echo -e "${RED}❌ Could not list GitHub Releases; install gh and run gh auth login${NC}"
    exit 1
fi
LINKED_TAGS=$(
    {
        grep -oE "hyodotdev/openiap/releases/tag/[A-Za-z0-9._-]+" "$RELEASES_PAGE" | sed 's|.*/tag/||' || true
        grep -oE "tag: '[^']+'" "$RELEASES_PAGE" | sed -E "s/tag: '(.*)'/\1/" || true
    } | sort -u
)
if [ -z "$LINKED_TAGS" ]; then
    echo -e "${RED}❌ Found no release links in $RELEASES_PAGE; update this check${NC}"
    exit 1
fi
UNPUBLISHED_LINKS=$(grep -vxF -f <(printf '%s\n' $PUBLISHED_RELEASES $UNPUBLISHED_HISTORY) \
    <<< "$LINKED_TAGS" || true)
if [ -n "$UNPUBLISHED_LINKS" ]; then
    echo -e "${RED}❌ The release page links releases that are not published yet:${NC}"
    echo "$UNPUBLISHED_LINKS"
    echo -e "${YELLOW}Finish the release train, or trim its card to the packages that published.${NC}"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing v${VERCEL_CLI_VERSION} globally...${NC}"
    npm install -g "vercel@$VERCEL_CLI_VERSION"
    echo -e "${GREEN}✅ Vercel CLI installed successfully${NC}"
fi

VERCEL_PROJECT_FILE="packages/docs/.vercel/project.json"
if ! jq -e \
    --arg projectId "$EXPECTED_VERCEL_PROJECT_ID" \
    --arg orgId "$EXPECTED_VERCEL_ORG_ID" '
    (.projectId == $projectId) and
    (.orgId == $orgId) and
    (.projectName == "openiap")
' "$VERCEL_PROJECT_FILE" >/dev/null 2>&1; then
    echo -e "${RED}❌ packages/docs is not linked to the OpenIAP Vercel project${NC}"
    echo -e "${YELLOW}Run 'cd packages/docs && vercel link' before deploying.${NC}"
    exit 1
fi

if [ -n "${VERCEL_PROJECT_ID:-}" ] || [ -n "${VERCEL_ORG_ID:-}" ]; then
    if [ "${VERCEL_PROJECT_ID:-}" != "$EXPECTED_VERCEL_PROJECT_ID" ] || \
        [ "${VERCEL_ORG_ID:-}" != "$EXPECTED_VERCEL_ORG_ID" ]; then
        echo -e "${RED}❌ Vercel environment target conflicts with the OpenIAP project${NC}"
        echo -e "${YELLOW}Unset VERCEL_PROJECT_ID and VERCEL_ORG_ID, or set both to the expected project.${NC}"
        exit 1
    fi
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}🔑 Please log in to Vercel...${NC}"
    vercel login
fi

# Confirm deployment
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  About to deploy the production docs site${NC}"
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
    echo -e "${YELLOW}Commit the canonical version metadata before deploying.${NC}"
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

# The docs package depends on the workspace-local `@hyodotdev/openiap-commerce-protocol`
# package, which Vercel's remote `bun install` cannot resolve from an upload
# of packages/docs alone. Build locally (where the workspace exists) and ship
# the prebuilt output instead of letting Vercel install and build remotely.
echo -e "${BLUE}🚀 Building prebuilt output and deploying to Vercel...${NC}"
if ! vercel pull --yes --environment=production; then
    echo -e "${RED}❌ vercel pull failed${NC}"
    exit 1
fi
if ! vercel build --prod --yes; then
    echo -e "${RED}❌ vercel build failed${NC}"
    exit 1
fi
if ! VERCEL_DEPLOYMENT=$(vercel --prebuilt --prod --yes --format=json --non-interactive); then
    echo -e "${RED}❌ Vercel deployment failed${NC}"
    exit 1
fi

if ! DEPLOYMENT_URL=$(printf '%s' "$VERCEL_DEPLOYMENT" | jq -er '
    (.deployment // .)
    | select(.readyState == "READY" and .target == "production")
    | .url
    | select(type == "string" and startswith("https://"))
'); then
    echo -e "${RED}❌ Vercel CLI returned no ready production deployment${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Successfully deployed to Vercel: $DEPLOYMENT_URL${NC}"

cd ../..

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   ✅ Version metadata verified"
echo -e "   ✅ Documentation deployed to Vercel"
