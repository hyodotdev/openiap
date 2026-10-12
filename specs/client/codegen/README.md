# Code Generation System

IR-based code generation system for Swift, Kotlin, Dart, GDScript, and C#.
TypeScript uses the sibling graphql-codegen plus guarded AST pipeline described
in `../CONVENTION.md`.

## Architecture

The directory layout, IR types, the steps for adding a language, and the
cross-language wire rules (flat `__typename` unions, enum spellings, SDL
defaults) live in [`../CONVENTION.md`](../CONVENTION.md#code-generation-architecture).

## How It Works

1. **Parse**: GraphQL schema is parsed into AST
2. **Transform**: AST is transformed into language-agnostic IR
3. **Generate**: Language-specific plugins convert IR to target code

## Plugin Structure

Each plugin implements:

- Type mapping (`mapScalar`, `mapType`, `getPropertyType`)
- Keyword escaping (`keywords`, `escapeKeyword`)
- Name conversion (`enumValueCase`, `fieldNameCase`)
- Code generation (`generateEnum`, `generateObject`, etc.)
- JSON serialization (`buildFromJsonExpression`, `buildToJsonExpression`)

## Usage

```bash
# Generate all languages
bun codegen/index.ts

# Generate specific language
bun codegen/index.ts swift
bun codegen/index.ts kotlin dart

# Package scripts from specs/client
bun run generate            # TypeScript + all IR plugins + sync
bun run generate:csharp     # Single-language example
```

## Why Not Pure Templates?

Each language has complex, specific requirements:

### Swift

- Codable conformance, with flat `__typename` coding for unions
- Raw-value initializers that accept the IR legacy aliases, and `.unknown` fallback
- Input decoders that apply SDL defaults and keep enums strict

### Kotlin

- Sealed interfaces for unions
- Complex fromJson/toJson with nullable patterns
- Type casting for JSON deserialization

### Dart

- extends/implements clauses
- Constructor parameter patterns ({required this.field})
- Union wrapper classes with interface field forwarding

### GDScript

- \_init() constructor pattern
- Variant type for union values
- from_json/to_json static/instance methods

### C#

- C# records and interfaces
- Per-enum JSON converters
- [JsonPolymorphic] unions for generated result types

These patterns are difficult to express cleanly in templates. The current plugin-based approach:

- Keeps logic in TypeScript (type-safe, debuggable)
- Uses IR for shared schema representation
- Allows language-specific customization

## Testing

```bash
cd specs/client
bun run test
```

This typechecks `codegen/` and `src/` in strict mode, then runs the Vitest
suite: schema parsing, transformation, generated fixtures, and a wire
round trip through every installed Swift, Dart, and .NET toolchain.
