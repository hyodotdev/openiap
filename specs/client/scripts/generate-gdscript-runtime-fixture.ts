import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nullableEnumListSchema } from "../codegen/fixtures/nullable-enum-list.js";
import { GDScriptPlugin } from "../codegen/plugins/gdscript.js";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(packageRoot, "../..");
const outputPath = resolve(
  repositoryRoot,
  "libraries/godot-iap/Example/tests/generated_nullable_enum_list_types.gd",
);
const source = new GDScriptPlugin({
  outputPath: "generated_nullable_enum_list_types.gd",
}).generate(nullableEnumListSchema());

writeFileSync(outputPath, source);
