# Documentation Site Patterns

> **Priority: MANDATORY**
> Follow these patterns when working on packages/docs.

## Reader-First Writing Standard

Apply this standard to every user-facing page, guide, API reference, migration
note, example explanation, announcement, and release note:

- Lead with the outcome, then identify who is affected and any required action.
- Use direct, active sentences and scannable headings or bullets. Keep one idea
  per sentence where practical.
- State each fact once. Link to deeper reference material instead of repeating
  the same explanation across sections or pages.
- Omit filler, internal implementation narration, generated-file inventories,
  test-process narration, and details that do not change user behavior.
- Keep necessary compatibility, migration, security, data-safety, and
  platform-specific caveats. Concision must not hide a requirement or risk.
- Prefer concrete behavior and commands over adjectives such as "robust",
  "comprehensive", "seamless", or "modernized."

Before finishing, read the rendered page as a user. Remove any sentence that
does not clarify what changed, how to use it, who is affected, or what action is
required.

## Protocol Release Articles

Every release that changes the public Client or Commerce Protocol contract also
prepares or updates one English article draft in Hyo Dev's OpenIAP Medium
section. Use the [Expo SDK 57 announcement](https://expo.dev/changelog/sdk-57)
as the information-architecture reference: explain the main outcome, show how
to use it, identify compatibility limits, and give an ordered upgrade path.
This long-form article complements the concise release card; it does not
replace the card or the canonical guides.

Use this structure, omitting sections only when they have no applicable changes:

1. **Title, cover, and introduction:** name the main user-visible change, who
   benefits, and who must upgrade. Add a short list of concrete highlights and a
   landscape cover that remains legible as a thumbnail, with alt text and a
   caption. Do not use a native package version as an umbrella OpenIAP version
   or recount package version history.
2. **Main features:** explain the problem, resulting behavior, and a small
   usable example. Link the runnable implementation and authoring guide. Keep
   contract support, available adapters, conformance coverage, and server-side
   verification claims distinct.
3. **Other highlights:** group remaining changes by their effect on developers.
   Include the behavior or action that matters, with links to the source or
   canonical guide; omit per-wrapper repetition and implementation inventories.
4. **Compatibility and known limits:** identify affected platforms and apps,
   required native rebuilds, unsupported cases, regressions, and workarounds.
   State verified status precisely. Never invent a regression to fill a section
   or present simulated coverage as a real store purchase.
5. **Upgrading:** give ordered dependency, configuration, API migration,
   native-build, and purchase/verification checks. Distinguish generated native
   projects from manually maintained ones where needed. Include exact versions
   only when required for an install command or compatibility decision; link
   the release card for the complete package list.
6. **Next steps and feedback:** link current setup, migration, examples,
   conformance instructions, and the existing PR or discussion.

Verify claims against the contract and release evidence, follow the links, and
inspect desktop and mobile rendering plus the cover's thumbnail crop. Keep the
article a draft until public artifacts and deployed documentation are verified;
publication requires the maintainer's explicit request. Record pending work in
the draft without claiming the release or its device tests are complete.

## Human and AI Acceptance

Apply these checks whenever changing a guide, example, SDK entry point, or AI
implementation brief. They are completion criteria, not an optional final polish.

- **First-time reader:** walk through the rendered page on desktop and mobile.
  The reader should understand what they get, which decisions they own, and what
  to do next before seeing an API table or a long AI prompt. Introduce terms at
  the step that needs them; keep detailed references available afterward.
- **Two implementations:** Commerce Protocol guides must connect each relevant
  responsibility to the runnable example and to at least one independent
  implementation's code and checks (today `openiap-commerce-protocol-example`
  and IAPKit). Explain differences in supported operations, stores, and
  profiles. Do not present a fixture as a real purchase, one provider as
  evidence of interoperability with another, or any single implementation as
  the protocol. Follow the source links and operate the guide.
- **Fresh AI implementation:** when a brief or runnable example changes, replay
  its install, implementation, startup, and acceptance instructions in a clean
  project using only the published inputs. Record the input revision, commands,
  observed results, failures, and remaining limits. Retain previously exercised
  cases; do not hide failures by shrinking declarations or accepting known
  conformance failures. Reuse an earlier run only when its relevant inputs have
  not changed, and identify that run rather than calling it a new reproduction.
- **Independent acceptance:** test the promised customer behavior, including
  failure and recovery, against the running result, and record the commands
  and observed results in the PR body or the published run report. An agent
  simulation is useful evidence, but must be labeled as a simulation, not a
  human user study.
- **SDK discovery:** verify the initial HTTP response contains the page's actual
  text, title, description, and canonical URL without JavaScript. Canonical
  pages belong in the generated sitemap. Framework names, install commands,
  versions, and setup links come from their existing metadata sources. Generated
  `llms.txt` references must lead to the same current contracts and examples.

Run `bun run build` and `bun run test:discoverability` in `packages/docs` for
static content and metadata checks. The repository's `bun run e2e:web`
checks the served HTML and the interactive Commerce Protocol walkthrough.
These checks catch regressions; they do not prove that a person understood the
page or that an AI chose the SDK, and `llms.txt` or structured data do not
guarantee indexing or recommendation. Do not claim adoption effects from them.

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

```sh
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

## Separate Content Data From Rendering

> **Priority: MANDATORY**

Repeated page content — table rows, link lists, card grids, comparison
matrices — is **data**. Declare it as a typed module-level constant and render
it with `.map()`. Do not hand-write repeated JSX blocks that differ only in
their text.

```tsx
interface Standard {
  concern: string;
  standard: ReactNode;
}

const STANDARDS: Standard[] = [
  { concern: "Document format", standard: <a href="...">CycloneDX 1.6</a> },
  { concern: "Component identity", standard: <a href="...">purl</a> },
];

// …then render it
<DataTable
  rows={STANDARDS}
  rowKey={(row) => row.concern}
  columns={[
    { header: "Concern", cell: (row) => row.concern },
    { header: "Standard", cell: (row) => row.standard },
  ]}
/>;
```

Why this is mandatory rather than stylistic:

- Editing a fact means editing one object, not hunting through `<tr>` markup.
- A reviewer can read the content of a page without stepping through JSX.
- Adding a row cannot accidentally break table structure.
- Content becomes greppable and, when needed, exportable to another surface.

Rules:

- Use `src/components/DataTable.tsx` for tabular content rather than
  hand-writing `<table>`; pass `columns` and `rows`.
- Name the constant in `SCREAMING_SNAKE_CASE`, type it with an `interface`, and
  place it above the component.
- `rowKey` must be a stable field, never the array index.
- Prose paragraphs stay inline as JSX. This rule is about **repeated
  structures**, not about extracting every sentence into a variable.
- A one-off two-row table is not worth a constant; use judgement, and extract
  once the structure repeats or grows.

---

## React Component Organization

### Component Structure

#### Shared Components (`src/components/`)

- Place reusable components that are used across multiple pages/features
- If a component is only used in one place, it should be co-located with its parent

#### Scoped Component Pattern

When a component has sub-components that are only used within it:

```sh
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

### Docs Ship With The Change

A PR into `main` that changes a published package carries its documentation:
the guides the change affects and the release card for the next version. Write
the card as already published, because the train ships right after the merge: a
`Package Releases` block with the expected versions and their future GitHub
Release links, and shipped wording such as "fixes" or "adds". When an
unreleased card for the same train exists, update it instead of adding another.
After the train publishes, the release only verifies each version and link and
corrects the card on `main` where one differs.

Vercel automatically deploys main's docs, including RC metadata and release
cards ahead of package publication. See
[Deploying Documentation](./06-git-deployment.md#deploying-documentation).
That section also covers a release train that stops before completion.

### Release Note Completeness Gate

Run this gate before opening or updating a PR into `main`, declaring a review
clean, merging, or starting a stable release. Repeat it after a review fix or
release-plan change expands the affected packages or behavior.

1. Inspect the complete base-to-head diff and staged, unstaged, and untracked
   work. For a release train, also inspect each selected package's changes
   since its last published tag, including earlier merged but unreleased work.
   A PR title, latest commit, or native version manifest is not the inventory.
2. Identify every artifact the change will publish, including indirect native
   dependency and generated-type updates. Check `specs/client`,
   `specs/commerce-protocol`, `packages/cli`, the native packages, and framework
   libraries when affected. Client Protocol, Commerce
   Protocol, and CLI releases are independent; a native/framework list alone
   is incomplete. Include hosted IAPKit/MCP behavior without inventing a
   versioned package entry.
3. Compare that inventory with the train's card in
   `packages/docs/src/pages/docs/updates/releases.tsx`. Every selected
   versioned package needs its expected version, GitHub Release link, and tag
   alias/anchor. Every user-visible change needs a concise behavior or migration
   note; packages that only pick up shared behavior need only a linked release
   entry. Resolve targets through the Release Package Version
   Verification section below and `$generate-doc`.
4. Fill gaps in the current PR and update the existing unreleased card for the
   same train. Do not defer missing packages or explanations to a separate
   post-release docs commit. If the release scope grows after merge, reconcile
   the card before dispatching any added package's workflow.
5. Run `bun run audit:docs`, `bun run audit:release-state`, and the checks
   required by the touched paths. CI's release-note audit detects an unchanged
   `releases.tsx`; a touched file or green audit does not prove that every
   package and behavior is covered. Review that coverage before calling the
   result clean.

Tests, CI, internal agent rules, and behavior-neutral refactors that need no
new publication do not require a release card. Record the reason briefly in
the PR description when applicable; use the documented `፦ refactor` label
when CI requires it. Dependency-only releases still need package entries.
RC work on `main` keeps the eventual stable card with its source change.

### Release Note Writing Limits

Apply the project-wide Reader-First Writing Standard above. Release notes are a
changelog for package users, not an implementation audit or a narrative of how
a release was produced.

- Lead with the user-visible outcome. Do not restate the title or begin with
  filler such as "Publishes the coordinated release train."
- Keep the opening summary to at most two sentences and roughly 50 words.
- Keep each bullet to one sentence and normally 30 words or fewer. Use up to 45
  only when a compatibility range or migration command cannot be split safely.
- State each fact once. Do not repeat one fix in the summary, native section,
  every wrapper bullet, and integration notes.
- Describe behavior, compatibility, and required user action. Omit commit
  mechanics, generated-file inventories, test matrices, release automation,
  internal architecture, and dependency lists that do not change consumer
  requirements.
- A package whose only change is selecting a native dependency, regenerating
  types, or republishing shared behavior belongs only in `Package Releases`.
  One bullet may group packages that have the same behavior and caveats.
- Use `Integration notes` only for required migration, configuration, or
  compatibility action. Omit no-op reassurance and unchanged-platform lists.
- Link a PR or issue once where it supplies useful context.
- Prefer concrete verbs such as "fixes", "adds", "rejects", "requires",
  "removes", and "preserves". Avoid vague verbs unless the sentence immediately
  names the observable result.
- Preserve historical IDs, dates, versions, links, compatibility boundaries,
  migration commands, and shipped behavior when shortening an existing note.
  Leave a statement unchanged when its source evidence is incomplete.

### Package-specific grouping for shared releases

The docs release page is the canonical release-note SSOT, including when many
packages ship together. To satisfy the package-specific changelog requirement
from issue #206 without duplicating release history across package-local files:

- Audit the full requested commit range inclusively and include the current PR
  diff before drafting the note.
- Group user-visible changes by affected platform package or framework library:
  Google, Apple, IAPKit, React Native, Expo, Flutter, Godot, KMP, and MAUI.
- Name each package and version once in its behavior group. For several
  changes, use one parent list item with a bold package/version label and
  nested change bullets; do not repeat the label on each change. A single
  change can follow the label inline. The separate `Package Releases` link
  list may repeat the package/version label.
- Omit packages with no user-visible change and keep each remaining group to the
  smallest set of useful upgrade notes.
- Do not replace package-specific behavior with a generic "framework parity"
  bullet when wrappers have different setup, runtime, or compatibility details.
- Exclude version-only commits, generated-file churn, and CI mechanics unless
  they change how users install, build, or validate the release.
- Keep package-local changelogs as pointers to this page and GitHub Releases,
  except where a package registry requires generated inline history.

### Adding New Release Notes

1. Add new entry at the **top** of the `allNotes` array
2. Follow the existing pattern with `id`, `date`, and `element`
3. Use semantic IDs like `google-3-5-2-apple-3-4-0`
4. Verify every package version against its source of truth before writing it
   (see "Release package version verification" below)

```tsx
const allNotes: Note[] = [
  // Google 3.5.2 / Apple 3.4.0 - Jan 26, 2026
  {
    id: "google-3-5-2-apple-3-4-0",
    date: new Date("2026-01-26"),
    element: (
      <div key="google-3-5-2-apple-3-4-0" style={noteCardStyle}>
        <AnchorLink id="google-3-5-2-apple-3-4-0" level="h4">
          📅 openiap-google v3.5.2 / openiap-apple v3.4.0 - Feature Description
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
previous block. Use the canonical metadata paths and tag formats in
[`Release Docs Version Guard`](./06-git-deployment.md#release-docs-version-guard),
including the independently versioned Client Protocol, Commerce Protocol, and
CLI packages.

Before adding or editing a `Package Releases` list:

1. `git fetch origin main --tags` (or `git fetch --no-tags origin main` if
   local stale tags would fail).
2. Read the current package metadata from `origin/main`, not from memory.
3. Give each affected package its expected next version: the next patch for a
   backward-compatible fix, the next minor for a backward-compatible feature,
   the next major for a breaking change. Reuse the targets on an unreleased
   card for the same train.
4. Write the block as `Package Releases` with each expected tag link (for
   example `godot-iap-2.2.8`), per "Docs Ship With The Change". Do not use
   `Planned Package Releases` or `(planned)`.
5. When editing a card whose train already published, confirm each tag exists
   with `gh release view <tag> --repo hyodotdev/openiap` before changing a link.
6. After the train publishes, compare every version and link on its card with
   the published releases and correct any that differ.
7. Run `bun run audit:docs`; the audit fails when a
   `Package Releases` block contains a package/version item without a GitHub
   Release link.

Keep one concise, package-grouped stable release card with the source PR on
`main`, including when an RC publishes first. Do not create duplicate cards for
RC or npm `next` publications. Vercel automatically deploys main's docs,
including RC metadata and release cards ahead of package publication.

Do not use `openiap-versions.json` to derive React Native, Expo, Flutter,
Godot, KMP, or MAUI versions; that manifest tracks only `clientProtocol`,
`google`, and `apple`.
