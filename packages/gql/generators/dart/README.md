# Dart Codegen Scaffold

This package wraps `graphql_codegen` so you can produce Dart models from the
shared OpenIAP schema.

## Usage

```bash
cd generators/dart
dart pub get
dart run build_runner build
```

Place your query/mutation/subscription documents inside `lib/` (or create a
`graphql/` directory and point to it via `build.yaml`).  Generated files will be
written to `lib/generated/` by default.  Adjust `pubspec.yaml` and `build.yaml`
if you need custom scalar mappings or a different output structure.
