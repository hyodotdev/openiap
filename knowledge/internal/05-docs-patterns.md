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
