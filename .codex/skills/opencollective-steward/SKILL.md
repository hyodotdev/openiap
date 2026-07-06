---
name: opencollective-steward
description: Manage OpenIAP's OpenCollective presence, including profile copy, slug/link migrations, sponsor/backer recognition, update posts, and README/docs sponsor assets. Use when the user asks to draft or publish OpenCollective updates, maintain OpenCollective tiers/profile content, migrate react-native-iap OpenCollective links to openiap, or make supporters feel informed and appreciated.
---

# OpenCollective Steward

## Overview

Use this skill to treat OpenCollective as an ongoing community-support surface for OpenIAP, not just a donation link. Keep updates transparent, grateful, and tied to concrete project progress.

## Core Workflow

1. Establish the requested surface: public OpenCollective profile, update post, contribution tier, README badge/SVG links, docs sponsor page, or supporter follow-up.
2. For repo edits, follow root `AGENTS.md` and the relevant OpenIAP knowledge files before changing README/docs content.
3. For live OpenCollective writes, use the user's signed-in browser session through Chrome browser control. If OpenCollective asks for sign-in, ask the user to complete sign-in unless the user explicitly authorizes using a specific auth link or code.
4. Draft the change before publishing when the user has not already supplied exact copy. Keep claims evidence-backed and avoid promising timelines unless there is a committed plan.
5. After publishing or saving, verify the public page/update URL and update repo links that point at the changed slug or assets.

## Live Edit Guardrails

- On OpenCollective profile forms, verify that rich-text editor changes update the
  backing hidden input before pressing Save. If the visible Trix editor changes
  but the hidden value still contains the previous copy, do not save; the form
  can submit stale content.
- If browser editor state will not sync, use an explicit OpenCollective API token
  or ask the maintainer to paste the prepared copy manually. Do not infer auth
  tokens from browser state.

## Positioning

- Treat `hyochan/react-native-iap` as the original community where OpenIAP began and OpenIAP as the broader ecosystem that now carries the work forward.
- Say that OpenCollective sponsorship is managed separately from the main OpenIAP sponsor program when both are mentioned.
- Recognize legacy sponsors/backers without implying they explicitly opted into a new commercial program.
- Prefer current project links: `https://opencollective.com/openiap`, `https://openiap.dev`, and `https://github.com/hyodotdev/openiap`.
- Keep OpenCollective SVG assets dynamic in READMEs so sponsor, backer, and contributor lists stay current.

## Update Post Pattern

Use this structure for OpenCollective updates unless the user asks for a different shape:

1. Title: concrete project milestone or supporter-facing outcome.
2. Opening: one or two sentences thanking sponsors/backers and naming why the update matters.
3. What changed: short bullets with shipped work, migration progress, docs/releases, or maintenance work.
4. What support enables: practical items such as docs, CI, examples, compatibility testing, issue triage, and ecosystem maintenance.
5. What's next: near-term work without overcommitting.
6. Closing: invite sponsorship/backing and link to OpenIAP docs or GitHub.

Tone: warm, transparent, specific, and builder-to-builder. Avoid marketing fluff, urgency pressure, or inflated impact language.

## README And Asset Links

Use these canonical OpenCollective links after the slug migration:

- Badge: `https://img.shields.io/opencollective/all/openiap.svg`
- Collective: `https://opencollective.com/openiap`
- Sponsors SVG: `https://opencollective.com/openiap/sponsors.svg?width=890`
- Backers SVG: `https://opencollective.com/openiap/backers.svg?width=890`
- Sponsor CTA: `https://opencollective.com/openiap#sponsor`
- Backer CTA: `https://opencollective.com/openiap#backer`

After a slug migration, add a harmless cache-buster query parameter such as
`&cache=YYYYMMDD` to README image URLs if GitHub's image proxy keeps showing a
previous broken preview.

Avoid `https://opencollective.com/openiap/contributors.svg` in READMEs until
OpenCollective's contributor SVG endpoint is stable; use GitHub's contributors
graph link instead. If the user wants a visual contributor wall, use
`https://contrib.rocks/image?repo=hyodotdev/openiap` for OpenIAP contributors
and `https://contrib.rocks/image?repo=hyochan/react-native-iap` when explicitly
recognizing the legacy react-native-iap contributor community.

## Publishing Checklist

Before saving or publishing live OpenCollective changes:

- Confirm the account/collective in the page header or URL is OpenIAP or the intended legacy `react-native-iap` collective.
- Confirm the title, slug, short description, long description, tags, GitHub link, and CTAs no longer point to deprecated locations unless intentionally preserving history.
- Preview the update when OpenCollective offers a preview.
- Verify the resulting public URL after publishing.
- Mirror important slug/link changes in root README, framework README files, and docs sponsor surfaces when relevant.

## Example Copy

Short migration description:

```md
OpenIAP is the home for the in-app purchase libraries and platform packages that grew from react-native-iap. Your support helps maintain the shared spec, native packages, framework SDKs, docs, examples, and compatibility work across Apple, Google Play, Expo, React Native, Flutter, Kotlin Multiplatform, Godot, and .NET MAUI.
```

Update closing:

```md
Thank you to everyone who supported react-native-iap and continues to make OpenIAP possible. Sponsors and backers help keep the boring but important work funded: releases, docs, examples, test coverage, and issue triage across the ecosystem.
```
