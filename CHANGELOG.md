# Changelog

All notable changes to the OpenIAP monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-10-16

### Added

#### Monorepo Integration

- **Unified monorepo structure**: Consolidated all OpenIAP packages into a single monorepo for better maintainability and version synchronization
- **Centralized version management**: Single `openiap-versions.json` at root manages versions across all packages
- **Unified agent guidelines**: Consolidated `CLAUDE.md` with symlinks for `AGENTS.md` and `GEMINI.md` to provide consistent AI agent guidelines

#### Documentation

- **Enhanced documentation site** (`packages/docs`):
  - Improved API reference with consistent naming conventions
  - Platform-specific function documentation (iOS/Android suffixes)
  - Updated component architecture and code examples

#### Type Generation

- **Improved type generation workflow** (`packages/gql`):
  - Multi-platform type generation (TypeScript, Swift, Kotlin, Dart)
  - Automatic synchronization to platform packages
  - Streamlined generation scripts

#### Deployment

- **Automated deployment workflow**:
  - `npm run deploy <version>` command for production deployments
  - Local Vercel deployment for documentation site
  - GitHub Actions workflow for release artifacts and tagging
  - Automated artifact generation for all platforms (TypeScript, Dart, Kotlin, Swift)

#### Platform Libraries

- **Google (Android)** (`packages/google`):
  - Updated to version 1.2.12
  - Improved Kotlin type generation
  - Better Gradle build configuration

- **Apple (iOS/macOS)** (`packages/apple`):
  - Updated to version 1.2.23
  - Enhanced Swift type generation
  - Improved Package.swift configuration

### Changed

#### Repository Structure

- Migrated from separate repositories to unified monorepo
- All packages now share common tooling and CI/CD workflows
- Centralized dependency management

#### Version Management

- Changed from separate version files to unified `openiap-versions.json`
- All packages reference the root version file via symlinks
- Simplified version bumping and synchronization

#### CI/CD

- Updated GitHub Actions workflows for monorepo structure
- Separate workflows for platform-specific releases
- Unified release workflow for type artifacts

### Migration Notes

**For maintainers:**

- The monorepo is now the source of truth for all OpenIAP packages
- Version updates should be made in the root `openiap-versions.json`
- All agent guidelines are centralized in root `CLAUDE.md`

**For contributors:**

- Clone the monorepo instead of individual package repositories
- Run `bun install` at the root to install all dependencies
- Use workspace commands to work with specific packages (e.g., `bun run --filter docs build`)

**For consumers:**

- No breaking changes to public APIs
- Continue using platform-specific packages as before
- Artifacts are now available from the monorepo releases

---

## Pre-1.2.2 (Historical)

Prior to version 1.2.2, OpenIAP packages were maintained in separate repositories:

- `openiap-gql`: GraphQL schema and type generation
- `openiap-google`: Android library
- `openiap-apple`: iOS/macOS library
- `openiap.dev`: Documentation site

These have been consolidated into this monorepo as of version 1.2.2.

---

[1.2.2]: https://github.com/hyodotdev/openiap/releases/tag/v1.2.2
