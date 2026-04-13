# Documentation Site Patterns

> **Priority: MANDATORY**
> Follow these patterns when working on packages/docs.

## Modal Pattern with Preact Signals

### Global Modal Management

**IMPORTANT**: Modals should be defined once at the app root level and managed via global state using Preact Signals.

#### 1. Signal Definition (`src/lib/signals.ts`)

```typescript
import { signal } from '@preact/signals-react';

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
    { to: '/docs/features/subscription/upgrade-downgrade', label: 'Upgrade/Downgrade' },
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

## Release Notes Pattern

### Location

Release notes are located at `packages/docs/src/pages/docs/updates/releases.tsx`.

### Adding New Release Notes

1. Add new entry at the **top** of the `allNotes` array
2. Follow the existing pattern with `id`, `date`, and `element`
3. Use semantic IDs like `gql-1-3-16-apple-1-3-14`

```tsx
const allNotes: Note[] = [
  // GQL 1.3.16 / Apple 1.3.14 - Jan 26, 2026
  {
    id: 'gql-1-3-16-apple-1-3-14',
    date: new Date('2026-01-26'),
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
