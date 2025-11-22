# Contributing to OpenIAP

Thank you for your interest in contributing! We love your input and appreciate your efforts to make OpenIAP better.

## Quick Start

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`swift test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/openiap-apple.git
cd openiap-apple

# Open in Xcode
open Package.swift

# Run tests
swift test
```

## Code Style

- Follow Swift API Design Guidelines
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments only when necessary

### Naming Conventions

- **Acronyms**: Use Pascal case when at beginning/middle (`IapModule`, `OpenIapTests`)
- **Acronyms as suffix**: Use all caps (`ProductIAP`, `ManagerIOS`)
- See [CLAUDE.md](CLAUDE.md) for detailed naming rules

#### OpenIap Prefix (Public Models)

- Prefix all public model types with `OpenIap`.
- Examples: `ProductIOS`, `PurchaseIOS`, `ProductIOSRequest`, `RequestPurchaseProps`, `PurchaseIOSOptions`, `VerifyPurchaseProps`, `VerifyPurchaseResultIOS`, `ActiveSubscription`, `PurchaseIOSState`, `PurchaseIOSOffer`, `ProductIOSType`, `ProductIOSTypeIOS`.
- Private/internal helper types do not need the prefix.
- When renaming existing types, add a public `typealias` from the old name to the new name to preserve source compatibility, then migrate usages incrementally.

## Testing

All new features must include tests:

```swift
func testYourFeature() async throws {
    // Arrange
    let module = OpenIapModule.shared

    // Act
    let result = try await module.yourMethod()

    // Assert
    XCTAssertEqual(result, expectedValue)
}
```

## Pull Request Guidelines

### ✅ Do

- Write clear PR titles and descriptions
- Include tests for new features
- Update documentation if needed
- Keep changes focused and small

### ❌ Don't

- Mix unrelated changes in one PR
- Break existing tests
- Change code style without discussion
- Include commented-out code

## Commit Messages

Use Angular Conventional Commits:

- Format: `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- Subject: imperative, lowercase, no period, ~50 chars
- Body/footers optional; wrap at ~72 cols

Examples:

- `feat(store): add purchase success callback`
- `fix(iap): handle user cancellation edge case`
- `docs(readme): correct api examples for OpenIapStore`

## Release Process (Maintainers Only)

When your PR is merged, maintainers will handle the release:

1. **Version Update**: We use semantic versioning (major.minor.patch)

   ```bash
   ./scripts/bump-version.sh patch  # for bug fixes
   ./scripts/bump-version.sh minor  # for new features
   ./scripts/bump-version.sh major  # for breaking changes
   ```

2. **Deployment Workflows (separated)**

   - Swift Package (SPM):
     - Actions → "Release Swift Package" → Run workflow → enter version (e.g., `1.2.3` or `patch`).
     - This bumps version, commits, tags, creates a GitHub Release, and runs build/tests. SPM picks up new versions from git tags automatically.

   - CocoaPods:
     - Actions → "Deploy to CocoaPods" → Run workflow.
     - Uses the current `openiap.podspec` version and publishes via `pod trunk push` (requires `COCOAPODS_TRUNK_TOKEN` repository secret).

   - These are decoupled. Run SPM release and CocoaPods deploy independently, or run both sequentially (SPM first, then CocoaPods).

3. **Availability**:
   - Swift Package: Available immediately after release
   - CocoaPods: Available within ~10 minutes via `pod update`

Contributors don't need to worry about deployment - just focus on making great contributions!

## Questions?

Feel free to:

- Open an issue for bugs or features
- Start a discussion for questions
- Tag @hyochan for urgent matters

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
