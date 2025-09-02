# Project Guidelines for Claude

## API Naming Conventions (expo-iap/react-native-iap)

### Platform-Specific Function Naming

This project follows the expo-iap naming conventions for clarity and consistency:

#### 1. iOS-Specific Functions (IOS suffix)
All iOS-only functions must end with `IOS`:
- `clearTransactionIOS`
- `clearProductsIOS`
- `getStorefrontIOS`
- `getPromotedProductIOS`
- `requestPurchaseOnPromotedProductIOS`
- `getPendingTransactionsIOS`
- `isEligibleForIntroOfferIOS`
- `subscriptionStatusIOS`
- `currentEntitlementIOS`
- `latestTransactionIOS`
- `showManageSubscriptionsIOS`
- `beginRefundRequestIOS`
- `isTransactionVerifiedIOS`
- `getTransactionJwsIOS`
- `getReceiptDataIOS`
- `syncIOS`
- `presentCodeRedemptionSheetIOS`
- `getAppTransactionIOS`

#### 2. Android-Specific Functions (Android suffix)
All Android-only functions must end with `Android`:
- `acknowledgePurchaseAndroid`
- `consumePurchaseAndroid`
- `flushFailedPurchaseCachedAsPendingAndroid`
- `getPackageNameAndroid`

#### 3. Cross-Platform Functions (No suffix)
Functions available on both platforms have no suffix:
- `requestProducts` - Get product information
- `requestPurchase` - Initiate purchase
- `getAvailablePurchases` - Get user's purchases
- `finishTransaction` - Complete transaction
- `validateReceipt` - Validate purchase receipt
- `initConnection` - Initialize store connection
- `endConnection` - Close store connection
- `getActiveSubscriptions` - Get active subscriptions
- `hasActiveSubscriptions` - Check subscription status
- `deepLinkToSubscriptions` - Open subscription management

### Naming Rules

1. **Platform Suffixes**:
   - iOS only: `functionNameIOS`
   - Android only: `functionNameAndroid`
   - Cross-platform: no suffix

2. **Action Prefixes**:
   - `get` - Retrieve data (e.g., `getPromotedProductIOS`)
   - `request` - Async operations/requests (e.g., `requestPurchase`)
   - `clear` - Remove/reset (e.g., `clearTransactionIOS`)
   - `is/has` - Boolean checks (e.g., `isEligibleForIntroOfferIOS`)
   - `show/present` - Display UI (e.g., `showManageSubscriptionsIOS`)
   - `begin` - Start a process (e.g., `beginRefundRequestIOS`)
   - `finish/end` - Complete a process (e.g., `finishTransaction`)

3. **URL Anchors**: Use kebab-case for all URL anchors:
   - Function: `requestProducts` → Anchor: `#request-products`
   - Function: `getAppTransactionIOS` → Anchor: `#get-app-transaction-ios`

4. **Search IDs**: Use kebab-case for search modal IDs:
   - Correct: `id: 'request-products'`
   - Incorrect: `id: 'requestproducts'`

### Deprecated Functions
- `buyPromotedProductIOS` → Use `requestPurchaseOnPromotedProductIOS`

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

#### 4. Modal Implementation Best Practices

- Use React Portal to render outside DOM hierarchy
- Prevent body scroll when modal is open
- Handle escape key and backdrop clicks
- Maintain scroll position when closing

```typescript
export function Modal({ isOpen, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scrolling
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Modal content */}
      </div>
    </>,
    document.body
  );
}
```

### Benefits

1. **No duplicate modals**: Single instance at root level
2. **No prop drilling**: Access modal state from anywhere
3. **Better performance**: Only one modal in DOM
4. **Consistent behavior**: Same modal instance everywhere
5. **No scroll issues**: Proper scroll management

## React Component Organization Rules

### 1. Component Structure

#### Shared Components (`src/components/`)

- Place reusable components that are used across multiple pages/features
- If a component is only used in one place, it should be co-located with its parent

#### Scoped Component Pattern

When a component has sub-components that are only used within it, create a folder structure:

```text
// For a component with internal sub-components
src/components/AuthModal/
  ├── index.tsx        // Main AuthModal component
  └── Modal.tsx        // Modal used only within AuthModal

// If Modal is used elsewhere too
src/components/
  ├── AuthModal.tsx    // Main component
  └── Modal.tsx        // Shared modal component
```

### 2. Page Components (`src/pages/`)

#### Basic Pages

```text
src/pages/
  ├── users.tsx
  ├── intro.tsx
  └── dashboard.tsx
```

#### Pages with Scoped Components

When a page has components used only within it:

```text
src/pages/users/
  ├── index.tsx        // Main users page
  └── UserProfile.tsx  // Component used only in users page
```

#### Nested Scoping

When a scoped component becomes complex with its own sub-components:

```text
src/pages/users/
  ├── index.tsx
  └── UserProfile/
      ├── index.tsx
      └── SignedInButton.tsx  // Used only within UserProfile
```

### 3. Refactoring Rules

- If a component starts being used in multiple places, move it to `src/components/`
- Always maintain the scoped structure until a component needs to be shared
- Keep components co-located with where they're used for better maintainability

### 4. Examples

#### Dashboard with Menu

```text
src/components/Dashboard/
  ├── index.tsx           // Main Dashboard component
  └── DashboardMenu.tsx   // Menu used only in Dashboard
```

#### Complex Page Structure

```text
src/pages/settings/
  ├── index.tsx
  ├── ProfileSection/
  │   ├── index.tsx
  │   ├── AvatarUpload.tsx
  │   └── ProfileForm.tsx
  └── SecuritySection/
      ├── index.tsx
      └── TwoFactorAuth.tsx
```

### 5. Import Patterns

```typescript
// Importing from folder with index.tsx
import AuthModal from "@/components/AuthModal";

// Importing shared component
import Modal from "@/components/Modal";

// Importing page
import UsersPage from "@/pages/users";
```

## Current Project Structure Example

```text
src/
├── components/
│   ├── AuthModal/
│   │   ├── index.tsx      // Main AuthModal component
│   │   └── Modal.tsx      // Modal used only within AuthModal
│   ├── SignInForm.tsx     // Shared auth form
│   └── SignOutButton.tsx  // Shared sign out button
├── pages/
│   ├── landing.tsx        // Landing page
│   ├── dashboard.tsx      // Dashboard page
│   ├── documentation.tsx  // Documentation page
│   └── intro.tsx          // Intro screen page
└── App.tsx               // Main app component
```

## Code Quality Guidelines

### Component Layout Rules - CRITICAL

**IMPORTANT**: All components must respect parent boundaries. Children must NEVER overflow outside parent containers.

1. **Overflow Prevention**:
   - ALL components must fit within parent boundaries
   - Children elements must NEVER overflow outside parent containers
   - Use `overflow-hidden` on parent containers when necessary
   - Apply `break-words` for text content that might be long
   - Use `whitespace-nowrap` for navigation items to prevent wrapping
   - If content is too large, the parent should expand (flex/grid), NOT overflow

2. **Text Handling**:
   - Always use `break-words` on text elements in cards/containers
   - Use `whitespace-nowrap` for navigation links and buttons
   - Apply proper padding to ensure text doesn't touch container edges
   - Consider using `text-ellipsis` with `truncate` for single-line text limits

3. **Container Structure**:
   - Use `flex flex-col` for card layouts to ensure proper stacking
   - Apply `overflow-hidden` to all card components
   - Use `flex-shrink-0` for fixed-size elements (icons, badges)
   - Ensure responsive grid layouts with proper gaps

4. **Design Principle**:
   - Parent containers should adapt to content size when needed
   - Use flexible layouts (flexbox/grid) that grow with content
   - Never let content spill outside its container
   - Test with long text content to ensure proper wrapping

### Clean Code Practices

1. **Remove Unused Code**:
   - Delete unused components, functions, and imports immediately
   - Don't keep commented-out code
   - Remove unused variables and parameters
   - Clean up unused CSS classes

2. **Import Hygiene**:
   - Order imports: React → Third-party → Local
   - Remove unused imports
   - Use named imports when possible
   - Group related imports

3. **Variable Naming**:
   - Use descriptive names
   - Avoid single-letter variables (except in loops)
   - Use camelCase for variables and functions
   - Use PascalCase for components and types

### ESLint and TypeScript Guidelines

#### Promise-Returning Functions in Event Handlers

**Problem**: ESLint rule `@typescript-eslint/no-misused-promises` warns when async functions or promise-returning functions are passed directly to event handlers, navigation functions, or any attributes expecting void returns.

**CRITICAL RULE**: ANY function that returns a Promise must be wrapped with `void` operator when used where a void return is expected.

**❌ Incorrect Usage**:

```typescript
// DON'T DO THIS - Direct async function
const handleClick = async () => {
  await someAsyncOperation();
};

<button onClick={handleClick}>Click</button>
<form onSubmit={handleSubmit}>...</form>

// DON'T DO THIS - Direct navigation functions
<button onClick={() => navigate("/path")}>Go</button>

// DON'T DO THIS - Direct mutation calls
<button onClick={() => deleteThing({ id })}>Delete</button>

// DON'T DO THIS - Any promise-returning function
<div onClick={() => somePromiseReturningFunction()}>Click</div>
```

**✅ Correct Usage**:

```typescript
// Method 1: ALWAYS use void operator for any promise-returning function
<button onClick={() => void handleClick()}>Click</button>
<button onClick={() => void navigate("/path")}>Navigate</button>
<button onClick={() => void deleteThing({ id })}>Delete</button>
<button onClick={() => void someAsyncOperation()}>Process</button>

// Method 2: Wrap in arrow function with void for form handlers
<form onSubmit={(e) => {
  e.preventDefault();
  void handleSubmit(e);
}}>...</form>

// Method 3: Handle errors explicitly when needed
<button onClick={async () => {
  try {
    await handleClick();
  } catch (error) {
    console.error('Error:', error);
  }
}}>Click</button>

// Method 4: For complex handlers, create a wrapper
const handleClickWrapper = () => {
  void handleAsyncOperation();
};
<button onClick={handleClickWrapper}>Click</button>
```

#### Universal Rules for Promise-Returning Functions

1. **ALWAYS use `void`** operator for ANY promise-returning function in event handlers:
   - `navigate()` from React Router
   - Convex mutations like `createProject()`, `deleteItem()`, etc.
   - Any `async` function
   - Any function that returns a Promise

2. **Common patterns to ALWAYS fix**:

   ```typescript
   // Navigation
   onClick={() => void navigate("/path")}

   // Mutations
   onClick={() => void createItem({ data })}
   onClick={() => void updateItem({ id, data })}
   onClick={() => void deleteItem({ id })}

   // Async operations
   onClick={() => void handleAsyncOperation()}

   // Auth operations
   onClick={() => void signOut()}
   onClick={() => void signIn(provider, credentials)}
   ```

3. **Form submissions** always need preventDefault:

   ```typescript
   onSubmit={(e) => {
     e.preventDefault();
     void handleSubmit(e);
   }}
   ```

4. **Never pass async functions directly** to ANY event handler or attribute
5. **When in doubt, add `void`** - it's always safe for promise-returning functions

### Example of Clean Imports

```typescript
// React imports
import { useState, useEffect } from "react";

// Third-party imports
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

// Local imports
import { Modal } from "./Modal";
import type { AuthModalProps } from "./types";
```

#### Common ESLint Fixes

1. **Async Event Handlers**:

   ```typescript
   // Before: onClick={handleAsyncFunction}
   // After: onClick={() => void handleAsyncFunction()}
   ```

2. **Form Submissions**:

   ```typescript
   // Before: onSubmit={handleSubmit}
   // After: onSubmit={(e) => { e.preventDefault(); void handleSubmit(e); }}
   ```

3. **Multiple Async Calls**:

   ```typescript
   onClick={() => {
     void handleAsyncCall1();
     void handleAsyncCall2();
     setSomething(value); // Sync operation
   }}
   ```

## Code Formatting

### Prettier

**IMPORTANT**: Always run Prettier before committing code to ensure consistent formatting across the codebase.

```bash
# Format all files
npx prettier --write "src/**/*.{ts,tsx,js,jsx,css,json}"

# Check formatting without making changes
npx prettier --check "src/**/*.{ts,tsx,js,jsx,css,json}"
```

### Pre-commit Checklist

Before committing any changes:

1. Run `npx prettier --write` to format all files
2. **ALWAYS run `npm run lint`** to check for linting issues
3. **ALWAYS run `bun run tsc` or `npm run typecheck`** to check for TypeScript errors
4. Run `npm run build` to ensure no build errors
5. Write a clear commit message following the conventions below

**IMPORTANT**: These checks will also run in CI/CD pipeline. Always test locally first to avoid CI failures:
- TypeScript type checking (`tsc --noEmit`)
- ESLint checks
- Build process

Failing to run these checks locally will cause the GitHub Actions workflow to fail.

## Git Commit Message Convention

### Commit Message Format Rules

1. **With Tag Prefix (feat:, fix:, docs:, etc.)**:
   - Everything after the tag MUST be lowercase
   - Example: `feat: add user authentication system`
   - Example: `fix: resolve memory leak in dashboard`

2. **Without Tag Prefix**:
   - First letter MUST be uppercase
   - Example: `Add user authentication system`
   - Example: `Update dashboard performance`

### Common Tags

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc.)
- `refactor:` - Code refactoring without changing functionality
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependency updates
- `perf:` - Performance improvements

### Examples

**✅ Correct**:

```bash
git commit -m "feat: implement userProfiles system with automatic profile creation"
git commit -m "fix: resolve github icon display issue in auth modal"
git commit -m "Update hero title and add comprehensive feature description"
git commit -m "Implement user profile creation on authentication"
```

**❌ Incorrect**:

```bash
git commit -m "feat: Implement UserProfiles System"  # Should be lowercase after tag
git commit -m "fix: Fix GitHub Icon Issue"           # Should be lowercase after tag
git commit -m "update hero title"                    # Should start with uppercase
git commit -m "implement user profiles"              # Should start with uppercase
```

## Summary

This structure follows the same pattern as writexy.com project:

- Components are scoped by default
- Only move to shared when reused
- Maintain clear folder hierarchy
- Use index.tsx for main component exports
- Keep related components together
- Keep codebase clean by removing unused code immediately
- Follow strict git commit message conventions