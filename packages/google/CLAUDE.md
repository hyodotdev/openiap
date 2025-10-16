# Agent Primer

Welcome! This repository hosts the Android implementation of OpenIAP.

## Project Layout

- `openiap/`: Android library sources.
- `Example/`: sample application consuming the library.
- `scripts/`: automation (code generation, tooling).
- `CONVENTION.md`: authoritative engineering conventions for this repo.

## How To Work Here

1. Start every session by reading `CONVENTION.md`. It documents critical rules such as the prohibition on editing generated files (`openiap/src/main/Types.kt`) and where to place shared helper code (`openiap/src/main/java/dev/hyo/openiap/utils/…`).
2. Treat generated sources as read-only. If a change requires updating them, run `./scripts/generate-types.sh` instead of hand editing.
3. Put all reusable Kotlin helpers (e.g., safe map accessors) into the `utils` package so they can be used without modifying generated output.
4. After code generation or dependency changes, compile with `./gradlew :openiap:compileDebugKotlin` (or the appropriate target) to verify the build stays green.

## Updating openiap-gql Version

1. Edit `openiap-versions.json` and update the `gql` field to the desired version
2. Run `./scripts/generate-types.sh` to download and regenerate Types.kt
3. Compile to verify: `./gradlew :openiap:compileDebugKotlin`

Refer back to this document and `CONVENTION.md` whenever you are unsure about workflow expectations.
