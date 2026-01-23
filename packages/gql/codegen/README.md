# Code Generation System

IR-based code generation system for multiple target languages.

## Architecture

```
codegen/
├── index.ts              # Main entry point
├── core/
│   ├── types.ts          # Intermediate Representation (IR) types
│   ├── parser.ts         # GraphQL schema parser
│   ├── transformer.ts    # AST → IR transformer
│   └── utils.ts          # Common utilities (case conversion, keywords)
├── plugins/
│   ├── base-plugin.ts    # Abstract base class
│   ├── swift.ts          # Swift plugin (~700 lines)
│   ├── kotlin.ts         # Kotlin plugin (~850 lines)
│   ├── dart.ts           # Dart plugin (~870 lines)
│   └── gdscript.ts       # GDScript plugin (~610 lines)
├── templates/            # Handlebars templates (optional)
│   ├── swift/
│   ├── kotlin/
│   ├── dart/
│   └── gdscript/
└── test-output.ts        # Output comparison test
```

## How It Works

1. **Parse**: GraphQL schema is parsed into AST
2. **Transform**: AST is transformed into language-agnostic IR
3. **Generate**: Language-specific plugins convert IR to target code

## IR (Intermediate Representation)

The IR includes:
- `IREnum` - Enum types with values and legacy aliases
- `IRInterface` - Protocol/Interface definitions
- `IRObject` - Struct/Class definitions with fields
- `IRInput` - Input type definitions
- `IRUnion` - Union types with member tracking
- `IROperation` - Query/Mutation/Subscription definitions

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

# Test output matches original generators
bun codegen/test-output.ts

# NPM scripts
npm run generate:new:all    # Generate all
npm run test:codegen        # Test comparison
```

## Why Not Pure Templates?

Each language has complex, specific requirements:

### Swift
- Codable protocol conformance
- Custom initializer for ErrorCode (legacy alias handling)
- Platform-specific defaults (ProductIOS, ProductAndroid)

### Kotlin
- Sealed interfaces for unions
- Complex fromJson/toJson with nullable patterns
- Type casting for JSON deserialization

### Dart
- extends/implements clauses
- Constructor parameter patterns ({required this.field})
- Union wrapper classes with interface field forwarding

### GDScript
- _init() constructor pattern
- Variant type for union values
- from_json/to_json static/instance methods

These patterns are difficult to express cleanly in templates. The current plugin-based approach:
- Keeps logic in TypeScript (type-safe, debuggable)
- Uses IR for shared schema representation
- Allows language-specific customization

## Adding a New Language

1. Create `plugins/<language>.ts` extending `CodegenPlugin`
2. Implement abstract methods
3. Register in `index.ts`
4. Optionally create templates in `templates/<language>/`

## Testing

```bash
# Run comparison test
npm run test:codegen

# Expected output:
# ✓ swift: MATCH
# ✓ kotlin: MATCH
# ✓ dart: MATCH
# ✓ gdscript: MATCH
```

The test compares new plugin output against original generator scripts to ensure 100% compatibility.
