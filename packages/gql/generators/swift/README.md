# Swift Codegen Scaffold

Use the provided `generate-swift.sh` script to run the Apollo iOS CLI against
the shared schema files.

## Prerequisites

- Install the CLI once: `brew install apollo-ios-cli`

## Generate

```bash
./generate-swift.sh
```

The script collects every `.graphql` file from `../../src/` and writes the
result to `Generated/`.  Update the command flags inside the script to point to
operation documents or to change the module name to match your project.
