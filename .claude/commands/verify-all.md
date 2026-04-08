# Verify All — Full Monorepo Health Check

Run this before committing or creating a PR to verify the entire monorepo is healthy.

## Checks

### 1. Build Verification
```bash
# Docs typecheck
cd packages/docs && npx tsc --noEmit

# Swift build (packages/apple)
cd packages/apple && swift build

# GQL types are in sync
./scripts/sync-versions.sh
```

### 2. Type Consistency
Verify `DuplicatePurchase` (and any new ErrorCode) exists in ALL generated types:
```bash
for f in packages/gql/src/generated/types.ts \
         libraries/react-native-iap/src/types.ts \
         libraries/expo-iap/src/types.ts \
         libraries/flutter_inapp_purchase/lib/types.dart \
         libraries/godot-iap/addons/godot-iap/types.gd \
         packages/apple/Sources/Models/Types.swift \
         packages/google/openiap/src/main/Types.kt; do
  echo "$f: $(grep -c 'DuplicatePurchase' $f 2>/dev/null || echo MISSING)"
done
```

Also verify `COMMON_ERROR_CODE_MAP` in react-native-iap and expo-iap includes all ErrorCode entries:
- `libraries/react-native-iap/src/utils/errorMapping.ts`
- `libraries/expo-iap/src/utils/errorMapping.ts`

And Swift switch exhaustiveness:
- `packages/apple/Sources/Models/OpenIapError.swift`
- `packages/apple/Sources/OpenIapModule.swift`

### 3. Symlinks Valid
```bash
for lib in react-native-iap expo-iap flutter_inapp_purchase godot-iap kmp-iap; do
  [ -L "libraries/$lib/openiap-versions.json" ] && [ -f "libraries/$lib/openiap-versions.json" ] && echo "$lib: OK" || echo "$lib: BROKEN"
done
```

### 4. No Broken References
```bash
# Deleted images still referenced
grep -rn "openiap-apple.png\|openiap-google.png" --include="*.tsx" packages/docs/src/

# Non-spec API names in docs
grep -rn "getProducts\b\|buyProduct\|completePurchase" --include="*.tsx" packages/docs/src/

# Old hyochan repo links (non-issue)
grep -rn "github.com/hyochan/" --include="*.tsx" --include="*.ts" packages/docs/src/ | grep -v "issues/" | grep -v "discussions/"
```

### 5. LLM Files
```bash
# DuplicatePurchase in llms files
grep "duplicate-purchase" llms.txt llms-full.txt packages/docs/public/llms-full.txt

# llms-full.txt synced
diff llms-full.txt packages/docs/public/llms-full.txt
```

### 6. Documentation
- All 5 framework setup pages exist: `packages/docs/src/pages/docs/setup/{react-native,expo,flutter,godot,kmp}.tsx`
- Testing & Sandbox guide exists: `packages/docs/src/pages/docs/guides/testing.tsx`
- All LanguageTabs have KMP tab where kotlin tab exists
- GDScript examples use `await` for async calls

### 7. CI Workflows
All release workflows exist and have valid YAML:
```bash
ls .github/workflows/release-{apple,google,react-native,expo,flutter,godot,kmp}.yml
```

### 8. CLAUDE.md
- Root CLAUDE.md lists all 5 library CLAUDE.md files
- `knowledge/internal/02-architecture.md` includes `libraries/` in structure
- Auto-generated files list includes library types

## Quick One-Liner
```bash
cd packages/docs && npx tsc --noEmit && cd ../apple && swift build && cd ../.. && echo "BUILD OK" && \
grep -rn "openiap-apple.png\|openiap-google.png\|getProducts\b\|buyProduct\|completePurchase" --include="*.tsx" packages/docs/src/ | grep -v node_modules | wc -l | xargs -I {} sh -c '[ {} -eq 0 ] && echo "REFS OK" || echo "REFS BROKEN: {} issues"' && \
diff llms-full.txt packages/docs/public/llms-full.txt > /dev/null 2>&1 && echo "LLMS SYNCED" || echo "LLMS OUT OF SYNC"
```
