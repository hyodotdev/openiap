# @hyodotdev/openiap

Prepare an OpenIAP implementation brief, check local purchase configuration,
and operate IAPKit from a terminal or coding agent. `init` and `doctor` work
locally; `kit` signs in to the selected IAPKit deployment.

Requires Node.js 20 or later.

[![npm](https://img.shields.io/npm/v/@hyodotdev/openiap/latest)](https://www.npmjs.com/package/@hyodotdev/openiap)

## Operate IAPKit

```bash
npx @hyodotdev/openiap kit login
npx @hyodotdev/openiap kit whoami --json
npx @hyodotdev/openiap kit projects list --json
npx @hyodotdev/openiap kit keys list --project PROJECT_ID --json
```

Login opens IAPKit in your browser. Sign in with GitHub, check the displayed
code against your terminal, and approve the connection. Use `login --no-browser`
on a remote terminal and open the printed URL yourself. Codes expire after
10 minutes; CLI sessions expire after 30 days. `logout` revokes the current
CLI session and removes its local credentials.

Login survives separate `npx` runs. Credentials live in `~/.config/openiap/`,
separately for each server origin, with a private directory and files on Unix.
`OPENIAP_CONFIG_DIR` overrides that directory. Use `--base-url https://your-kit.example`
or `IAPKIT_BASE_URL` for another instance; HTTP is allowed only on localhost.
Credentials are never reused across origins.

### Discover commands and inputs

```bash
npx --yes @hyodotdev/openiap kit --help
npx --yes @hyodotdev/openiap kit schema --json
npx --yes @hyodotdev/openiap kit schema keys create --json
npx --yes @hyodotdev/openiap kit keys create --help
```

`schema` works offline and returns JSON Schemas for command inputs. Use
`--project` for `projectId`, `--org` for `organizationId`, and `--key` for
`keyId`. Other fields use kebab-case flags. Arrays and objects take JSON;
`--file request.json` supplies a JSON body, and flags override its fields.
Use `--file -` to read JSON from stdin.
Inputs are checked against the generated schema before a request is sent;
invalid enum choices, types and nested fields return `INVALID_INPUT`.

| Group                                                                    | Operations                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `orgs`, `members`, `invitations`                                         | Organizations, members, invitations                                                           |
| `projects`, `keys`                                                       | Project settings and complete API key management                                              |
| `credentials`, `files`                                                   | Store credentials, review screenshots, uploads, downloads                                     |
| `products`, `sync`                                                       | Catalog, localizations, pricing, store synchronization and jobs                               |
| `payloads`                                                               | Public rules, drafts, publish, history and rollback                                           |
| `purchases`, `subscriptions`, `users`, `orders`                          | Verification, access, binding, resync, timeline and erasure                                   |
| `webhooks`, `issues`, `analytics`                                        | Destinations, deliveries, notifications, diagnostics and revenue                              |
| `account`, `tokens`                                                      | Profile and CLI session/automation token management                                           |
| `health`, `setup`, `setup status`, `troubleshoot`, `inspect`, `simulate` | Server health, SDK snippets, configuration checks, operational summaries and sandbox guidance |

Commands call IAPKit directly and do not require an MCP server. Organization
roles remain enforced by IAPKit. Keys are listed as previews; a full key is
returned once by `keys create` or `keys regenerate`. Regeneration immediately
deactivates the old key. `--output new-file.json` saves a result in a private,
new file; an existing file is never overwritten.

### Common operations

```bash
npx @hyodotdev/openiap kit keys create \
  --project PROJECT_ID --name CI --key-type secret --output new-key.json --json

npx @hyodotdev/openiap kit setup --framework expo --json
npx @hyodotdev/openiap kit setup status --project PROJECT_ID --json

npx @hyodotdev/openiap kit credentials apple \
  --project PROJECT_ID --org ORG_ID --purpose apple_p8_key \
  --credential-file AuthKey.p8 --json
npx @hyodotdev/openiap kit credentials google \
  --project PROJECT_ID --org ORG_ID --credential-file service-account.json --json
npx @hyodotdev/openiap kit files upload \
  --project PROJECT_ID --org ORG_ID --purpose apple_iap_review_screenshot \
  --path review.png --json

npx @hyodotdev/openiap kit products create --file product.json --json
npx @hyodotdev/openiap kit sync products \
  --project PROJECT_ID --store apple --direction push --dry-run --json
npx @hyodotdev/openiap kit sync products \
  --project PROJECT_ID --store apple --direction push --apply --yes --wait --json
```

Use purpose `apple_p8_asc_api_key` for an App Store Connect catalog key;
`apple_p8_key` is the App Store Server key. `credentials configure --file ...`
updates project settings, including Amazon and Horizon credentials. See its
schema for field names. `credentials download --file-id FILE_ID --output key.p8`
writes decoded bytes; without `--output` it returns the base64 response.

Store synchronization defaults to a dry run. `--apply --yes` applies changes;
`--wait` waits for completion with `--timeout` in seconds (default 120).
A timeout returns the job ID; use `sync status` rather than enqueueing again.
Destructive commands, public payload publishing and webhook re-sends require
`--yes`. The `npx --yes` option only approves npm execution; it does not confirm
a CLI change. Sandbox purchase simulation prints instructions. Synthetic
Google webhook simulation is restricted to localhost and requires the existing
development Pub/Sub opt-in; Apple tests require a signed store notification.

### Agents and CI

```bash
npx @hyodotdev/openiap kit tokens create \
  --name build-server --scope read --expires-in-days 30 --output ci-token.json --json
# Store the returned token in your CI secret manager as IAPKIT_TOKEN.
npx --yes @hyodotdev/openiap kit projects list --json
```

Tokens expire in 1–90 days and can be revoked with `tokens revoke --id ID --yes`.
`read` permits reads, `write` also permits purchase/catalog/payload/sync writes,
and `admin` also permits organization, key, store credential and token management
and project deletion.
A token never grants more authority than the account's organization role.
`IAPKIT_TOKEN` takes precedence over saved login and is not saved locally.

With `--json`, stdout contains one `{ok: true, data}` or
`{ok: false, error: {code, message}}` object; login instructions go to stderr.
Exit codes are `0` for success, `3` for missing authentication, `4` for
insufficient access, and `1` for other failures. Non-interactive commands
never open a selection prompt. Pin a published CLI version for reproducible CI.

## Start with your role

```bash
npx @hyodotdev/openiap                              # choose a role in your terminal
npx @hyodotdev/openiap init ./my-product --role experience
npx @hyodotdev/openiap doctor ./my-app --json
```

The project directory must already exist. `init` prints Markdown to stdout;
it does not create a project or a file. Without arguments, an interactive
terminal opens the role picker; a non-interactive run prints help.

| Role         | Connect                                               |
| ------------ | ----------------------------------------------------- |
| `app`        | Purchases to customer access                          |
| `experience` | Paywalls and experiments to the app's purchase flow   |
| `commerce`   | Verification and access through the Commerce Protocol |
| `data`       | Normalized events to analytics and automation         |

The brief points your assistant to the matching implementation guide. Fill in
the customer outcome, choose any missing product decisions, and review the
running result. Run again for each role your product supplies.

For scripts and coding agents, select a role explicitly with `--role`. To save
the output, redirect it yourself. This creates or replaces `openiap-brief.md`:

```bash
npx @hyodotdev/openiap init --role commerce > openiap-brief.md
```

`init` and `doctor` only read local files. They do not install SDKs, execute app
configuration, fetch the linked guides, contact a service, or invoke an AI.
`npx` may download the CLI and its dependencies before running it.

## In an existing project

From your existing app directory, run `npx @hyodotdev/openiap init --role app`.
This works even when the app already uses OpenIAP. It prints a starting brief;
it does not analyze or migrate the existing purchase flow.

When the command exits, copy the full document beginning with
`# OpenIAP implementation brief`. Open the same project in your coding assistant
(for example, Codex or Claude Code) and paste it into the assistant's **chat
input**. Append your desired outcome below it, starting with
`Desired outcome:`, such as adding Premium while keeping your current login,
paywall, and purchase integration. Send both as one message. The AI then inspects and edits the project, runs it, and reports tests.
At the end of `init` alone, your files are unchanged and no AI or server is running.

Follow the [AI handoff](https://openiap.dev/docs/guides/ai-assistants#commerce-ai-request),
then inspect the [connection example and its evidence](https://openiap.dev/docs/guides/ai-assistants#commerce-connection-example).

## Why use it with AI?

`init` is an optional shortcut. It adds the project path, selected role, and a
framework hint to a brief that links the maintained guide. It does not analyze
your purchase code, select a backend, or check the implementation. If your
assistant already has the relevant guide and project context, skip `init`.

`doctor` supplies repeatable checks with stable finding IDs, file locations,
suggested fixes, JSON output, and an error exit code. An assistant can inspect
the same files itself; running the CLI makes these particular checks consistent
across developers, agents, and CI. Review a finding, fix its cause, and rerun
the same command. Pin the CLI version in CI to keep the rule set consistent.

| Need                                                            | Use                                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Decide where an app, paywall, backend, or data service connects | `init --role …`, or the [role guide](https://openiap.dev/commerce-protocol/ecosystem) directly                 |
| Catch supported local configuration mistakes                    | `doctor --json` in the target app directory                                                                    |
| See verification, ownership, access, and delivery execute       | The [runnable Commerce Protocol example](https://github.com/hyodotdev/openiap-commerce-protocol-example)       |
| Verify a provider's protocol behavior                           | The [conformance tools](https://openiap.dev/commerce-protocol/conformance) and tests for its declared profiles |

The CLI is not needed to run the example or use OpenIAP SDKs. The example is
fixture-backed teaching code; neither its tests nor a clean `doctor` report
prove that real store purchases work.

## Check scope

Run `doctor` at the target app root, not the monorepo root. It does not
recursively discover apps. Framework hints recognize Expo, React Native,
Flutter, and KMP dependency declarations; other stacks report `unknown`.
The four `init` roles select guides, not four sets of diagnostic checks.

Android checks inspect conventional `android/` Gradle and manifest files.
iOS scene checks apply to Expo and React Native `ios/` projects. IAPKit key and
URL checks read env and app configuration files, including relevant Flutter
assets. They are not a general source-code or secret scan. A custom layout or
missing native directory can leave a check skipped; inspect
`notCheckedLocally` even when the command exits `0`.

## Severity

**Error** means the checkout proves it: two files disagree, or a value is wrong
for its documented use. Errors exit `1`.

**Warning** means the checkout suggests it but cannot settle it — Gradle can
inject a manifest placeholder, a linked framework can supply a class, and no
file records whether the app reads a given variable. Warnings exit `0`.

A build for another store is settled but deliberate, so it is a warning too:
the tool cannot know which device you are about to install on.

**Both** means the level depends on what the checkout shows. A malformed base
URL is an error where something inlines the name it is assigned to, and a
warning where nothing does; a missing scene delegate is an error when the
Info.plist names the app's own module or no class at all, and a warning when the
name could come from a linked framework.

## What it finds

Most of these produce no error message that says what is actually wrong.

| Check                               | Level   | What goes wrong without it                                                                                                                                                                                    |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `android-store-flavor-mismatch`     | error   | A half-finished regeneration links one store while gradle.properties pins another.                                                                                                                            |
| `android-store-flavor-conflict`     | error   | The `openiapStore` pin and a store flag disagree, or `horizonEnabled` and `fireOsEnabled` are both true. Gradle also refuses this; the doctor sees it before a build.                                         |
| `android-store-unknown`             | error   | `openiapStore` names something that is not a store, or `openiapProvider` is not fixed `group:artifact:version` coordinates (a snapshot included), so Gradle will refuse the build.                            |
| `android-store-not-play`            | warning | The project is pinned to Horizon, Amazon, or no store at all, so Play billing cannot connect on a Play device. Without a pin the task flavor or the connected debug device picks the store per build.         |
| `android-horizon-app-id-missing`    | warning | Horizon is pinned but no manifest declares an app id.                                                                                                                                                         |
| `iapkit-secret-key-in-client`       | error   | A secret key is on a name that reaches the app bundle.                                                                                                                                                        |
| `iapkit-secret-key-in-env`          | warning | A secret key is in an env file on a name nothing here proves is inlined.                                                                                                                                      |
| `iapkit-secret-key-in-config`       | warning | Executable app configuration contains a secret, but its presence in the app bundle is unproven.                                                                                                               |
| `iapkit-env-missing-expo-prefix`    | warning | Expo inlines only `EXPO_PUBLIC_` names, so the bare name reads as undefined.                                                                                                                                  |
| `iapkit-env-unexpected-expo-prefix` | warning | An `EXPO_PUBLIC_` name is set where nothing inlines that prefix.                                                                                                                                              |
| `iapkit-base-url-has-path`          | both    | The base URL is not a bare origin; every SDK rejects a path, userinfo, a query or a fragment.                                                                                                                 |
| `iapkit-base-url-invalid`           | both    | The base URL is not a URL.                                                                                                                                                                                    |
| `iapkit-base-url-scheme`            | both    | The base URL is not http or https.                                                                                                                                                                            |
| `ios-scene-delegate-missing`        | both    | The Info.plist names a scene delegate the target lacks; the app opens to a black screen. Error when the plist names the app's own module or no class at all, warning when a linked framework could supply it. |
| `project-file-unreadable`           | error   | A path could not be read, so nothing in it was checked.                                                                                                                                                       |
| `project-manifest-unreadable`       | error   | package.json exists but will not parse, so framework detection read nothing.                                                                                                                                  |
| `project-not-a-directory`           | error   | The path given is not a readable directory.                                                                                                                                                                   |

## What it does not find

Dynamic app configuration is never executed. Secret literals in it stay warnings
unless the file is a declared bundled asset. Reading an unprefixed environment
variable during configuration also does not prove its value reaches the app.

A checkout cannot answer for a device or a store account. The command prints
these as unchecked rather than guessing:

- Store account state: agreements, product status, and license testers.
- Device state: a scene session or an installed build left by another app that
  shares the bundle id.
- Play billing availability on the device and its signed-in account.

## Usage

```bash
npx @hyodotdev/openiap doctor            # the working directory
npx @hyodotdev/openiap doctor ./my-app   # a project elsewhere
npx @hyodotdev/openiap doctor --json     # one JSON report
npx @hyodotdev/openiap --version         # the version and nothing else
```

Exit code is `1` when there is an error, `0` otherwise.

`--json` emits `{framework, findings, errors, warnings, notCheckedLocally}`.
Each finding carries a stable `id`, a `level`, the `file` it was read from, a
`message`, a `fix`, and — where the check can point at one — a `line`,
`expected`, and `actual`. Match on `id`; the prose is for people.

<!-- community:start -->
<!-- Generated by scripts/sync-sponsors.mjs from packages/docs/community-touchpoints.json. -->

## Built something with @hyodotdev/openiap?

List your app on the [OpenIAP showcase](https://openiap.dev/showcase).

Questions and feedback go to [Discussions](https://github.com/hyodotdev/openiap/discussions).

If @hyodotdev/openiap saves you time, a ⭐ on [hyodotdev/openiap](https://github.com/hyodotdev/openiap) helps.

<!-- community:end -->

<!-- sponsors:start -->
<!-- Generated by scripts/sync-sponsors.mjs from packages/docs/sponsor-registry.json. -->

## Sponsors

<p align="center">
  <a href="https://meta.com">
    <img src="https://openiap.dev/meta.svg" alt="Meta" height="80" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://developer.amazon.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://openiap.dev/sponsors/amazon-dark.webp">
      <img src="https://openiap.dev/sponsors/amazon.webp" alt="Amazon Developer" height="44" align="middle">
    </picture>
  </a>
</p>

Thank you to [Meta](https://meta.com) and [Amazon Developer](https://developer.amazon.com/) for supporting OpenIAP. [View sponsorship options](https://openiap.dev/sponsors).

### OpenCollective

We also recognize sponsors and backers through OpenCollective. The original react-native-iap collective now supports the broader OpenIAP ecosystem and is managed separately from the main sponsor program.

**Sponsors:** <a href="https://opencollective.com/openiap#sponsors"><img src="https://opencollective.com/openiap/sponsors.svg?width=890&cache=20260706" alt="OpenCollective sponsors" /></a>

**Backers:** <a href="https://opencollective.com/openiap#backers"><img src="https://opencollective.com/openiap/backers.svg?width=890&cache=20260706" alt="OpenCollective backers" /></a>

[Become a sponsor](https://opencollective.com/openiap#sponsor) | [Become a backer](https://opencollective.com/openiap#backer)

### Past supporters

Supported the project before the OpenIAP sponsor program.

<p align="center">
  <a href="https://namiml.com">
    <img src="https://openiap.dev/sponsors/nami.webp" alt="Nami" height="32" align="middle">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.courier.com/?utm_source=react-native-iap&utm_campaign=osssponsors">
    <img src="https://openiap.dev/sponsors/courier.webp" alt="Courier" height="32" align="middle">
  </a>
</p>

[openiap-sponsors]: https://openiap.dev/sponsors
[openiap-github-sponsors]: https://github.com/sponsors/hyodotdev
[openiap-opencollective]: https://opencollective.com/openiap
[openiap-paypal]: https://www.paypal.me/dooboolab
[openiap-company-contact]: mailto:hyo@hyo.dev

<!-- sponsors:end -->
