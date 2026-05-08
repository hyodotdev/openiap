# Documentation Site Patterns

> **Priority: MANDATORY**
> Follow these patterns when working on packages/docs.

## Modal Pattern with Preact Signals

### Global Modal Management

**IMPORTANT**: Modals should be defined once at the app root level and managed via global state using Preact Signals.

#### 1. Signal Definition (`src/lib/signals.ts`)

```typescript
import { signal } from "@preact/signals-react";

// Modal state signal
export const authModalSignal = signal({
  isOpen: false,
});

// Helper functions
export const openAuthModal = () => {
  authModalSignal.value = { isOpen: true };
};

export const closeAuthModal = () => {
  authModalSignal.value = { isOpen: false };
};
```

#### 2. Root Level Setup (`src/App.tsx`)

```typescript
import { AuthModal } from "./components/AuthModal";
import { authModalSignal, closeAuthModal } from "./lib/signals";

export default function App() {
  return (
    <>
      {/* Single modal instance at root */}
      <AuthModal
        isOpen={authModalSignal.value.isOpen}
        onClose={closeAuthModal}
      />
      {/* Rest of your app */}
    </>
  );
}
```

#### 3. Usage in Pages/Components

```typescript
import { openAuthModal } from '../lib/signals';

// In component
<button onClick={openAuthModal}>
  Sign In
</button>
```

---

## Feature Page Hierarchy (Sub-sections)

When a feature has sub-pages (e.g., Subscription > Upgrade/Downgrade, Alternative Marketplace > Onside), use a **directory structure** instead of hash anchors or flat file naming.

### Directory Structure

```
src/pages/docs/features/
├── subscription/
│   ├── index.tsx              # Main subscription page
│   └── upgrade-downgrade.tsx  # Sub-page
├── alternative-marketplace/
│   ├── index.tsx              # Main overview page
│   └── onside.tsx             # Sub-page
├── purchase.tsx               # No sub-pages → flat file
└── discount.tsx               # No sub-pages → flat file
```

### Route Registration (`docs/index.tsx`)

```tsx
// Imports
import SubscriptionFeature from './features/subscription/index';
import SubscriptionUpgradeDowngrade from './features/subscription/upgrade-downgrade';

// Routes
<Route path="features/subscription" element={<SubscriptionFeature />} />
<Route path="features/subscription/upgrade-downgrade" element={<SubscriptionUpgradeDowngrade />} />
```

### Sidebar Navigation

Use `MenuDropdown` for collapsible parent-child navigation:

```tsx
<MenuDropdown
  title="Subscription"
  titleTo="/docs/features/subscription"
  items={[
    {
      to: "/docs/features/subscription/upgrade-downgrade",
      label: "Upgrade/Downgrade",
    },
  ]}
  onItemClick={closeSidebar}
/>
```

### Rules

- **Never use hash anchors (`#section`)** for sub-section navigation in the sidebar — always use separate routes/pages
- Parent page (`index.tsx`) should contain the overview; sub-pages contain detailed content
- Import paths from sub-directories use `../../../../components/` (one level deeper)
- Update all internal `<Link to="...">` references when moving files

---

## React Component Organization

### Component Structure

#### Shared Components (`src/components/`)

- Place reusable components that are used across multiple pages/features
- If a component is only used in one place, it should be co-located with its parent

#### Scoped Component Pattern

When a component has sub-components that are only used within it:

```
// For a component with internal sub-components
src/components/AuthModal/
  ├── index.tsx        // Main AuthModal component
  └── Modal.tsx        // Modal used only within AuthModal

// If Modal is used elsewhere too
src/components/
  ├── AuthModal.tsx    // Main component
  └── Modal.tsx        // Shared modal component
```

---

## Component Layout Rules

**CRITICAL**: All components must respect parent boundaries. Children must NEVER overflow outside parent containers.

### Overflow Prevention

- ALL components must fit within parent boundaries
- Use `overflow-hidden` on parent containers when necessary
- Apply `break-words` for text content that might be long
- Use `whitespace-nowrap` for navigation items to prevent wrapping

### Clean Code Practices

- Delete unused components, functions, and imports immediately
- Don't keep commented-out code
- Remove unused variables and parameters

---

## Framework Library Listing SSOT

Framework implementation listings must be derived from
`packages/docs/src/lib/images.ts`:

- `LIBRARIES` is the canonical order and membership for framework libraries
  (Expo, React Native, Flutter, KMP, MAUI, Godot).
- Pages that show framework lists, setup links, sponsor links, or home-page
  icons must map over `LIBRARIES` instead of hand-writing their own arrays.
- When adding, removing, renaming, or reordering a framework, update
  `LIBRARIES` first and let pages derive labels, images, setup paths,
  install commands, and documentation links from that metadata.
- If a page needs new per-framework copy, add a typed field to `LibraryInfo`
  instead of creating another local list with duplicated order.

---

## Release Notes Pattern

### Location

Release notes are located at `packages/docs/src/pages/docs/updates/releases.tsx`.

### Adding New Release Notes

1. Add new entry at the **top** of the `allNotes` array
2. Follow the existing pattern with `id`, `date`, and `element`
3. Use semantic IDs like `gql-1-3-16-apple-1-3-14`
4. Verify every package version against its source of truth before writing it
   (see "Release package version verification" below)

```tsx
const allNotes: Note[] = [
  // GQL 1.3.16 / Apple 1.3.14 - Jan 26, 2026
  {
    id: "gql-1-3-16-apple-1-3-14",
    date: new Date("2026-01-26"),
    element: (
      <div key="gql-1-3-16-apple-1-3-14" style={noteCardStyle}>
        <AnchorLink id="gql-1-3-16-apple-1-3-14" level="h4">
          📅 openiap-gql v1.3.16 / openiap-apple v1.3.14 - Feature Description
        </AnchorLink>
        {/* Content here */}
      </div>
    ),
  },
  // ... older notes
];
```

### Required Elements

- **AnchorLink**: For deep linking to specific release
- **Version info**: Package names and versions in title
- **Date**: In format `new Date('YYYY-MM-DD')`
- **References**: Links to Apple/Google documentation when applicable
- **Issue links**: Reference GitHub issues when fixing bugs

### Release Package Version Verification

Release note package lists must never be guessed from memory or inferred from a
previous block. Verify each version from the package's real source of truth:

| Package                | Source of Truth                                                                  |
| ---------------------- | -------------------------------------------------------------------------------- |
| openiap-apple          | `openiap-versions.json` field `apple`, or GitHub release tag `{version}`         |
| openiap-google         | `openiap-versions.json` field `google`, or GitHub release tag `google-{version}` |
| react-native-iap       | `libraries/react-native-iap/package.json`                                        |
| expo-iap               | `libraries/expo-iap/package.json`                                                |
| flutter_inapp_purchase | `libraries/flutter_inapp_purchase/pubspec.yaml`                                  |
| godot-iap              | `libraries/godot-iap/addons/godot-iap/plugin.cfg`                                |
| kmp-iap                | `libraries/kmp-iap/gradle.properties` field `libraryVersion`                     |
| maui-iap               | `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj` field `PackageVersion` |

Before adding or editing a `Package Releases` list:

1. `git fetch origin main --tags` (or `git fetch --no-tags origin main` if
   local stale tags would fail).
2. Read the current package metadata from `origin/main`, not from memory.
3. For planned patch releases, add exactly one patch version to each affected
   framework package and label the block `Planned Package Releases`.
4. For published release links, confirm each tag exists with
   `gh release view <tag> --repo hyodotdev/openiap` before adding an `<a href>`.
5. If a release workflow is still running, keep the entry as plain text with
   planned wording. Add links only after the GitHub Release exists.

Do not use `openiap-versions.json` to derive React Native, Expo, Flutter,
Godot, KMP, or MAUI versions; that manifest tracks only `spec`, `google`, and
`apple`.
